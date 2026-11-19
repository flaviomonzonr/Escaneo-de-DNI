from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field


class FieldConfidence(BaseModel):
    value: str = ""
    confidence: float = 0.0  # 0 - 100
    is_valid: bool = True
    status: str = "CONFIRMADO"  # "CONFIRMADO" | "REVISAR" | "NO_DETECTADO"
    origin_type: str = "LEIDO_OCR"  # "LEIDO_OCR" | "CONSULTA_API" | "COMPLEMENTADO_API" | "BASE_EXCEL" | "CORREGIDO_PROBABLE" | "CALCULADO" | "EDITADO_USUARIO"
    source: str = "ocr"  # "ocr" | "api" | "manual"
    validation_message: Optional[str] = None
    anchor_matched: Optional[str] = None
    candidate_votes: Optional[str] = None


class QualityMetric(BaseModel):
    laplacian_var: float
    is_blurry: bool
    quality_message: str
    perspective_corrected: bool = False
    original_size: List[int] = Field(default_factory=list)
    processed_size: List[int] = Field(default_factory=list)


class ScanResponse(BaseModel):
    success: bool = True
    doc_type: str  # "DNI" | "Carnet de Extranjería" | "DNI Electrónico" | "Pasaporte"
    doc_subtype: Optional[str] = "DNI Azul Clásico"
    detected_side_front: Optional[str] = "ANVERSO"
    detected_side_back: Optional[str] = "REVERSO"
    
    # Extracted fields
    paternal_surname: str = ""
    maternal_surname: str = ""
    first_names: str = ""
    doc_number: str = ""
    nationality: str = "PERUANA"
    birth_date: str = ""
    sex: str = ""
    address: str = ""
    ubigeo: str = ""
    department: Optional[str] = ""
    province: Optional[str] = ""
    district: Optional[str] = ""
    ubigeo_reniec: Optional[str] = ""
    ubigeo_inei: Optional[str] = ""
    issue_date: str = ""
    expiry_date: str = ""
    blood_type: str = ""
    civil_status: str = ""
    migratory_status: str = ""
    phone: str = "999999999"
    email: str = "sincorreo@gmail.com"
    pension_system: str = ""
    pension_commission: str = ""
    cuspp: str = ""
    observations: str = ""

    # Per-field detail with confidence and validation
    fields: Dict[str, FieldConfidence] = Field(default_factory=dict)
    
    # Quality metrics for front and back images
    quality_front: QualityMetric
    quality_back: Optional[QualityMetric] = None
    
    # URLs to saved images
    front_image_orig: str = ""
    front_image_enhanced: str = ""
    back_image_orig: str = ""
    back_image_enhanced: str = ""
    
    # Worker identification & Duplicate status
    duplicate_warning: Optional[str] = None
    worker_match_status: Optional[str] = None  # "EXACT_MATCH" | "FUZZY_MATCH" | "NOT_FOUND"
    matched_worker_name: Optional[str] = None
    matched_worker_dni: Optional[str] = None
    
    # Global quality & OCR warnings
    warnings: List[str] = Field(default_factory=list)

    # API Complementation Status
    api_complemented: bool = False
    api_status: Optional[Dict[str, Any]] = None
    source: Optional[str] = "ocr"
    is_historical: bool = False
    historical_auto_completed: bool = False


