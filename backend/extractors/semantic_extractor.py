import re
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from backend.ocr.base import OCRResult, OCRLine, OCRWord
from backend.ocr.consensus_engine import normalize_numeric_ocr, normalize_alpha_ocr, DIGIT_FROM_CHAR_MAP
from backend.extractors.validators import (
    clean_text,
    validate_dni,
    validate_ce,
    normalize_and_validate_date,
    normalize_sex,
    PERU_DEPARTMENTS,
    separate_concatenated_names,
)


@dataclass
class FieldExtractionResult:
    field_key: str
    value: str = ""
    confidence: float = 0.0
    is_valid: bool = True
    status: str = "CONFIRMADO"  # "CONFIRMADO" | "REVISAR" | "NO_DETECTADO"
    origin_type: str = "LEIDO_OCR"
    validation_message: Optional[str] = None
    anchor_matched: Optional[str] = None
    alternate_candidates: List[str] = field(default_factory=list)


# Words that must not be assigned as personal names or surnames
DISALLOWED_NAME_KEYWORDS = [
    "NO CADUCA", "CADUCA", "CADUCIDAD", "EMISION", "EMISIÓN", "INSCRIPCION", "INSCRIPCIÓN",
    "NACIMIENTO", "REPUBLICA", "REPÚBLICA", "PERU", "PERÚ", "DOCUMENTO", "NACIONAL",
    "IDENTIDAD", "VOTACION", "DONACION", "ORGANOS", "ÓRGANOS", "SEXO", "ESTADO", "CIVIL",
    "DOMICILIO", "DIRECCION", "DIRECCIÓN", "UBIGEO", "REGISTRO", "RENIEC", "PRIMER",
    "SEGUNDO", "APELLIDO", "APELLIDOS", "PRENOMBRES", "PRENOMBRE", "NOMBRE", "NOMBRES",
    "FECHA", "LUGAR", "DIGITO", "VERIFICACION", "FIRMA", "HUELLA", "TITULAR", "ELECTRONICO",
    "SUPERINTENDENCIA", "MIGRACIONES", "EXTRANJERIA", "CALIDAD", "MIGRATORIA", "FOTO",
    "FOTOGRAFIA", "FOTOGRAFÍA", "NACIONALIDAD", "NATIONALITY", "PER", "CUI", "NRO",
    "TARJETA", "CHIP", "CAN", "MASCULINO", "FEMENINO", "SOLTERO", "SOLTERA", "CASADO",
    "CASADA", "VIUDO", "VIUDA", "DIVORCIADO", "DIVORCIADA", "SURNAMES", "GIVEN", "NAMES",
    "DATE", "BIRTH", "EXPIRY", "ISSUE", "ESTE", "CARNE", "CARNET", "INVALIDA", "ANTERIOR",
    "REPUBLICADELPERU", "PASAPORTE", "CEDULA", "NPCIP", "STATUS", "MARITAL"
]


def is_valid_name_token(token: str) -> bool:
    """Verifies that a token is genuinely a personal name or surname."""
    if not token or len(token) < 2:
        return False
    clean = token.strip().upper()
    # Standalone prepositions and particles cannot be a surname by themselves
    if clean in ["DE", "DEL", "LA", "LAS", "LOS", "SAN", "SANTA", "EL", "Y", "E", "AL"]:
        return False
    if clean in DISALLOWED_NAME_KEYWORDS:
        return False
    if any(kw == clean for kw in DISALLOWED_NAME_KEYWORDS):
        return False
    # Avoid tokens that start with administrative prefixes or document labels
    admin_prefixes = [
        "FECHA", "FEC", "PEEN", "NACIONAL", "REPUBLICA", "DOCUMENTO", "CARNE", "CARNET", "INVALID",
        "PRIMER", "SEGUND", "BOGURD", "BOGUND", "PRENOM", "APEL", "NOMBR", "CALID", "MIGRAT", "MIGRAC",
        "EXTRANJ", "SUPERINT", "ESTADO", "CIVIL", "SUFRAGIO", "VOTACION", "INSCRIP", "EMIS", "EMIN"
    ]
    if any(clean.startswith(pref) for pref in admin_prefixes):
        return False
    if any(pref in clean for pref in ["MIGRAT", "MIGRAC", "EXTRANJ", "REPUBLIC", "SUPERINT", "CALID", "EMISION", "EMINIO", "APPLID", "APELID"]):
        return False
    # Must be mostly alphabetic
    letters = sum(1 for c in clean if c.isalpha())
    if letters < 2 or letters < len(clean) * 0.75:
        return False
    return True


