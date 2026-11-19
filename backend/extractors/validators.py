import re
import difflib
from datetime import datetime
from typing import Tuple, Optional

# Month abbreviations in Spanish
SPANISH_MONTHS = {
    "ENE": "01", "ENERO": "01",
    "FEB": "02", "FEBRERO": "02",
    "MAR": "03", "MARZO": "03",
    "ABR": "04", "ABRIL": "04",
    "MAY": "05", "MAYO": "05",
    "JUN": "06", "JUNIO": "06",
    "JUL": "07", "JULIO": "07",
    "AGO": "08", "AGOSTO": "08",
    "SET": "09", "SEP": "09", "SETIEMBRE": "09", "SEPTIEMBRE": "09",
    "OCT": "10", "OCTUBRE": "10",
    "NOV": "11", "NOVIEMBRE": "11",
    "DIC": "12", "DICIEMBRE": "12",
}

# Standard Peruvian Departments for Ubigeo validation
PERU_DEPARTMENTS = [
    "AMAZONAS", "ANCASH", "APURIMAC", "AREQUIPA", "AYACUCHO", "CAJAMARCA",
    "CALLAO", "CUSCO", "HUANCAVELICA", "HUANUCO", "ICA", "JUNIN",
    "LA LIBERTAD", "LAMBAYEQUE", "LIMA", "LORETO", "MADRE DE DIOS",
    "MOQUEGUA", "PASCO", "PIURA", "PUNO", "SAN MARTIN", "TACNA",
    "TUMBES", "UCAYALI"
]