class RecordCreate(BaseModel):
    doc_type: str
    paternal_surname: str = ""
    maternal_surname: str = ""
    first_names: str = ""
    doc_number: str
    nationality: str = "PERUANA"
    birth_date: str = ""
    sex: str = ""
    address: str = ""
    ubigeo: str = ""
    department: Optional[str] = ""
    province: Optional[str] = ""
    district: Optional[str] = ""
    ubigeo_reniec: Optional[str] = ""
    ubigeo_inei: Optional[str] = ""
    issue_date: str = ""
    expiry_date: str = ""
    blood_type: str = ""
    civil_status: str = ""
    migratory_status: str = ""
    phone: Optional[str] = "999999999"
    email: Optional[str] = "sincorreo@gmail.com"
    pension_system: Optional[str] = ""
    pension_commission: Optional[str] = ""
    cuspp: Optional[str] = ""
    observations: str = ""
    
    # Contract NISIRA fields
    cod_planilla: Optional[str] = "ORP"
    nro_contrato: Optional[str] = ""
    basico: Optional[float] = 1025.0
    inicio_contrato: Optional[str] = ""
    duracion: Optional[str] = "3"
    fin_contrato: Optional[str] = ""
    fecha_firma_contrato: Optional[str] = ""
    tipo_contrato: Optional[str] = "05"
    nro_contrato_ref: Optional[str] = ""
    
    # Personal NISIRA fields
    cod_cargo: Optional[str] = "048"
    cod_tipo_trab: Optional[str] = "76"
    cat_ocupacional: Optional[str] = "02"
    period_pago: Optional[str] = "3"
    cod_sucursal: Optional[str] = "CA3"
    grupo_trabajo: Optional[str] = "013"
    tipo_personal: Optional[str] = "05"
    reg_laboral: Optional[str] = "26"
    niv_educativo: Optional[str] = "007"
    tipo_comision: Optional[str] = "0"
    asignacion_familiar: Optional[str] = "NO"
    fec_ingreso: Optional[str] = ""
    
    front_image_orig: Optional[str] = ""
    front_image_enhanced: Optional[str] = ""
    back_image_orig: Optional[str] = ""
    back_image_enhanced: Optional[str] = ""
    
    quality_score_front: float = 0.0
    quality_score_back: float = 0.0
    is_blurry_front: bool = False
    is_blurry_back: bool = False
    
    field_confidences: Optional[Dict[str, Any]] = Field(default_factory=dict)


class RecordResponse(BaseModel):
    id: int
    scan_date: str
    doc_type: str
    paternal_surname: str
    maternal_surname: str
    first_names: str
    doc_number: str
    nationality: str
    birth_date: str
    sex: str
    address: str
    ubigeo: str = ""
    department: Optional[str] = ""
    province: Optional[str] = ""
    district: Optional[str] = ""
    ubigeo_reniec: Optional[str] = ""
    ubigeo_inei: Optional[str] = ""
    issue_date: str
    expiry_date: str
    blood_type: str
    civil_status: str
    migratory_status: str
    phone: str = "999999999"
    email: str = "sincorreo@gmail.com"
    pension_system: str = ""
    pension_commission: str = ""
    cuspp: str = ""
    observations: str = ""
    
    # Contract NISIRA fields
    cod_planilla: Optional[str] = "ORP"
    nro_contrato: Optional[str] = ""
    basico: Optional[float] = 1025.0
    inicio_contrato: Optional[str] = ""
    duracion: Optional[str] = "3"
    fin_contrato: Optional[str] = ""
    fecha_firma_contrato: Optional[str] = ""
    tipo_contrato: Optional[str] = "05"
    nro_contrato_ref: Optional[str] = ""
    
    # Personal NISIRA fields
    cod_cargo: Optional[str] = "048"
    cod_tipo_trab: Optional[str] = "76"
    cat_ocupacional: Optional[str] = "02"
    period_pago: Optional[str] = "3"
    cod_sucursal: Optional[str] = "CA3"
    grupo_trabajo: Optional[str] = "013"
    tipo_personal: Optional[str] = "05"
    reg_laboral: Optional[str] = "26"
    niv_educativo: Optional[str] = "007"
    tipo_comision: Optional[str] = "0"
    asignacion_familiar: Optional[str] = "NO"
    fec_ingreso: Optional[str] = ""
    
    front_image_orig: str
    front_image_enhanced: str
    back_image_orig: str
    back_image_enhanced: str
    
    quality_score_front: float
    quality_score_back: float
    is_blurry_front: bool
    is_blurry_back: bool
    
    field_confidences: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True










class PaginatedRecordsResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[RecordResponse]


class StatsResponse(BaseModel):
    total_records: int
    dni_count: int
    ce_count: int
    scanned_today: int


# ==========================================
# Worker Consolidation & Contract Schemas
# ==========================================

class WorkerFieldSchema(BaseModel):
    field_key: str
    value: str = ""
    origin: str = ""
    origin_type: str = "SYSTEM"  # EXCEL_VISIBLE | EXCEL_COMMENT | EXCEL_HIDDEN | OCR | SYSTEM | USER | CALCULATED
    is_hidden_or_note: bool = False
    is_editable: bool = True
    comment: Optional[str] = None


class ContractDatesSchema(BaseModel):
    start_date: str = ""
    end_date: str = ""
    duration_months: int = 3
    duration_text: str = "3 meses"
    start_date_iso: Optional[str] = ""
    end_date_iso: Optional[str] = ""
    error: Optional[str] = None


class WorkerProfileResponse(BaseModel):
    dni: str
    full_name: str
    excel_found: bool = False
    excel_sheets_scanned: List[str] = Field(default_factory=list)
    fields: Dict[str, WorkerFieldSchema] = Field(default_factory=dict)
    contract_dates: ContractDatesSchema