def compute_mrz_check_digit(data: str) -> int:
    """Computes ICAO Doc 9303 check digit with 7-3-1 weight matrix."""
    weights = [7, 3, 1]
    total = 0
    for i, ch in enumerate(data):
        if ch.isdigit():
            val = int(ch)
        elif ch.isalpha():
            val = ord(ch.upper()) - 55  # 'A' = 10, 'Z' = 35
        elif ch in ["<", " "]:
            val = 0
        else:
            val = 0
        total += val * weights[i % 3]
    return total % 10


def parse_icao_td1_mrz_robust(mrz_text: str) -> Optional[Dict[str, Any]]:
    """
    Robust ICAO Doc 9303 TD1 (3 lines, ~30 chars each) parser for Peruvian DNI and CE.
    Handles common OCR delimiter misrecognitions (K, X, «, ‹, spaces, brackets).
    Tolerates character confusion in numeric zones (O->0, I/l/|->1, S->5, Z->2, B->8).
    Correctly resolves DNI (8 digits), Birth Date (DD/MM/YYYY), Sex (M/F), and Expiry.
    """
    if not mrz_text:
        return None

    raw_lines = [l.strip().upper() for l in mrz_text.split("\n") if l.strip()]
    cleaned_lines = []

    for line in raw_lines:
        has_mrz_marker = "<" in line or "«" in line or "‹" in line or "<<" in line
        is_l1_sig = bool(re.search(r"(?:[I1]<PER|[I1]DPER|<PER|PER[0-9A-Z]{8}|[I1]<[0-9A-Z]{8})", line.replace(" ", "")))
        is_l2_sig = bool(re.search(r"[0-9A-Z]{6}[0-9A-Z<]?[MF<].*PER", line.replace(" ", "")))

        # Skip non-MRZ visual headers unless they have authentic MRZ delimiters
        if any(k in line for k in ["REPUBLICA", "DOCUMENTO NACIONAL", "ESTADO CIVIL", "PRENOMBRES", "PRIMER APELLIDO"]) and not has_mrz_marker:
            continue

        if not (has_mrz_marker or is_l1_sig or is_l2_sig):
            continue

        # Preserve spaces by converting to '<' delimiter
        clean = line.replace("«", "<<").replace("‹", "<").replace(" ", "<")
        clean = re.sub(r"[>_~|\[\]\(\)\{\}\:]+", "<", clean)
        # Collapse 3 or more '<' to '<<' or single '<' without destroying '<<'
        clean = re.sub(r"<{3,}", "<<", clean)
        if len(clean) >= 8:
            cleaned_lines.append(clean)

    if not cleaned_lines:
        return None

    line1 = None
    line2 = None
    line3 = None

    # Pass 1: Identify Line 1 (Document Number / DNI)
    for line in cleaned_lines:
        # Match Peruvian ICAO TD1 header prefix + 8 alphanumeric chars
        m1_cand = re.search(r"(?:[I1]<PER|[I1]DPER|<PER|PER|[I1]<|[I1]D)<*([0-9A-Z]{8})", line)
        if m1_cand:
            norm_dni = normalize_numeric_ocr(m1_cand.group(1))
            if len(norm_dni) == 8 and norm_dni.isdigit():
                line1 = line
                break
        elif (line.startswith(("I<", "1<", "ID<", "IDPER", "<PER", "IPER")) or "PER" in line) and len(line) >= 12:
            # Check if there is an 8-char block
            m_any8 = re.search(r"PER<*([0-9A-Z]{8})", line)
            if m_any8:
                line1 = line
                break
            elif not line1:
                line1 = line

    # Pass 2: Identify Line 2 (DOB, Sex, Expiry)
    for line in cleaned_lines:
        if line != line1:
            # Match 6 alphanumeric chars (YYMMDD) followed by optional cd, sex (M/F/<), and expiry/PER
            m2_cand = re.search(r"([0-9A-Z]{6})<*([0-9A-Z<]*)<*([MF<])", line)
            if m2_cand:
                norm_dob = normalize_numeric_ocr(m2_cand.group(1))
                if len(norm_dob) == 6 and norm_dob.isdigit():
                    mm = int(norm_dob[2:4])
                    dd = int(norm_dob[4:6])
                    if 1 <= mm <= 12 and 1 <= dd <= 31:
                        line2 = line
                        break
            elif "PER" in line and any(c.isdigit() for c in line) and any(s in line for s in ["M", "F"]):
                line2 = line
                break
            elif re.search(r"\d{6}[0-9A-Z<][MF<](\d{6}|[0-9A-Z<]{6})", line):
                line2 = line
                break

    # Pass 3: Identify Line 3 (Surnames and Given Names)
    for line in cleaned_lines:
        if line != line1 and line != line2:
            if any(k in line for k in ["ESTADO", "CIVIL", "SEXO", "DOCUMENTO", "REPUBLICA", "PERU", "NACIONAL"]):
                continue
            if ("<" in line or "<<" in line) and any(c.isalpha() for c in line) and not re.search(r"\d{6}", line):
                line3 = line
                break

    if not line3:
        for line in cleaned_lines:
            if line != line1 and line != line2 and len(line) >= 8:
                if not any(k in line for k in ["ESTADO", "CIVIL", "SEXO", "DOCUMENTO", "REPUBLICA", "PERU"]):
                    line3 = line
                    break

    parsed: Dict[str, Any] = {}

    # Line 1: DNI (8 digits) + Check Digit
    if line1:
        # Match DNI (8 alphanumeric chars) and following check digit or delimiter
        m1 = re.search(r"(?:[I1]<PER|[I1]DPER|<PER|PER|[I1]<|[I1]D)?<*([0-9A-Z]{8})<*([0-9A-Z<]?)", line1)
        if m1:
            raw_dni = m1.group(1)
            raw_cd = m1.group(2)
            norm_dni = normalize_numeric_ocr(raw_dni)
            val_ok, valid_dni, _ = validate_dni(norm_dni)

            # Check digit validation (ICAO 9303 TD1: pos 6-14 with 7-3-1 weight matrix)
            dni_checksum_valid = False
            norm_cd = normalize_numeric_ocr(raw_cd) if raw_cd else ""
            if norm_cd and norm_cd.isdigit():
                found_cd = int(norm_cd)
                # Check both with '<' padding (standard TD1 9-char document field) and unpadded
                if compute_mrz_check_digit(valid_dni + "<") == found_cd or compute_mrz_check_digit(valid_dni) == found_cd:
                    dni_checksum_valid = True
                else:
                    # Attempt single character substitution correction using checksum
                    for idx, ch in enumerate(raw_dni):
                        if ch in DIGIT_FROM_CHAR_MAP:
                            cand_dni = list(norm_dni)
                            for alt_digit in ["0", "1", "2", "3", "5", "6", "8"]:
                                cand_dni[idx] = alt_digit
                                cand_str = "".join(cand_dni)
                                if (compute_mrz_check_digit(cand_str + "<") == found_cd or
                                        compute_mrz_check_digit(cand_str) == found_cd):
                                    valid_dni = cand_str
                                    val_ok = True
                                    dni_checksum_valid = True
                                    break
                            if dni_checksum_valid:
                                break

            if val_ok:
                parsed["dni"] = valid_dni
                parsed["dni_verified_by_checksum"] = dni_checksum_valid

    # Line 2: DOB, Sex, Expiry + Check Digits
    if line2:
        m2 = re.search(r"([0-9A-Z]{6})<*([0-9A-Z<]*)<*([MF])<*([0-9A-Z<]{6})?<*([0-9A-Z<]?)", line2)
        if not m2:
            m2 = re.search(r"([0-9A-Z]{6})<*([0-9A-Z<]?)\s*([MF<])<*([0-9A-Z<]{6})?<*([0-9A-Z<]?)", line2)
        if m2:
            raw_dob = m2.group(1)
            raw_dob_cd = m2.group(2)
            norm_dob = normalize_numeric_ocr(raw_dob)
            dob_checksum_valid = False

            if len(norm_dob) == 6 and norm_dob.isdigit():
                norm_dob_cd = normalize_numeric_ocr(raw_dob_cd) if raw_dob_cd else ""
                if norm_dob_cd and norm_dob_cd.isdigit():
                    if compute_mrz_check_digit(norm_dob) == int(norm_dob_cd):
                        dob_checksum_valid = True

                yy = int(norm_dob[0:2])
                mm = norm_dob[2:4]
                dd = norm_dob[4:6]
                if 1 <= int(mm) <= 12 and 1 <= int(dd) <= 31:
                    curr_yy = datetime.now().year % 100
                    # Adult worker century resolution: threshold (curr_yy - 15)
                    # For curr_yy=26: 00-11 -> 2000-2011 (age 15-26); 12-99 -> 1912-1999
                    threshold = max(0, curr_yy - 15)
                    full_year = 2000 + yy if yy <= threshold else 1900 + yy
                    parsed["birth_date"] = f"{dd}/{mm}/{full_year}"
                    parsed["birth_date_verified_by_checksum"] = dob_checksum_valid

            raw_sex = m2.group(3)
            if raw_sex in ["M", "F"]:
                parsed["sex"] = raw_sex

            raw_exp = m2.group(4)
            raw_exp_cd = m2.group(5)
            if raw_exp:
                norm_exp = normalize_numeric_ocr(raw_exp)
                exp_checksum_valid = False
                if norm_exp in ["000101", "000000", "999999"] or "<<<<" in raw_exp:
                    parsed["expiry_date"] = "NO CADUCA"
                    parsed["expiry_date_verified_by_checksum"] = True
                elif len(norm_exp) == 6 and norm_exp.isdigit():
                    norm_exp_cd = normalize_numeric_ocr(raw_exp_cd) if raw_exp_cd else ""
                    if norm_exp_cd and norm_exp_cd.isdigit():
                        if compute_mrz_check_digit(norm_exp) == int(norm_exp_cd):
                            exp_checksum_valid = True

                    exp_yy = int(norm_exp[0:2])
                    exp_mm = norm_exp[2:4]
                    exp_dd = norm_exp[4:6]
                    if 1 <= int(exp_mm) <= 12 and 1 <= int(exp_dd) <= 31:
                        parsed["expiry_date"] = f"{exp_dd}/{exp_mm}/20{exp_yy:02d}"
                        parsed["expiry_date_verified_by_checksum"] = exp_checksum_valid

    # Line 3: Surnames & First Names
    if line3:
        norm3 = re.sub(r"(?<=[A-Z])(KK|KX|XK|XX|K<|<K|X<|<X)(?=[A-Z])", "<<", line3)
        norm3 = re.sub(r"(?<=[A-Z])(K|<|X){2,}(?=[A-Z])", "<<", norm3)
        norm3 = re.sub(r"(?<=[A-Z])(K|X)(?=[A-Z])", "<", norm3)
        norm3 = re.sub(r"[<KX]+$", "", norm3)

        if "<<" in norm3:
            raw_parts = [p.replace("<", " ").strip() for p in norm3.split("<<") if p.replace("<", " ").strip()]
            if len(raw_parts) >= 3:
                s_tokens1 = [t for t in raw_parts[0].split() if is_valid_name_token(t)]
                s_tokens2 = [t for t in raw_parts[1].split() if is_valid_name_token(t)]
                n_tokens = [t for t in " ".join(raw_parts[2:]).split() if is_valid_name_token(t)]
                if s_tokens1:
                    parsed["paternal_surname"] = " ".join(s_tokens1)
                if s_tokens2:
                    parsed["maternal_surname"] = " ".join(s_tokens2)
                if n_tokens:
                    parsed["first_names"] = separate_concatenated_names(" ".join(n_tokens))
            elif len(raw_parts) == 2:
                s_tokens = [t for t in raw_parts[0].split() if is_valid_name_token(t)]
                n_tokens = [t for t in raw_parts[1].split() if is_valid_name_token(t)]
                if len(s_tokens) >= 2:
                    parsed["paternal_surname"] = s_tokens[0]
                    parsed["maternal_surname"] = " ".join(s_tokens[1:])
                elif len(s_tokens) == 1:
                    parsed["paternal_surname"] = s_tokens[0]
                if n_tokens:
                    parsed["first_names"] = separate_concatenated_names(" ".join(n_tokens))
            elif len(raw_parts) == 1:
                tokens = [t for t in raw_parts[0].split() if is_valid_name_token(t)]
                if tokens:
                    parsed["paternal_surname"] = tokens[0]
        else:
            # Single delimiter fallback: e.g. MENDEZ<BETY<VALERIANA
            tokens = [t for t in norm3.split("<") if is_valid_name_token(t)]
            if len(tokens) >= 2:
                parsed["paternal_surname"] = tokens[0]
                parsed["first_names"] = separate_concatenated_names(" ".join(tokens[1:]))
            elif len(tokens) == 1:
                parsed["paternal_surname"] = tokens[0]

    return parsed if parsed else None