# Common Peruvian Given Names for separating concatenated names
COMMON_PERU_GIVEN_NAMES = {
    "AARON", "ABEL", "ABRAHAM", "ADA", "ADAN", "ADELA", "ADOLFO", "ADRIAN", "ADRIANA",
    "AGUSTIN", "AIDA", "ALAN", "ALBERTO", "ALEJANDRA", "ALEJANDRO", "ALEX", "ALEXA",
    "ALEXANDER", "ALEXANDRA", "ALEXIS", "ALFONSO", "ALFREDO", "ALICIA", "ALINA", "ALVARO",
    "AMALIA", "AMANDA", "AMERICO", "ANA", "ANALI", "ANASTACIA", "ANDREA", "ANDRES",
    "ANGEL", "ANGELA", "ANGELICA", "ANIBAL", "ANITA", "ANTONIA", "ANTONIO", "ARMANDO",
    "ARNALDO", "ARTURO", "AUGUSTO", "AURELIO", "AURORA", "BEATRIZ", "BENJAMIN", "BERTHA",
    "BETY", "BETTY", "BLANCA", "BORIS", "BRAULIO", "BRENDA", "BRYAN", "CAMILA", "CARIDAD",
    "CARLA", "CARLOS", "CARMEN", "CAROLINA", "CECILIA", "CELIA", "CESAR", "CHRISTIAN",
    "CINTHIA", "CINTIA", "CLAUDIA", "CLAUDIO", "CLELIA", "CONSUELO", "CRISTHIAN", "CRISTIAN",
    "CRISTINA", "CYNTHIA", "DAISY", "DANIEL", "DANIELA", "DARIO", "DAVID", "DEBORA",
    "DELIA", "DENIS", "DENISSE", "DENNIS", "DIANA", "DIEGO", "DINA", "DIONISIO", "DOMINGO",
    "DORA", "DORIS", "EDGAR", "EDGARDO", "EDILBERTO", "EDITH", "EDSON", "EDUARDO", "EDWIN",
    "EFRAIN", "ELBA", "ELENA", "ELIA", "ELIAN", "ELIAS", "ELISA", "ELIZABETH", "ELMER",
    "ELOY", "ELSA", "ELVIRA", "EMILIA", "EMILIANO", "EMILIO", "EMMA", "ENRIQUE", "ERICH",
    "ERICK", "ERIKA", "ERNESTO", "ESMERALDA", "ESPERANZA", "ESTEBAN", "ESTELA", "ESTHER",
    "EUGENIO", "EVA", "EVELYN", "EVER", "FABIAN", "FABIOLA", "FATIMA", "FEDERICO", "FELICIA",
    "FELICITA", "FELIPE", "FELIX", "FERMIN", "FERNANDO", "FIORELLA", "FLAVIA", "FLAVIO",
    "FLOR", "FLORA", "FORTUNATO", "FRANCISCA", "FRANCISCO", "FRANK", "FRANKLIN", "FREDDY",
    "FREDI", "FREDY", "GABRIEL", "GABRIELA", "GENARO", "GERARDO", "GERMAN", "GIOVANNA",
    "GISELA", "GISELLA", "GLADYS", "GLORIA", "GONZALO", "GRACIELA", "GREGORIO", "GUADALUPE",
    "GUILLERMO", "GUSTAVO", "HAYDEE", "HECTOR", "HELEN", "HENRY", "HERBERT", "HERNAN",
    "HILARIO", "HILDA", "HILDEBRANDO", "HONORATO", "HUGO", "HUMBERTO", "IGNACIO", "INES",
    "INGRID", "IRENE", "IRMA", "ISABEL", "ISIDRO", "ISMAEL", "IVAN", "IVONNE", "JACINTO",
    "JAIME", "JANET", "JAVIER", "JEAN", "JENNY", "JESSICA", "JESUS", "JHON", "JHONATAN",
    "JHONY", "JIMMY", "JOEL", "JOHAN", "JOHANA", "JORGE", "JOSE", "JOSEFA", "JOSEFINA",
    "JOSELYN", "JOSHUA", "JOSUE", "JUAN", "JUANA", "JUDITH", "JULIA", "JULIAN", "JULIO",
    "JUNIOR", "JUSTO", "KAREN", "KARINA", "KARLA", "KATHERINE", "KATTY", "KEVIN", "LEILA",
    "LEONARDO", "LEONCIO", "LEONOR", "LEOPOLDO", "LESLIE", "LEYDI", "LIDIA", "LILIANA",
    "LINA", "LINO", "LIZ", "LIZBETH", "LORENA", "LOURDES", "LUCERO", "LUCIA", "LUCIANA",
    "LUCIANO", "LUCIO", "LUCRECIA", "LUIS", "LUISA", "LUPE", "LUZ", "MAGALI", "MAGALY",
    "MAGDALENA", "MANUEL", "MANUELA", "MARCELA", "MARCELINO", "MARCELO", "MARCIAL", "MARCO",
    "MARCOS", "MARGARITA", "MARIA", "MARIANA", "MARIANO", "MARIBEL", "MARINA", "MARIO",
    "MARISOL", "MARITZA", "MARLENE", "MARTA", "MARTHA", "MARTIN", "MARY", "MATILDE",
    "MAURA", "MAURICIO", "MAURO", "MAX", "MAXIMO", "MAYRA", "MELANIE", "MELCHOR", "MELISSA",
    "MERCEDES", "MIA", "MICHAEL", "MIGUEL", "MILAGROS", "MIRIAM", "MIRTHA", "MOISES",
    "MONICA", "MYRIAM", "NADIA", "NANCY", "NATALIA", "NATALY", "NELLY", "NELSON", "NESTOR", "NICOLAS",
    "NIDIA", "NILDA", "NILO", "NILVER", "NOEMI", "NORA", "NORMA", "OCTAVIO", "OLGA", "ORLANDO",
    "OSCAR", "OSWALDO", "PABLO", "PAOLA", "PAOLO", "PATRICIA", "PATRICIO", "PAULA", "PAULINA",
    "PAULO", "PEDRO", "PERCY", "PILAR", "RAFAEL", "RAIZA", "RAMIRO", "RAMON", "RAQUEL",
    "RAUL", "REBECA", "REGINA", "RENAN", "RENATO", "RENE", "RENEE", "RICARDO", "RICHARD",
    "RITA", "ROBERT", "ROBERTO", "ROCIO", "RODOLFO", "RODRIGO", "ROGELIO", "ROGER", "ROLANDO",
    "ROMAN", "ROMEL", "ROMINA", "RONALD", "ROQUE", "ROSA", "ROSALIA", "ROSARIO", "ROSAURA",
    "ROXANA", "RUBEN", "RUTH", "SABINA", "SAMUEL", "SANDRA", "SANTIAGO", "SANTOS", "SARA",
    "SAUL", "SEBASTIAN", "SEGUNDO", "SERGIO", "SEYDA", "SILVIA", "SILVIO", "SIMON", "SOFIA", "SOL",
    "SONIA", "STEPHANIE", "SUSANA", "TANIA", "TERESA", "TOMAS", "URIEL", "URSULA", "VALENTIN",
    "VALENTINA", "VALERIA", "VALERIANA", "VANESSA", "VERONICA", "VESTALY", "VICENTE", "VICTOR",
    "VICTORIA", "VILMA", "VIRGILIO", "VIRGINIA", "VLADIMIR", "WALTER", "WASHINGTON",
    "WILDER", "WILFREDO", "WILLIAMS", "WILLIAM", "WILLY", "WILMER", "WILSON", "YADIRA",
    "YANET", "YENI", "YENNY", "YESENIA", "YESSICA", "YOLANDA", "YOSHI", "YURI", "ZULEMA",
    "DANEILYS", "ROSMERY", "DAYANA", "DAHIANA", "GENESIS", "YOSELIN", "CORINA"
}

