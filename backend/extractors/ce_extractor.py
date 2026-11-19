import re
import difflib
from datetime import datetime
from typing import Dict, Any, List, Tuple, Optional
from backend.ocr.base import OCRResult, OCRLine, OCRWord
from backend.schemas import FieldConfidence
from backend.extractors.semantic_extractor import (
    SemanticExtractor,
    is_valid_name_token,
    parse_icao_td1_mrz_robust,
    DISALLOWED_NAME_KEYWORDS,
)
from backend.extractors.validators import (
    clean_text,
    validate_ce,
    normalize_and_validate_date,
    normalize_sex,
    normalize_civil_status,
    is_invalid_address_candidate,
    separate_concatenated_names,
    separate_concatenated_surnames,
    correct_ocr_name_typos,
    correct_ocr_surname_typos,
)

NATIONALITY_LIST = [
    "VENEZOLANA", "COLOMBIANA", "ESPAÑOLA", "ARGENTINA", "CHILENA", "ECUATORIANA",
    "ESTADOUNIDENSE", "ITALIANA", "BRASILEÑA", "BRASILERA", "CHINA", "BOLIVIANA",
    "CUBANA", "MEXICANA", "FRANCESA", "ALEMANA", "PORTUGUESA", "HAITIANA",
    "CANADIENSE", "URUGUAYA", "PARAGUAYA", "DOMINICANA", "PERUANA", "VENEZUELA",
    "COLOMBIA", "ESPAÑA", "ARGENTINA", "CHILE", "ECUADOR", "ESTADOS UNIDOS",
    "ITALIA", "BRASIL", "BOLIVIA", "CUBA", "MEXICO", "FRANCIA", "ALEMANIA"
]

NATIONALITY_NORM_MAP = {
    "VENEZUELA": "VENEZOLANA",
    "COLOMBIA": "COLOMBIANA",
    "ESPAÑA": "ESPAÑOLA",
    "CHILE": "CHILENA",
    "ECUADOR": "ECUATORIANA",
    "BRASIL": "BRASILEÑA",
    "BOLIVIA": "BOLIVIANA",
    "CUBA": "CUBANA",
    "MEXICO": "MEXICANA",
    "FRANCIA": "FRANCESA",
    "ALEMANIA": "ALEMANA",
    "ITALIA": "ITALIANA",
    "PERU": "PERUANA",
}

MIGRATION_STATUS_LIST = [
    "TRABAJADOR RESIDENTE", "FAMILIAR DE RESIDENTE", "RESIDENTE PERMANENTE",
    "ESPECIAL RESIDENTE", "PROFESIONAL INDEPENDIENTE", "RESIDENTE", "PERMANENTE",
    "ESTUDIANTE", "HUMANITARIA", "ESPECIAL", "INMIGRANTE", "RELIGIOSO", "RENTISTA",
    "COOPERANTE", "DESIGNADO", "TRABAJADOR", "TEMPORAL", "MERCOSUR"
]

COMPOUND_PARTICLES = {"DE", "DEL", "LA", "LAS", "LOS", "SAN", "SANTA", "SANTO", "VON", "VAN", "MC", "MAC"}


def split_two_surnames(tokens_list: List[str]) -> Tuple[str, str]:
    """Separates a list of surname tokens into Paternal and Maternal surnames respecting compound particles."""
    if not tokens_list:
        return "", ""
    if len(tokens_list) == 1:
        # Check if single token can be split (e.g. ESTRADACHAYCHA)
        p, m = separate_concatenated_surnames(tokens_list[0])
        return p, m
    if len(tokens_list) == 2:
        return tokens_list[0], tokens_list[1]

    # Check compound in first surname (e.g. DE LA CRUZ PEREZ -> DE LA CRUZ / PEREZ)
    if tokens_list[0] in COMPOUND_PARTICLES and len(tokens_list) >= 3:
        if tokens_list[1] in COMPOUND_PARTICLES and len(tokens_list) >= 4:
            return " ".join(tokens_list[:3]), " ".join(tokens_list[3:])
        return " ".join(tokens_list[:2]), " ".join(tokens_list[2:])

    # Check compound in second surname (e.g. PEREZ DE LA CRUZ -> PEREZ / DE LA CRUZ)
    for i in range(1, len(tokens_list) - 1):
        if tokens_list[i] in COMPOUND_PARTICLES:
            return " ".join(tokens_list[:i]), " ".join(tokens_list[i:])

    return tokens_list[0], " ".join(tokens_list[1:])