class SemanticExtractor:
    """
    Extracts structured identification fields by traversing line text and anchor proximity,
    supporting all Peruvian DNI models (Azul, Blanco, DNIe) and Carnet de Extranjería.
    """

    @staticmethod
    def determine_field_status(conf: float, is_valid: bool) -> str:
        """Assigns the 3-tier status badge."""
        if not is_valid or conf < 40.0:
            return "NO_DETECTADO"
        elif conf >= 80.0:
            return "CONFIRMADO"
        else:
            return "REVISAR"

    @staticmethod
    def extract_dni_number(
        ocr_lines: List[OCRLine],
        mrz_data: Optional[Dict[str, Any]],
        candidate_pool: Optional[List[Tuple[str, float, str]]] = None,
    ) -> FieldExtractionResult:
        """Semantic extraction of 8-digit DNI number."""
        # 1. Check MRZ (Absolute highest confidence: 99.0% - 99.8% with verified checksum)
        if mrz_data and mrz_data.get("dni"):
            dni_val = mrz_data["dni"]
            val_ok, norm_val, err_msg = validate_dni(dni_val)
            if val_ok:
                is_checksum_verified = mrz_data.get("dni_verified_by_checksum", False)
                return FieldExtractionResult(
                    field_key="doc_number",
                    value=norm_val,
                    confidence=99.8 if is_checksum_verified else 99.0,
                    is_valid=True,
                    status="CONFIRMADO",
                    origin_type="LEIDO_MRZ_VALIDADO" if is_checksum_verified else "LEIDO_OCR",
                    anchor_matched="MRZ ICAO TD1 (Dígito de control verificado)" if is_checksum_verified else "MRZ ICAO TD1",
                )

        # 2. Check Candidate Pool from Multi-Variant Consensus (excluding dates)
        if candidate_pool:
            from backend.ocr.consensus_engine import evaluate_field_consensus
            valid_pool = []
            for cand_val, cand_w, cand_src in candidate_pool:
                if len(cand_val) == 8 and cand_val.isdigit():
                    d_c, m_c, y_c = int(cand_val[:2]), int(cand_val[2:4]), int(cand_val[4:])
                    if 1 <= d_c <= 31 and 1 <= m_c <= 12 and (1930 <= y_c <= 2040):
                        continue
                valid_pool.append((cand_val, cand_w, cand_src))

            if valid_pool:
                win_val, win_conf, votes, total = evaluate_field_consensus("", valid_pool, is_numeric=True)
                val_ok, norm_val, err_msg = validate_dni(win_val)
                if val_ok:
                    status = "CONFIRMADO" if win_conf >= 80.0 else "REVISAR"
                    return FieldExtractionResult(
                        field_key="doc_number",
                        value=norm_val,
                        confidence=win_conf,
                        is_valid=True,
                        status=status,
                        origin_type="LEIDO_OCR",
                        anchor_matched=f"Consenso Multi-Intento ({votes}/{total} votos)",
                    )

        # 3. Anchor search in OCR lines (DNI label, header, or attached prefix)
        for i, line in enumerate(ocr_lines):
            t = line.text.upper()
            if any(k in t for k in ["DNI", "N°", "Nº", "NUMERO", "DOCUMENTO"]):
                # Look for DNI followed by 8 digits, even if attached like DNI71795391.1
                m_dni = re.search(r"(?:DNI|DOC(?:UMENTO)?|N[°º.]?|NUMERO)?\s*([0-9OIlLSZB]{8})(?:[.\-]\d)?", t)
                if m_dni:
                    norm = normalize_numeric_ocr(m_dni.group(1))
                    val_ok, norm_val, err_msg = validate_dni(norm)
                    if val_ok:
                        return FieldExtractionResult(
                            field_key="doc_number",
                            value=norm_val,
                            confidence=max(85.0, line.confidence),
                            is_valid=True,
                            status="CONFIRMADO",
                            origin_type="LEIDO_OCR",
                            anchor_matched=line.text,
                        )
                elif i + 1 < len(ocr_lines):
                    next_t = ocr_lines[i+1].text.upper()
                    # Make sure next line is not a date under Fecha de Emision/Inscripcion
                    if not any(k in t for k in ["FECHA", "EMISION", "INSCRIPCION", "CADUCIDAD"]):
                        m2 = re.search(r"\b([0-9OIlLSZB]{8})\b", next_t)
                        if m2:
                            norm = normalize_numeric_ocr(m2.group(1))
                            val_ok, norm_val, err_msg = validate_dni(norm)
                            if val_ok:
                                return FieldExtractionResult(
                                    field_key="doc_number",
                                    value=norm_val,
                                    confidence=max(78.0, ocr_lines[i+1].confidence),
                                    is_valid=True,
                                    status="CONFIRMADO",
                                    origin_type="LEIDO_OCR",
                                    anchor_matched=line.text,
                                )

        # 4. Fallback search for any 8 digits in full document (excluding dates and suffrage codes)
        for line in ocr_lines:
            t = line.text.upper()
            if any(k in t for k in ["FECHA", "EMISION", "INSCRIPCION", "CADUCIDAD", "NACIMIENTO", "VOTACION", "GRUPO", "MESA"]):
                continue
            m = re.search(r"\b(\d{8})\b", line.text)
            if m:
                cand_num = m.group(1)
                # Check if it looks like a valid date DDMMYYYY e.g. 08052008
                day_cand = int(cand_num[:2])
                month_cand = int(cand_num[2:4])
                year_cand = int(cand_num[4:])
                if 1 <= day_cand <= 31 and 1 <= month_cand <= 12 and 1930 <= year_cand <= 2035:
                    continue
                val_ok, norm_val, err_msg = validate_dni(cand_num)
                if val_ok:
                    return FieldExtractionResult(
                        field_key="doc_number",
                        value=norm_val,
                        confidence=65.0,
                        is_valid=True,
                        status="REVISAR",
                        origin_type="LEIDO_OCR",
                        validation_message="Detectado sin etiqueta explícita de DNI. Confirmar.",
                    )

        # If completely absent
        return FieldExtractionResult(
            field_key="doc_number",
            value="",
            confidence=0.0,
            is_valid=False,
            status="NO_DETECTADO",
            origin_type="LEIDO_OCR",
            validation_message="No se detectó el número de DNI con suficiente claridad.",
        )