# Common Peruvian Surnames for splitting concatenated OCR words
COMMON_PERU_SURNAMES = {
    "ESTRADA", "CHAYCHA", "QUISPE", "FLORES", "RODRIGUEZ", "SANCHEZ", "GARCIA", "ROJAS",
    "DIAZ", "TORRES", "LOPEZ", "GONZALES", "GONZALEZ", "PEREZ", "VASQUEZ", "MENDOZA",
    "ESPINOZA", "CASTILLO", "HUAMAN", "RAMOS", "VARGAS", "GUTIERREZ", "REYES", "CHAVEZ",
    "HERRERA", "MAMANI", "CRUZ", "CACERES", "ALVAREZ", "ROMERO", "FERNANDEZ", "RIVERA",
    "MORALES", "CASTRO", "AGUILAR", "VALVERDE", "CARDENAS", "CHACON", "CACIO", "CABRERA",
    "MEJIA", "CONTRERAS", "SALAZAR", "SILVA", "DELGADO", "MEDINA", "VEGA", "CAMPOS",
    "GUERRERO", "SOTO", "CARRASCO", "CORDOVA", "PAREDES", "CALDERON", "ACOSTA", "PARAGUACUTO",
    "GUTIERREZ", "MENDEZ", "DOMINGUEZ", "MONZON", "ROSAS", "PALACIOS", "ZAVALETA",
    "VALENZUELA", "CAMPOS", "TINUCO", "PACHECO", "CONDORI", "TAPIA", "CORONADO", "ORTEGA"
}


def correct_ocr_name_typos(text: str) -> str:
    """
    Corrects common OCR character confusions in Peruvian given names against known name dictionary.
    (e.g., 'DAVIG' -> 'DAVID', 'JUANDAVIO' -> 'JUAN DAVID').
    """
    if not text:
        return text
    tokens = text.split()
    corrected = []
    for tok in tokens:
        clean_tok = re.sub(r"[^A-Za-z]", "", tok.upper())
        if clean_tok in COMMON_PERU_GIVEN_NAMES:
            corrected.append(clean_tok)
        elif len(clean_tok) >= 4:
            matches = difflib.get_close_matches(clean_tok, list(COMMON_PERU_GIVEN_NAMES), n=1, cutoff=0.75)
            if matches:
                corrected.append(matches[0])
            else:
                corrected.append(clean_tok)
        else:
            corrected.append(clean_tok)
    return " ".join(corrected)


def correct_ocr_surname_typos(text: str) -> str:
    """
    Corrects common OCR character confusions in Peruvian surnames against known surname dictionary.
    (e.g., 'DOMINGUDY' -> 'DOMINGUEZ').
    """
    if not text:
        return text
    tokens = text.split()
    corrected = []
    for tok in tokens:
        clean_tok = re.sub(r"[^A-Za-z]", "", tok.upper())
        if clean_tok in COMMON_PERU_SURNAMES:
            corrected.append(clean_tok)
        elif len(clean_tok) >= 5:
            matches = difflib.get_close_matches(clean_tok, list(COMMON_PERU_SURNAMES), n=1, cutoff=0.72)
            if matches:
                corrected.append(matches[0])
            else:
                corrected.append(clean_tok)
        else:
            corrected.append(clean_tok)
    return " ".join(corrected)