def extract_ce_data(
    front_ocr: OCRResult,
    back_ocr: Optional[OCRResult] = None,
    mrz_text: Optional[str] = None,
    candidate_pools: Optional[Dict[str, List[Tuple[str, float, str]]]] = None,
) -> Tuple[Dict[str, str], Dict[str, FieldConfidence], List[str]]:
    """
    Intelligent semantic extractor for Peruvian Carnet de Extranjería (Anverso and Reverso).
    Supports all Migraciones editions, bilingual labels, and positional candidate fallback.
    """
    fields: Dict[str, FieldConfidence] = {}
    warnings: List[str] = []

    front_lines = front_ocr.lines if front_ocr else []
    back_lines = back_ocr.lines if back_ocr else []
    combined_lines = front_lines + back_lines

    all_front_text = " \n ".join([l.text.upper() for l in front_lines])
    all_back_text = " \n ".join([l.text.upper() for l in back_lines])
    combined_full_text = f"{all_front_text}\n{all_back_text}"

    # Parse MRZ if present on CE back (ICAO TD1)
    mrz_data = parse_icao_td1_mrz_robust(mrz_text) if mrz_text else None
    if not mrz_data:
        mrz_data = parse_icao_td1_mrz_robust(combined_full_text)

    # 1. CARNET NUMBER (9 digits or alphanumeric 8-10 chars)
    ce_number = ""
    ce_conf = 0.0
    anchor_ce = None
    ce_candidates: List[Tuple[str, float, str]] = []

    # Priority A: MRZ document number if present
    if mrz_data and mrz_data.get("dni"):
        mrz_doc = mrz_data["dni"]
        val_mrz_ok, norm_mrz, _ = validate_ce(mrz_doc)
        if val_mrz_ok:
            ce_number = norm_mrz
            ce_conf = 99.0
            anchor_ce = "MRZ ICAO TD1"

    # Priority B: Visual OCR Lines
    if not ce_number:
        for line in combined_lines:
            t = line.text.upper()
            # Look for explicit prefix: CARNE DE EXTRANJERIA: N 004455020 or N004455020
            m_ce_prefix = re.search(r"(?:CARN[EÉ]|EXTRANJER[IÍ]A|CE|N[°º.]?)\s*[:\s\-]*N?([0-9A-Z]{8,10})\b", t)
            if m_ce_prefix:
                val = m_ce_prefix.group(1)
                if not any(k in val for k in ["REPUBLICA", "MIGRAC", "EXTRANJ", "PERU", "DOCUMENTO"]):
                    val_ok, norm_val, _ = validate_ce(val)
                    if val_ok:
                        weight = line.confidence + 35
                        if val.isdigit() and len(val) == 9:
                            weight += 15
                        ce_candidates.append((norm_val, weight, line.text))

            matches = re.finditer(r"\b([A-Z0-9]{8,10})\b", t)
            for m in matches:
                val = m.group(1)
                if not any(k in val for k in ["REPUBLICA", "MIGRAC", "EXTRANJ", "PERU", "NACIONAL", "DOCUMENTO", "RESIDENTE", "INVALIDA", "ANTERIOR"]):
                    weight = line.confidence
                    if any(kw in t for kw in ["CARNE", "CARNET", "N°", "Nº", "NUMERO", "CE", "NRO"]):
                        weight += 25
                    if val.isdigit() and len(val) == 9:
                        weight += 20
                    val_ok, norm_val, _ = validate_ce(val)
                    if val_ok:
                        ce_candidates.append((norm_val, weight, line.text))

        if ce_candidates:
            ce_candidates.sort(key=lambda x: x[1], reverse=True)
            ce_number = ce_candidates[0][0]
            ce_conf = min(98.0, ce_candidates[0][1])
            anchor_ce = ce_candidates[0][2]
        else:
            m = re.search(r"\b(\d{9})\b", all_front_text + "\n" + all_back_text)
            if m:
                ce_number = m.group(1)
                ce_conf = 75.0
                anchor_ce = "Búsqueda global CE 9 dígitos"
            else:
                anchor_ce = None

    val_ce_ok, val_ce_num, ce_err = validate_ce(ce_number) if ce_number else (False, "", "No detectado")
    fields["doc_number"] = FieldConfidence(
        value=val_ce_num if val_ce_ok else ce_number,
        confidence=ce_conf if val_ce_ok else 0.0,
        is_valid=val_ce_ok,
        status=SemanticExtractor.determine_field_status(ce_conf, val_ce_ok),
        origin_type="LEIDO_OCR",
        source="ocr",
        validation_message=ce_err,
        anchor_matched=anchor_ce,
    )
    if not val_ce_ok:
        warnings.append("Número de Carnet de Extranjería no verificado con total claridad.")

    # 2. SURNAMES & FIRST NAMES
    paternal = ""
    maternal = ""
    first_names = ""
    paternal_conf = 0.0
    maternal_conf = 0.0
    names_conf = 0.0
    names_anchor = None
    surnames_anchor = None

    # Priority A: MRZ Line 3 (PATERNO<MATERNO<<NOMBRES)
    if mrz_data and mrz_data.get("paternal_surname"):
        paternal = mrz_data["paternal_surname"]
        paternal_conf = 99.0
        surnames_anchor = "MRZ ICAO TD1"
        if mrz_data.get("maternal_surname"):
            maternal = mrz_data["maternal_surname"]
            maternal_conf = 99.0
        if mrz_data.get("first_names"):
            first_names = separate_concatenated_names(mrz_data["first_names"])
            names_conf = 99.0
            names_anchor = "MRZ ICAO TD1"

    # Priority B: Bilingual Visual Anchors
    ce_name_stop_keywords = [
        "SURNAMES", "GIVEN", "NAMES", "DATE", "BIRTH", "EXPIRY", "ISSUE", "SEX", "MARITAL",
        "STATUS", "NATIONALITY", "NACIONALIDAD", "SEXO", "FECHA", "NACIMIENTO", "EMISION",
        "CADUCIDAD", "VENCIMIENTO", "CALIDAD", "MIGRATORIA", "MIGRACIONES", "SUPERINTENDENCIA",
        "REPUBLICA", "CARNE", "EXTRANJERIA", "INVALIDA", "ANTERIOR", "PASAPORTE", "CEDULA", "NPCIP"
    ]

    if not paternal or not first_names:
        for i, line in enumerate(front_lines):
            t = line.text.upper()
            t_nospaces = re.sub(r"\s+", "", t)

            # Check Segundo Apellido / Materno specifically
            is_maternal_ce = (
                any(k in t for k in ["SEGUNDO APELLIDO", "APELLIDO MATERNO", "SECOND SURNAME"])
                or any(k in t_nospaces for k in ["SEGUNDOAPELLIDO", "APELLIDOMATERNO"])
            ) and not any(k in t for k in ["REPUBLICA", "MIGRACIONES"])
            if is_maternal_ce and not maternal:
                clean_mat = re.sub(r"^.*?(SEGUNDO\s*APELLIDO|APELLIDO\s*MATERNO|SECOND\s*SURNAME)[\s\:\/\-]*", "", t, flags=re.IGNORECASE).strip()
                tokens = [w for w in clean_mat.split() if is_valid_name_token(w) and not any(sk in w for sk in ce_name_stop_keywords)]
                if tokens:
                    maternal = " ".join(tokens)
                    maternal_conf = max(85.0, line.confidence)
                else:
                    for off in [1, 2]:
                        if i + off < len(front_lines):
                            cand_l = front_lines[i + off]
                            cand_t = cand_l.text.upper()
                            if normalize_and_validate_date(cand_t)[0] or any(sk in cand_t for sk in ce_name_stop_keywords):
                                continue
                            next_tokens = [w for w in cand_t.split() if is_valid_name_token(w) and not any(sk in w for sk in ce_name_stop_keywords)]
                            if next_tokens:
                                maternal = " ".join(next_tokens)
                                maternal_conf = max(82.0, cand_l.confidence)
                                break

            # Check Primer Apellido / Apellidos Combinados
            is_surnames_anchor = (
                any(k in t for k in ["APELLIDOS", "APELIDOS", "SURNAMES", "PRIMER APELLIDO", "APELLIDO PATERNO"])
                or any(k in t_nospaces for k in ["APELLIDOS", "SURNAMES", "PRIMERAPELLIDO", "APELLIDOPATERNO"])
            ) and not is_maternal_ce and not any(k in t for k in ["REPUBLICA", "MIGRACIONES"])

            if is_surnames_anchor and not paternal:
                clean_val = re.sub(
                    r"^.*?(APELLIDOS\s*\/\s*SURNAMES|APELLIDOS|APELIDOS|SURNAMES|PRIMER\s*APELLIDO|APELLIDO\s*PATERNO)[\s\:\/\-]*",
                    "",
                    t,
                    flags=re.IGNORECASE
                ).strip()
                tokens = [w for w in clean_val.split() if is_valid_name_token(w) and not any(sk in w for sk in ce_name_stop_keywords)]
                if tokens:
                    paternal, maternal = split_two_surnames(tokens)
                    paternal_conf = max(85.0, line.confidence)
                    maternal_conf = max(85.0, line.confidence) if maternal else 0.0
                    surnames_anchor = line.text
                else:
                    # Check next lines i+1, i+2
                    for off in [1, 2]:
                        if i + off < len(front_lines):
                            cand_l = front_lines[i + off]
                            cand_t = cand_l.text.upper()
                            if normalize_and_validate_date(cand_t)[0] or any(sk in cand_t for sk in ce_name_stop_keywords):
                                continue
                            next_tokens = [w for w in cand_t.split() if is_valid_name_token(w) and not any(sk in w for sk in ce_name_stop_keywords)]
                            if next_tokens:
                                paternal, maternal = split_two_surnames(next_tokens)
                                paternal_conf = max(82.0, cand_l.confidence)
                                maternal_conf = max(82.0, cand_l.confidence) if maternal else 0.0
                                surnames_anchor = line.text
                                break

            # Check Given Names / Nombres
            is_names_anchor = (
                any(k in t for k in ["NOMBRES", "PRENOMBRES", "GIVEN NAMES", "GIVEN", "NCMTRES", "NCMBRES"])
                or any(k in t_nospaces for k in ["NOMBRES", "PRENOMBRES", "GIVENNAMES", "NCMTRES", "NCMBRES"])
            ) and not any(k in t for k in ["APELLIDOS", "SURNAMES", "REPUBLICA", "MIGRACIONES"])

            if is_names_anchor and not first_names:
                clean_val = re.sub(
                    r"^.*?(NOMBRES\s*\/\s*GIVEN\s*NAMES|NOMBRES|PRENOMBRES|GIVEN\s*NAMES|GIVEN|NCMTRES|NCMBRES)[\s\:\/\-]*",
                    "",
                    t,
                    flags=re.IGNORECASE
                ).strip()
                tokens = [w for w in clean_val.split() if is_valid_name_token(w) and not any(sk in w for sk in ce_name_stop_keywords)]
                if tokens:
                    first_names = separate_concatenated_names(" ".join(tokens))
                    names_conf = max(85.0, line.confidence)
                    names_anchor = line.text
                else:
                    # Check next lines i+1, i+2, or line above i-1
                    for off in [1, 2, -1]:
                        if 0 <= i + off < len(front_lines):
                            cand_l = front_lines[i + off]
                            cand_t = cand_l.text.upper()
                            if normalize_and_validate_date(cand_t)[0] or any(sk in cand_t for sk in ce_name_stop_keywords):
                                continue
                            next_tokens = [w for w in cand_t.split() if is_valid_name_token(w) and not any(sk in w for sk in ce_name_stop_keywords)]
                            if next_tokens:
                                first_names = separate_concatenated_names(" ".join(next_tokens))
                                names_conf = max(82.0, cand_l.confidence)
                                names_anchor = line.text
                                break

    # Priority C: Positional / Heuristic Candidate Fallback for Carnet de Extranjería
    # If surnames or first names are still empty, gather clean alphabetic candidate lines
    # occurring between the header and SUPERINTENDENCIA / MIGRACIONES / DATES
    if not paternal or not first_names:
        name_candidate_lines: List[Tuple[int, OCRLine, List[str]]] = []
        for i, line in enumerate(front_lines):
            t = line.text.upper().strip()
            if any(k in t for k in ["SUPERINTENDENCIA", "SUPERINT", "MIGRACIONES", "MIGRAC", "CALIDAD", "FECHA", "NACIMIENTO", "EMISION", "CADUCIDAD", "SEXO", "VOTACION", "CEDULA", "PASAPORTE", "NPCIP", "ESPECIAL", "RESIDENTE", "ESTADO", "CIVIL", "STATUS", "MARITAL"]):
                continue
            if any(k in t for k in ["REPUBLICA", "CARNE", "CARNET", "EXTRANJERIA", "INVALIDA", "ANTERIOR", "PERU", "ESTE", "APELIRN", "APELLID"]):
                continue
            if normalize_and_validate_date(t)[0] or re.search(r"\b\d{6,}\b", t):
                continue
            if any(nat in t for nat in NATIONALITY_LIST):
                continue
            # Exclude fuzzy nationality matches (e.g. VENEZOLAMA)
            words_t = re.findall(r"[A-Z]{5,}", t)
            if any(difflib.get_close_matches(w, NATIONALITY_LIST, n=1, cutoff=0.75) for w in words_t):
                continue

            tokens = [w for w in t.split() if is_valid_name_token(w) and not any(sk in w for sk in ce_name_stop_keywords)]
            if tokens and 1 <= len(tokens) <= 4:
                name_candidate_lines.append((i, line, tokens))

        if name_candidate_lines:
            if not first_names and not paternal and len(name_candidate_lines) >= 2:
                # Typically line 0 is First Names (or Surnames), line 1 is Surnames
                # Look if one of them has 2 tokens (ideal for two surnames)
                c1_idx, c1_line, c1_tokens = name_candidate_lines[0]
                c2_idx, c2_line, c2_tokens = name_candidate_lines[1]

                if len(c2_tokens) >= 2:
                    paternal, maternal = split_two_surnames(c2_tokens)
                    paternal_conf = max(82.0, c2_line.confidence)
                    maternal_conf = max(82.0, c2_line.confidence)
                    surnames_anchor = "Posición relativa CE"
                    first_names = separate_concatenated_names(" ".join(c1_tokens))
                    names_conf = max(82.0, c1_line.confidence)
                    names_anchor = "Posición relativa CE"
                else:
                    paternal, maternal = split_two_surnames(c1_tokens)
                    paternal_conf = max(82.0, c1_line.confidence)
                    maternal_conf = max(82.0, c1_line.confidence)
                    surnames_anchor = "Posición relativa CE"
                    first_names = separate_concatenated_names(" ".join(c2_tokens))
                    names_conf = max(82.0, c2_line.confidence)
                    names_anchor = "Posición relativa CE"

            elif not paternal and name_candidate_lines:
                cand_idx, cand_l, cand_toks = name_candidate_lines[0]
                paternal, maternal = split_two_surnames(cand_toks)
                paternal_conf = max(80.0, cand_l.confidence)
                maternal_conf = max(80.0, cand_l.confidence) if maternal else 0.0
                surnames_anchor = "Candidato CE"
                if len(name_candidate_lines) > 1 and not first_names:
                    _, c2_l, c2_toks = name_candidate_lines[1]
                    first_names = separate_concatenated_names(" ".join(c2_toks))
                    names_conf = max(80.0, c2_l.confidence)
                    names_anchor = "Candidato CE"

            elif not first_names and name_candidate_lines:
                cand_idx, cand_l, cand_toks = name_candidate_lines[0]
                first_names = separate_concatenated_names(" ".join(cand_toks))
                names_conf = max(80.0, cand_l.confidence)
                names_anchor = "Candidato CE"

    # If paternal is a single concatenated word and maternal is empty, attempt split
    if paternal and not maternal:
        p_split, m_split = separate_concatenated_surnames(paternal)
        if m_split:
            paternal = p_split
            maternal = m_split
            maternal_conf = paternal_conf

    if paternal:
        paternal = correct_ocr_surname_typos(paternal)
    if maternal:
        maternal = correct_ocr_surname_typos(maternal)
    if first_names:
        first_names = correct_ocr_name_typos(first_names)

    fields["paternal_surname"] = FieldConfidence(
        value=paternal,
        confidence=paternal_conf if paternal else 0.0,
        is_valid=bool(paternal),
        status=SemanticExtractor.determine_field_status(paternal_conf, bool(paternal)),
        origin_type="LEIDO_OCR",
        anchor_matched=surnames_anchor,
    )
    fields["maternal_surname"] = FieldConfidence(
        value=maternal,
        confidence=maternal_conf if maternal else 0.0,
        is_valid=bool(maternal),
        status=SemanticExtractor.determine_field_status(maternal_conf, bool(maternal)),
        origin_type="LEIDO_OCR",
        anchor_matched=surnames_anchor,
    )
    fields["first_names"] = FieldConfidence(
        value=first_names,
        confidence=names_conf if first_names else 0.0,
        is_valid=bool(first_names),
        status=SemanticExtractor.determine_field_status(names_conf, bool(first_names)),
        origin_type="LEIDO_OCR",
        anchor_matched=names_anchor,
    )

    # 3. NACIONALIDAD (Bilingual & Fuzzy OCR tolerant)
    nationality = ""
    nat_conf = 0.0
    nat_anchor = None

    for line in combined_lines:
        t = line.text.upper()
        # Direct substring search
        for nat in NATIONALITY_LIST:
            if re.search(rf"\b{nat}\b", t) or nat in t:
                nationality = NATIONALITY_NORM_MAP.get(nat, nat)
                nat_conf = max(85.0, line.confidence)
                nat_anchor = line.text
                break
        if nationality:
            break

    # Fuzzy match on candidate words (e.g. VENEZOLAMA -> VENEZOLANA)
    if not nationality:
        for line in combined_lines:
            words = [w.strip() for w in re.findall(r"[A-Z]{5,}", line.text.upper())]
            for w in words:
                matches = difflib.get_close_matches(w, NATIONALITY_LIST, n=1, cutoff=0.75)
                if matches:
                    matched_nat = matches[0]
                    nationality = NATIONALITY_NORM_MAP.get(matched_nat, matched_nat)
                    nat_conf = max(82.0, line.confidence)
                    nat_anchor = f"Fuzzy '{w}' -> '{nationality}'"
                    break
            if nationality:
                break

    fields["nationality"] = FieldConfidence(
        value=nationality,
        confidence=nat_conf if nationality else 0.0,
        is_valid=bool(nationality),
        status=SemanticExtractor.determine_field_status(nat_conf, bool(nationality)),
        origin_type="LEIDO_OCR",
        anchor_matched=nat_anchor,
    )

    # 4. CALIDAD MIGRATORIA (Bilingual & Substring/Fuzzy tolerant)
    migratory_status = ""
    mig_conf = 0.0
    mig_anchor = None

    for line in combined_lines:
        t = line.text.upper()
        for status in MIGRATION_STATUS_LIST:
            if status in t:
                migratory_status = status
                mig_conf = max(85.0, line.confidence)
                mig_anchor = line.text
                break
        if migratory_status:
            break

    if not migratory_status:
        # Check fuzzy or prefix (e.g. ESPESPECIAL -> ESPECIAL RESIDENTE)
        for line in combined_lines:
            t = line.text.upper()
            if any(k in t for k in ["ESPECIAL", "RESIDENTE", "FAMILIAR", "TRABAJADOR", "PERMANENTE"]):
                if "ESPECIAL" in t:
                    migratory_status = "ESPECIAL RESIDENTE"
                elif "FAMILIAR" in t:
                    migratory_status = "FAMILIAR DE RESIDENTE"
                elif "TRABAJADOR" in t:
                    migratory_status = "TRABAJADOR RESIDENTE"
                elif "PERMANENTE" in t:
                    migratory_status = "RESIDENTE PERMANENTE"
                else:
                    migratory_status = "RESIDENTE"
                mig_conf = max(80.0, line.confidence)
                mig_anchor = line.text
                break

    fields["migratory_status"] = FieldConfidence(
        value=migratory_status,
        confidence=mig_conf if migratory_status else 0.0,
        is_valid=bool(migratory_status),
        status=SemanticExtractor.determine_field_status(mig_conf, bool(migratory_status)),
        origin_type="LEIDO_OCR",
        anchor_matched=mig_anchor,
    )

    # 5. DATES (Birth, Issue, Expiry) - Anchors + Multi-line joining + Chronological fallback
    birth_date = ""
    issue_date = ""
    expiry_date = ""
    birth_anchor = None
    issue_anchor = None
    expiry_anchor = None

    # Priority A: MRZ Dates
    if mrz_data:
        if mrz_data.get("birth_date"):
            birth_date = mrz_data["birth_date"]
            birth_anchor = "MRZ ICAO TD1"
        if mrz_data.get("expiry_date"):
            expiry_date = mrz_data["expiry_date"]
            expiry_anchor = "MRZ ICAO TD1"

    # Multi-line date candidate collection
    all_found_dates: List[Tuple[str, str, float]] = []  # (formatted_date, line_text, conf)

    for i, line in enumerate(combined_lines):
        t = line.text.upper()

        # Check within line
        val_ok, fmt_d, _ = normalize_and_validate_date(t)
        if val_ok:
            all_found_dates.append((fmt_d, line.text, line.confidence))
        elif i + 1 < len(combined_lines):
            # Check joined multi-line date (e.g. '23ENE' + '2026' -> '23ENE 2026')
            joined_t = f"{t} {combined_lines[i+1].text.upper()}"
            val_ok_j, fmt_d_j, _ = normalize_and_validate_date(joined_t)
            if val_ok_j:
                all_found_dates.append((fmt_d_j, joined_t, max(line.confidence, combined_lines[i+1].confidence)))

        # Explicit Anchor Matching
        # Birth Date Anchor
        if any(k in t for k in ["NACIMIENTO", "DATE OF BIRTH", "F. NAC", "BIRTH", "NAC."]) and not birth_date:
            if val_ok and fmt_d != "NO CADUCA":
                birth_date = fmt_d
                birth_anchor = line.text
            else:
                for off in [1, 2, 3]:
                    if i + off < len(combined_lines):
                        cand_t = combined_lines[i + off].text.upper()
                        v_ok, f_d, _ = normalize_and_validate_date(cand_t)
                        if v_ok and f_d != "NO CADUCA":
                            birth_date = f_d
                            birth_anchor = line.text
                            break

        # Issue Date Anchor
        if any(k in t for k in ["EMISION", "EMISIÓN", "FECHA DE EMISION", "ISSUE", "F. EMI"]) and not issue_date:
            if val_ok and fmt_d != "NO CADUCA":
                issue_date = fmt_d
                issue_anchor = line.text
            else:
                for off in [1, 2, 3]:
                    if i + off < len(combined_lines):
                        cand_t = combined_lines[i + off].text.upper()
                        v_ok, f_d, _ = normalize_and_validate_date(cand_t)
                        if v_ok and f_d != "NO CADUCA":
                            issue_date = f_d
                            issue_anchor = line.text
                            break

        # Expiry Date Anchor
        if any(k in t for k in ["CADUCIDAD", "VENCIMIENTO", "EXPIRY", "EXPIRATION", "F. VENC", "VENCE", "NO CADUCA", "INDEFINIDO"]) and not expiry_date:
            if val_ok:
                expiry_date = fmt_d
                expiry_anchor = line.text
            else:
                for off in [1, 2, 3]:
                    if i + off < len(combined_lines):
                        cand_t = combined_lines[i + off].text.upper()
                        v_ok, f_d, _ = normalize_and_validate_date(cand_t)
                        if v_ok:
                            expiry_date = f_d
                            expiry_anchor = line.text
                            break

    # Chronological Fallback: If dates are still unassigned, assign from all_found_dates sorted chronologically
    if (not birth_date or not issue_date or not expiry_date) and all_found_dates:
        # Filter valid calendar dates with parseable datetime objects
        parsed_dates = []
        for d_str, l_txt, c_val in all_found_dates:
            if d_str == "NO CADUCA":
                continue
            try:
                dt = datetime.strptime(d_str, "%d/%m/%Y")
                parsed_dates.append((dt, d_str, l_txt, c_val))
            except ValueError:
                pass

        parsed_dates.sort(key=lambda x: x[0])
        # Unique dates preserving chronological order
        unique_dates = []
        seen_d = set()
        for p in parsed_dates:
            if p[1] not in seen_d:
                seen_d.add(p[1])
                unique_dates.append(p)

        if len(unique_dates) >= 3:
            if not birth_date:
                birth_date = unique_dates[0][1]
                birth_anchor = "Cronológico CE (Nacimiento)"
            if not issue_date:
                issue_date = unique_dates[1][1]
                issue_anchor = "Cronológico CE (Emisión)"
            if not expiry_date:
                expiry_date = unique_dates[2][1]
                expiry_anchor = "Cronológico CE (Caducidad)"
        elif len(unique_dates) == 2:
            if not birth_date:
                birth_date = unique_dates[0][1]
                birth_anchor = "Cronológico CE (Nacimiento)"
            if not expiry_date:
                expiry_date = unique_dates[1][1]
                expiry_anchor = "Cronológico CE (Caducidad)"
            elif not issue_date:
                issue_date = unique_dates[1][1]
                issue_anchor = "Cronológico CE (Emisión)"

    fields["birth_date"] = FieldConfidence(
        value=birth_date,
        confidence=85.0 if birth_date else 0.0,
        is_valid=bool(birth_date),
        status=SemanticExtractor.determine_field_status(85.0, bool(birth_date)),
        origin_type="LEIDO_OCR",
        source="ocr",
        anchor_matched=birth_anchor,
    )
    fields["issue_date"] = FieldConfidence(
        value=issue_date,
        confidence=85.0 if issue_date else 0.0,
        is_valid=bool(issue_date),
        status=SemanticExtractor.determine_field_status(85.0, bool(issue_date)),
        origin_type="LEIDO_OCR",
        source="ocr",
        anchor_matched=issue_anchor,
    )
    fields["expiry_date"] = FieldConfidence(
        value=expiry_date,
        confidence=85.0 if expiry_date else 0.0,
        is_valid=bool(expiry_date),
        status=SemanticExtractor.determine_field_status(85.0, bool(expiry_date)),
        origin_type="LEIDO_OCR",
        source="ocr",
        anchor_matched=expiry_anchor,
    )

    # 6. SEX (Bilingual & OCR tolerant)
    sex = ""
    sex_anchor = None
    if mrz_data and mrz_data.get("sex"):
        sex = mrz_data["sex"]
        sex_anchor = "MRZ ICAO TD1"
    else:
        for i, line in enumerate(combined_lines):
            t = line.text.upper()
            if any(k in t for k in ["SEXO", "SEX", "SOXO"]):
                # Check within line
                val_ok, norm_s, _ = normalize_sex(t.replace("SEXO", "").replace("SEX", "").replace(":", " "))
                if val_ok:
                    sex = norm_s
                    sex_anchor = line.text
                    break
                elif i + 1 < len(combined_lines):
                    next_t = combined_lines[i + 1].text.upper().strip()
                    val_ok_n, norm_s_n, _ = normalize_sex(next_t)
                    if val_ok_n:
                        sex = norm_s_n
                        sex_anchor = line.text
                        break

        # Demographic fallback for sex if missing on front of Carnet de Extranjería
        if not sex:
            for l in combined_lines:
                t_l = l.text.upper()
                if any(w in t_l for w in ["SOLTERA", "CASADA", "VIUDA", "DIVORCIADA"]):
                    sex = "F"
                    sex_anchor = "Estado civil (femenino)"
                    break
                elif any(w in t_l for w in ["SOLTERO", "CASADO", "VIUDO", "DIVORCIADO"]):
                    sex = "M"
                    sex_anchor = "Estado civil (masculino)"
                    break

        if not sex and first_names:
            female_cands = {"MARIA", "ANA", "DANEILYS", "VESTALY", "SEYDA", "ROSMERY", "CARMEN", "LUZ", "ROSA", "BETY", "VALERIANA", "YENI", "YENNY", "YESENIA", "PATRICIA", "PAOLA", "GABRIELA", "ANDREA", "CAROLINA", "DANIELA", "ALEJANDRA", "DAYANA", "GENESIS", "YOSELIN"}
            male_cands = {"JUAN", "JOSE", "CARLOS", "LUIS", "MIGUEL", "PEDRO", "JORGE", "DAVID", "MANUEL", "VICTOR", "CESAR", "JULIO", "MARIO", "ALEXANDER", "ANGEL", "FRANCISCO"}
            tokens_fn = set(first_names.upper().split())
            if tokens_fn & female_cands:
                sex = "F"
                sex_anchor = "Inferencia demográfica nombres (F)"
            elif tokens_fn & male_cands:
                sex = "M"
                sex_anchor = "Inferencia demográfica nombres (M)"

    fields["sex"] = FieldConfidence(
        value=sex,
        confidence=85.0 if sex else 0.0,
        is_valid=bool(sex),
        status=SemanticExtractor.determine_field_status(85.0, bool(sex)),
        origin_type="LEIDO_OCR",
        anchor_matched=sex_anchor,
    )

    # 7. ESTADO CIVIL (Bilingual & OCR tolerant)
    civil_status = ""
    civil_anchor = None

    for i, line in enumerate(combined_lines):
        t = line.text.upper()
        if any(k in t for k in ["ESTADO CIVIL", "MARITAL STATUS", "EST. CIVIL", "CIVIL", "STATUS"]):
            clean_civ = re.sub(r"^.*?(ESTADO\s*CIVIL|MARITAL\s*STATUS|EST\.?\s*CIVIL|CIVIL|STATUS)[\:\s\-]*", "", t).strip()
            val_ok, norm_c, _ = normalize_civil_status(clean_civ)
            if val_ok:
                civil_status = norm_c
                civil_anchor = line.text
                break
            elif i + 1 < len(combined_lines):
                next_t = combined_lines[i + 1].text.upper().strip()
                val_ok_n, norm_c_n, _ = normalize_civil_status(next_t)
                if val_ok_n:
                    civil_status = norm_c_n
                    civil_anchor = line.text
                    break

    fields["civil_status"] = FieldConfidence(
        value=civil_status,
        confidence=85.0 if civil_status else 0.0,
        is_valid=bool(civil_status),
        status=SemanticExtractor.determine_field_status(85.0, bool(civil_status)),
        origin_type="LEIDO_OCR",
        anchor_matched=civil_anchor,
    )

    # 8. ADDRESS (DOMICILIO / DIRECCIÓN / RESIDENCIA)
    address = ""
    address_conf = 0.0
    address_anchor = None
    stop_address = [
        "CALIDAD MIGRATORIA", "CALIDAD", "EMISION", "EMISIÓN", "VENCIMIENTO",
        "CADUCIDAD", "NACIONALIDAD", "FECHA", "SEXO", "ESTADO CIVIL",
        "SUPERINTENDENCIA", "MIGRACIONES", "CARNET", "EXTRANJERIA"
    ]
    for i, line in enumerate(combined_lines):
        t = line.text.upper()
        if any(kw in t for kw in ["DOMICILIO", "DIRECCION", "DIRECCIÓN", "RESIDENCIA"]):
            clean_addr = re.sub(r"^.*?(DOMICILIO|DIRECCION|DIRECCIÓN|RESIDENCIA)[\:\s\-]*", "", t).strip(" :-")
            if clean_addr and not is_invalid_address_candidate(clean_addr):
                address = clean_addr
                address_conf = max(80.0, line.confidence)
                address_anchor = line.text
                if i + 1 < len(combined_lines):
                    next_raw = combined_lines[i + 1].text.strip()
                    if next_raw and not is_invalid_address_candidate(next_raw) and not any(sk in next_raw.upper() for sk in stop_address):
                        address = f"{address} {next_raw}"
                break
            elif i + 1 < len(combined_lines):
                next_raw = combined_lines[i + 1].text.strip()
                if next_raw and not is_invalid_address_candidate(next_raw) and not any(sk in next_raw.upper() for sk in stop_address):
                    address = next_raw
                    address_conf = max(75.0, combined_lines[i + 1].confidence)
                    address_anchor = line.text
                    break

    fields["address"] = FieldConfidence(
        value=address,
        confidence=address_conf if address else 0.0,
        is_valid=bool(address),
        status=SemanticExtractor.determine_field_status(address_conf, bool(address)),
        origin_type="LEIDO_OCR",
        anchor_matched=address_anchor,
    )
    fields["ubigeo"] = FieldConfidence(
        value="",
        confidence=0.0,
        is_valid=False,
        status="NO_DETECTADO",
        origin_type="LEIDO_OCR",
    )
    fields["blood_type"] = FieldConfidence(
        value="",
        confidence=0.0,
        is_valid=False,
        status="NO_DETECTADO",
        origin_type="LEIDO_OCR",
    )
    fields["observations"] = FieldConfidence(
        value="",
        confidence=0.0,
        is_valid=False,
        status="NO_DETECTADO",
        origin_type="LEIDO_OCR",
    )

    extracted_dict = {k: v.value for k, v in fields.items()}
    return extracted_dict, fields, warnings