class CalculateDatesRequest(BaseModel):
    start_date: str
    duration_months: int = 3


class ContractGenerateRequest(BaseModel):
    worker_data: Dict[str, Any]
    start_date: str
    duration_months: int = 3
    template_name: Optional[str] = None
    empresa_nombre: Optional[str] = "SERVICIOS INDUSTRIALES DEL PERÚ S.A.C."
    empresa_ruc: Optional[str] = "20601234567"


class BatchContractGenerateRequest(BaseModel):
    workers: List[Dict[str, Any]]
    start_date: str
    duration_months: int = 3
    template_name: Optional[str] = None


class ContractLogResponse(BaseModel):
    id: int
    dni: str
    worker_name: str
    contract_type: str
    start_date: str
    end_date: str
    duration: str
    file_name: str
    file_path: str
    file_size_kb: float
    status: str
    created_at: str

    class Config:
        from_attributes = True










class ContractBatchUpdateRequest(BaseModel):
    record_ids: List[int]
    updates: Dict[str, Any]


class ContractCatalogResponse(BaseModel):
    tipos_contrato: List[Dict[str, str]]
    codigos_planilla: List[Dict[str, str]]


class StandardPeruDocData(BaseModel):
    primer_apellido_o_apellidos: Optional[str] = None
    segundo_apellido_o_prenombres: Optional[str] = None
    prenombres_dni_azul: Optional[str] = None
    sexo: Optional[str] = None
    estado_civil: Optional[str] = None
    fecha_nacimiento: Optional[str] = None
    fecha_emision: Optional[str] = None
    fecha_caducidad: Optional[str] = None
    numero_documento: Optional[str] = None
    nacionalidad: Optional[str] = None
    direccion: Optional[str] = None
    departamento: Optional[str] = None
    provincia: Optional[str] = None
    distrito: Optional[str] = None


class StandardPeruDocResponse(BaseModel):
    tipo_documento: str  # "DNI_AZUL" | "DNI_ELECTRONICO" | "CARNET_EXTRANJERIA"
    datos: StandardPeruDocData
    observaciones_ocr: List[str] = Field(default_factory=list)


def format_to_standard_peru_doc(resp: "ScanResponse") -> Dict[str, Any]:
    """
    Transforms an internal ScanResponse into the standardized ocr-documentos-peru JSON schema.
    """
    doc_type_raw = (resp.doc_type or "").upper()
    sub_type_raw = (resp.doc_subtype or "").upper()

    if "CARNET" in doc_type_raw or "EXTRANJER" in doc_type_raw:
        std_type = "CARNET_EXTRANJERIA"
        apellidos = " ".join([p for p in [resp.paternal_surname, resp.maternal_surname] if p]).strip()
        p1 = apellidos if apellidos else (resp.paternal_surname or None)
        p2 = resp.first_names or None
        prenombres_azul = None
        nac = resp.nationality or None
    elif "ELECTRONIC" in doc_type_raw or "ELECTRONIC" in sub_type_raw or "DNIE" in doc_type_raw:
        std_type = "DNI_ELECTRONICO"
        apellidos = " ".join([p for p in [resp.paternal_surname, resp.maternal_surname] if p]).strip()
        p1 = apellidos if apellidos else (resp.paternal_surname or None)
        p2 = resp.first_names or None
        prenombres_azul = None
        nac = resp.nationality or "PERUANA"
    else:
        std_type = "DNI_AZUL"
        p1 = resp.paternal_surname or None
        p2 = resp.maternal_surname or None
        prenombres_azul = resp.first_names or None
        nac = "PERU"

    return {
        "tipo_documento": std_type,
        "datos": {
            "primer_apellido_o_apellidos": p1,
            "segundo_apellido_o_prenombres": p2,
            "prenombres_dni_azul": prenombres_azul,
            "sexo": resp.sex or None,
            "estado_civil": resp.civil_status or None,
            "fecha_nacimiento": resp.birth_date or None,
            "fecha_emision": resp.issue_date or None,
            "fecha_caducidad": resp.expiry_date or None,
            "numero_documento": resp.doc_number or None,
            "nacionalidad": nac,
            "direccion": resp.address or None,
            "departamento": resp.department or None,
            "provincia": resp.province or None,
            "distrito": resp.district or None,
        },
        "observaciones_ocr": list(resp.warnings) if resp.warnings else [],
    }