def separate_concatenated_surnames(text: str) -> Tuple[str, str]:
    """
    Separates two surnames that were glued together by OCR (e.g. 'ESTRADACHAYCHA' -> ('ESTRADA', 'CHAYCHA')).
    Returns: (paternal_surname, maternal_surname)
    """
    if not text:
        return "", ""
    clean = re.sub(r"[^A-Za-z]", "", text.strip().upper())
    if len(clean) < 6:
        return clean, ""
        
    # Check against known surname dictionary
    for i in range(3, len(clean) - 2):
        p1, p2 = clean[:i], clean[i:]
        if p1 in COMMON_PERU_SURNAMES and p2 in COMMON_PERU_SURNAMES:
            return p1, p2
            
    # Try with first part in dictionary and second part having valid syllable length
    for i in range(4, len(clean) - 3):
        p1, p2 = clean[:i], clean[i:]
        if p1 in COMMON_PERU_SURNAMES and len(p2) >= 4:
            return p1, p2
            
    return clean, ""


def separate_concatenated_names(text: str) -> str:
    """
    Separates names that have been concatenated without spaces by OCR
    (e.g., 'BETYVALERIANA' -> 'BETY VALERIANA', 'JUANCARLOS' -> 'JUAN CARLOS').
    """
    if not text:
        return text

    clean = text.strip()
    tokens = clean.split()
    res_tokens = []

    for tok in tokens:
        tok_upper = re.sub(r"[^A-Za-z]", "", tok.upper())
        # If token is long and not in name dictionary as a standalone name
        if len(tok_upper) >= 6 and tok_upper not in COMMON_PERU_GIVEN_NAMES:
            split_found = False
            # Try splitting into two known names
            for i in range(3, len(tok_upper) - 2):
                p1, p2 = tok_upper[:i], tok_upper[i:]
                if p1 in COMMON_PERU_GIVEN_NAMES and p2 in COMMON_PERU_GIVEN_NAMES:
                    res_tokens.extend([p1, p2])
                    split_found = True
                    break
            if not split_found:
                res_tokens.append(tok)
        else:
            res_tokens.append(tok)

    return " ".join(res_tokens)


def is_invalid_address_candidate(text: str) -> bool:
    """
    Validates whether a line text can possibly be a Peruvian street address.
    Rejects barcode numbers, voting group codes, pure digit sequences, and standalone administrative headers.
    Allows genuine addresses containing caseríos, anexos, asentamientos, calles, avenidas, jirones, etc.
    """
    if not text or len(text.strip()) < 3:
        return True

    t = text.strip().upper()

    # 1. Reject pure digits, spaces, dots, dashes, slashes (e.g. '000025 000025 021843 0005 96180309')
    if re.match(r"^[\d\s\-\.\,\/]+$", t):
        return True

    # 2. Clean out administrative headers if combined in the line
    cleaned_t = re.sub(
        r"\b(DOMICILIO\s+Y\s+CONSTANCIAS(\s+DE\s+SUFRAGIO)?|CONSTANCIAS(\s+DE\s+SUFRAGIO)?|CONSTANCIA(\s+DE\s+SUFRAGIO)?|DE\s+SUFRAGIO|SUFRAGIO|CUARTO\s*NIVEL|CUARTONIVEL|CUARTONVEL|REPUBLICA\s+DEL\s+PERU|RENIEC|DONACION(\s+DE\s+ORGANOS)?|ORGANOS|FIRMA|HUELLA)\b",
        "",
        t,
        flags=re.IGNORECASE
    ).strip(" :-/.,")

    if not cleaned_t:
        return True

    # 3. Reject lines where digits heavily outnumber letters (barcodes with minimal text)
    digits_count = sum(c.isdigit() for c in cleaned_t)
    alpha_count = sum(c.isalpha() for c in cleaned_t)
    if alpha_count < 3:
        return True
    if digits_count > (alpha_count * 1.5):
        return True

    # 4. Reject barcode sequences (repeated 4+ digit blocks)
    if re.search(r"^\d{4,}(\s+\d{4,})+$", cleaned_t):
        return True

    # 5. Standalone administrative headers and document labels to reject if the ENTIRE line is just the header
    standalone_headers = [
        "CONSTANCIA", "CONSTANCIAS", "SUFRAGIO", "DE SUFRAGIO", "CONSTANCIAS DE SUFRAGIO",
        "REPUBLICA DEL PERU", "REPUBLICA", "RENIEC", "ELECCIONES", "TRIBUNAL",
        "ORGANOS", "DONACION", "DONACION DE ORGANOS", "FIRMA", "HUELLA",
        "CUARTO NIVEL", "CUARTONIVEL", "CUARTONVEL", "OBSERVACIONES", "OBSERVACION",
        "BSERVACIONES", "BSERVACION", "ESTADO CIVIL", "DEPARTAMENTO", "PROVINCIA", "DISTRITO",
        "FECHA DE NACIMIENTO", "FECHA DE EMISION", "FECHA DE CADUCIDAD", "CADUCIDAD",
        "VOTACION", "GRUPO DE VOTACION", "TITULO DE ELECTOR", "IMPRESION DACTILAR"
    ]
    if cleaned_t in standalone_headers or any(cleaned_t == h for h in standalone_headers):
        return True

    # 6. Reject standalone department names
    for dep in PERU_DEPARTMENTS:
        if cleaned_t == dep:
            return True

    return False


# Civil Status Mapping for Peruvian IDs (S, C, V, D, CO)
CIVIL_STATUS_MAP = {
    "S": "SOLTERO",
    "SOLTERO": "SOLTERO",
    "SOLTERA": "SOLTERO",
    "SINGLE": "SOLTERO",
    "C": "CASADO",
    "CASADO": "CASADO",
    "CASADA": "CASADO",
    "MARRIED": "CASADO",
    "V": "VIUDO",
    "VIUDO": "VIUDO",
    "VIUDA": "VIUDO",
    "WIDOWED": "VIUDO",
    "D": "DIVORCIADO",
    "DIVORCIADO": "DIVORCIADO",
    "DIVORCIADA": "DIVORCIADO",
    "DIVORCED": "DIVORCIADO",
    "CO": "CONVIVIENTE",
    "CONVIVIENTE": "CONVIVIENTE",
}


def clean_text(text: str) -> str:
    """Removes unwanted OCR noise, multiple spaces and invalid characters."""
    if not text:
        return ""
    cleaned = re.sub(r"[\t\r\n]+", " ", text)
    cleaned = re.sub(r"[<>|]+", "", cleaned)
    cleaned = re.sub(r" +", " ", cleaned)
    return cleaned.strip()


def validate_dni(dni_str: str) -> Tuple[bool, str, Optional[str]]:
    """
    Validates Peruvian DNI format (must be exactly 8 digits).
    Handles strict OCR noise character mapping (O->0, I/l->1, S->5, B->8, Z->2)
    ONLY in 8-character numeric contexts without altering ambiguous words.
    Returns: (is_valid, normalized_dni, error_message)
    """
    if not dni_str:
        return False, "", "Número de DNI no detectado"

    raw = str(dni_str).strip().upper()

    # Exact 8 digit standalone pattern (e.g. "02763215")
    m = re.search(r"\b(\d{8})\b", raw)
    if m:
        return True, m.group(1), None

    # Strip punctuation common in DNI headers like "DNI: 02.763.215" or "02763215-2"
    clean_punct = re.sub(r"[\s\.\-\/\:]", "", raw)
    if re.fullmatch(r"\d{8}", clean_punct):
        return True, clean_punct, None

    # Contextual OCR character correction: only if candidate is exactly 8 characters
    # and consists mostly of digits with 1 or 2 classic letter misreads
    OCR_DIGIT_MAP = {"O": "0", "I": "1", "L": "1", "S": "5", "B": "8", "Z": "2"}
    candidate_tokens = re.findall(r"\b[0-9A-Z]{8}\b", raw)
    for cand in candidate_tokens:
        digit_count = sum(c.isdigit() for c in cand)
        # Allow at most 2 substitutions if candidate is >= 6 digits
        if digit_count >= 6:
            fixed = "".join(OCR_DIGIT_MAP.get(c, c) for c in cand)
            if fixed.isdigit() and len(fixed) == 8:
                return True, fixed, None

    # If numeric sequence is extracted
    digits_only = re.sub(r"\D", "", raw)
    if len(digits_only) == 8:
        return True, digits_only, None
    elif len(digits_only) > 8:
        # Might include check digit suffix (e.g. 739689223 -> 73968922)
        return True, digits_only[:8], None
    elif len(digits_only) == 0:
        return False, "", "Número de DNI no detectado"
    else:
        return False, digits_only, f"DNI inválido: debe tener exactamente 8 dígitos (detectados {len(digits_only)})"


def validate_ce(ce_str: str) -> Tuple[bool, str, Optional[str]]:
    """
    Validates Carnet de Extranjería format (usually 9 digits or alphanumeric 7-12 chars).
    Does NOT enforce the 8-digit DNI constraint.
    """
    if not ce_str:
        return False, "", "Número de Carnet de Extranjería no detectado"

    cleaned = re.sub(r"[^A-Za-z0-9]", "", str(ce_str).upper())
    # Standard Migraciones CE is 9 digits (e.g. 001077238, 004455020)
    if cleaned.isdigit() and len(cleaned) == 9:
        return True, cleaned, None
    elif 7 <= len(cleaned) <= 12:
        return True, cleaned, None
    elif len(cleaned) == 0:
        return False, "", "Número de Carnet de Extranjería no detectado"
    else:
        return False, cleaned, f"Formato de CE inusual ({len(cleaned)} caracteres)"


def normalize_and_validate_date(date_raw: str, field_type: Optional[str] = None) -> Tuple[bool, str, Optional[str]]:
    """
    Normalizes a date string into standard DD/MM/AAAA format and verifies calendar validity.
    Handles formats: "15/08/1990", "15-08-1990", "15.08.1990", "15 08 1990", "15081990",
    "1990-08-15" (ISO), "15 AGO 1990", "NO CADUCA".
    Resolves century ambiguity for 2-digit years according to field_type ('birth_date', 'issue_date', 'expiry_date').
    """
    if not date_raw:
        return False, "", "Fecha vacía"

    clean = str(date_raw).upper().strip()

    # Special handling for non-expiring IDs in Peru
    if any(k in clean for k in ["NO CADUCA", "NO CADUC", "NO VENCE", "PERMANENTE", "ILIMITAD", "INDEFINID"]):
        return True, "NO CADUCA", None

    if "00/01/01" in clean or "01/01/0000" in clean or "000101" in clean or "999999" in clean:
        return True, "NO CADUCA", None

    # Replace month text with numbers if present (e.g. '18AGO2000', '15 SET 1990', '22ENE2026')
    for month_name, month_num in SPANISH_MONTHS.items():
        clean = re.sub(rf"(^|\d|\s){month_name}(\d|\s|$)", rf"\g<1> {month_num} \g<2>", clean)
        clean = re.sub(rf"\b{month_name}\b", f" {month_num} ", clean)
    clean = re.sub(r"\s+", " ", clean).strip()

    day, month, year = None, None, None

    # 1. ISO format: YYYY-MM-DD or YYYY/MM/DD
    iso_match = re.search(r"\b(\d{4})[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](0?[1-9]|[12][0-9]|3[01])\b", clean)
    if iso_match:
        year, month, day = iso_match.groups()
    else:
        # 2. Check 3-part date candidate (DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, DD MM YYYY)
        three_part = re.search(r"\b(\d{1,4})[\/\-\.\s]+(\d{1,4})[\/\-\.\s]+(\d{2,4})\b", clean)
        if three_part:
            d_cand, m_cand, y_cand = three_part.groups()
            try:
                d_i, m_i = int(d_cand), int(m_cand)
                if not (1 <= d_i <= 31 and 1 <= m_i <= 12):
                    return False, date_raw, f"Día o mes fuera de rango ({d_cand}/{m_cand})"
                day, month, year = d_cand, m_cand, y_cand
            except ValueError:
                return False, date_raw, f"Formato de fecha inválido ({date_raw})"
        else:
            # 3. Mixed spaced date: e.g. "02 061997" or "0206 1997"
            mixed_match = re.search(r"\b(0[1-9]|[12][0-9]|3[01])\s*(0[1-9]|1[0-2])\s*(\d{4})\b", clean)
            if mixed_match:
                day, month, year = mixed_match.groups()
            else:
                # 4. Compact 8-digit date: e.g. 20092023, 24121996, 17092014, 08052008
                compact_match = re.search(r"\b(0[1-9]|[12][0-9]|3[01])(0[1-9]|1[0-2])(\d{4})\b", clean)
                if compact_match:
                    day, month, year = compact_match.groups()
                else:
                    # 5. Month-Year only (common in CE expiry e.g. ENE 2030 or 01 2030): default day to 01
                    # Only allowed for expiry_date when no day exists
                    if field_type == "expiry_date":
                        my_match = re.search(r"\b(0?[1-9]|1[0-2])[\/\-\.\s]+(\d{4})\b", clean)
                        if my_match:
                            day = "01"
                            month, year = my_match.groups()
                    if not day:
                        return False, date_raw, f"Formato de fecha inválido ({date_raw})"

    day = day.zfill(2)
    month = month.zfill(2)

    # Convert 2-digit year to 4-digit year with strict century rules
    if len(year) == 2:
        y_int = int(year)
        now_dt = datetime.now()
        current_yy = now_dt.year % 100

        if field_type == "birth_date":
            # Adult workforce resolution: anyone with yy <= (current_yy - 16) is 2000s, else 1900s
            # E.g. in 2026 (current_yy=26): 00-10 -> 2000-2010 (age 16-26); 11-99 -> 1911-1999
            threshold = max(0, current_yy - 15)
            year = str(2000 + y_int) if y_int <= threshold else str(1900 + y_int)
        elif field_type == "expiry_date":
            # Documents in circulation expire in the 21st century (2000+)
            year = str(2000 + y_int)
        elif field_type == "issue_date":
            # Issue date cannot be in the future
            year = str(2000 + y_int) if y_int <= current_yy else str(1900 + y_int)
        else:
            # General fallback: if <= current_yy + 15 -> 2000s, else 1900s
            year = str(2000 + y_int) if y_int <= (current_yy + 15) else str(1900 + y_int)

    formatted_date = f"{day}/{month}/{year}"

    # Verify real calendar validity (leap year, days per month)
    try:
        dt = datetime.strptime(formatted_date, "%d/%m/%Y")
        now_dt = datetime.now()

        # Contextual validation based on field_type
        if field_type == "birth_date":
            if dt > now_dt:
                return False, formatted_date, "Fecha de nacimiento en el futuro"
            if dt.year < 1920:
                return False, formatted_date, f"Año de nacimiento fuera de rango ({dt.year})"
        elif field_type == "issue_date":
            if dt > now_dt:
                return False, formatted_date, "Fecha de emisión en el futuro"
            if dt.year < 1980:
                return False, formatted_date, f"Año de emisión fuera de rango ({dt.year})"

        if 1900 <= dt.year <= 2100:
            return True, formatted_date, None
        else:
            return False, formatted_date, f"Año fuera de rango ({dt.year})"
    except ValueError:
        return False, formatted_date, f"Fecha de calendario inexistente ({formatted_date})"


def normalize_sex(sex_str: str) -> Tuple[bool, str, Optional[str]]:
    """Normalizes sex to 'M' or 'F'."""
    if not sex_str:
        return False, "", "Sexo no especificado"

    clean = sex_str.upper().strip()
    if clean.startswith("M") or "MASCULINO" in clean or clean == "1":
        return True, "M", None
    elif clean.startswith("F") or "FEMENINO" in clean or clean == "2":
        return True, "F", None
    else:
        return False, clean, "Sexo desconocido (esperado M o F)"


def normalize_civil_status(status_raw: str) -> Tuple[bool, str, Optional[str]]:
    """
    Normalizes civil status for Peruvian IDs (handles S, C, V, D, CO, SOLTERO, etc.).
    """
    if not status_raw:
        return False, "", "Estado civil no detectado"

    clean = re.sub(r"[^A-Z]", "", status_raw.upper().strip())
    if clean in CIVIL_STATUS_MAP:
        return True, CIVIL_STATUS_MAP[clean], None

    for k, v in CIVIL_STATUS_MAP.items():
        if len(k) > 2 and k in clean:
            return True, v, None

    return False, status_raw, f"Estado civil no reconocido ({status_raw})"

