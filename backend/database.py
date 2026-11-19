import json
from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    Text,
    create_engine,
    text,
)
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.config import DATABASE_URL, get_peru_now

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class ScannedRecord(Base):
    __tablename__ = "scanned_records"

    id = Column(Integer, primary_key=True, index=True)
    scan_date = Column(DateTime, default=get_peru_now, nullable=False)
    doc_type = Column(String(50), nullable=False, index=True)  # "DNI" | "Carnet de Extranjería"
    
    # Core personal data
    paternal_surname = Column(String(100), default="", nullable=True)
    maternal_surname = Column(String(100), default="", nullable=True)
    first_names = Column(String(150), default="", nullable=True)
    doc_number = Column(String(50), default="", nullable=False, index=True)
    nationality = Column(String(50), default="PERUANA", nullable=True)
    birth_date = Column(String(20), default="", nullable=True)
    sex = Column(String(20), default="", nullable=True)
    
    # Address and location
    address = Column(Text, default="", nullable=True)
    ubigeo = Column(String(100), default="", nullable=True)
    department = Column(String(100), default="", nullable=True)
    province = Column(String(100), default="", nullable=True)
    district = Column(String(100), default="", nullable=True)
    ubigeo_reniec = Column(String(20), default="", nullable=True)
    ubigeo_inei = Column(String(20), default="", nullable=True)
    
    # Document validity
    issue_date = Column(String(20), default="", nullable=True)
    expiry_date = Column(String(20), default="", nullable=True)
    
    # Optional / Specific fields
    blood_type = Column(String(10), default="", nullable=True)
    civil_status = Column(String(50), default="", nullable=True)
    migratory_status = Column(String(100), default="", nullable=True)

    # Contact & Pension Previsional fields
    phone = Column(String(50), default="999999999", nullable=True)
    email = Column(String(100), default="sincorreo@gmail.com", nullable=True)
    pension_system = Column(String(50), default="", nullable=True)
    pension_commission = Column(String(50), default="", nullable=True)
    cuspp = Column(String(50), default="", nullable=True)

    # Contract NISIRA assignment fields
    cod_planilla = Column(String(10), default="ORP", nullable=True)
    nro_contrato = Column(String(50), default="", nullable=True)
    basico = Column(Float, default=1025.0, nullable=True)
    inicio_contrato = Column(String(20), default="", nullable=True)
    duracion = Column(String(20), default="3", nullable=True)
    fin_contrato = Column(String(20), default="", nullable=True)
    fecha_firma_contrato = Column(String(20), default="", nullable=True)
    tipo_contrato = Column(String(10), default="05", nullable=True)
    nro_contrato_ref = Column(String(50), default="", nullable=True)

    # Personal NISIRA fields (Defaults para OBRERO DE PLANTA)
    cod_cargo = Column(String(10), default="048", nullable=True)
    cod_tipo_trab = Column(String(10), default="76", nullable=True)
    cat_ocupacional = Column(String(10), default="02", nullable=True)
    period_pago = Column(String(10), default="3", nullable=True)
    cod_sucursal = Column(String(10), default="CA3", nullable=True)
    grupo_trabajo = Column(String(10), default="013", nullable=True)
    tipo_personal = Column(String(10), default="05", nullable=True)
    reg_laboral = Column(String(10), default="26", nullable=True)
    niv_educativo = Column(String(10), default="007", nullable=True)
    tipo_comision = Column(String(10), default="0", nullable=True)
    asignacion_familiar = Column(String(10), default="NO", nullable=True)
    fec_ingreso = Column(String(20), default="", nullable=True)
    
    # Notes & observations
    observations = Column(Text, default="", nullable=True)
    
    # Image references
    front_image_orig = Column(String(255), default="", nullable=True)
    front_image_enhanced = Column(String(255), default="", nullable=True)
    back_image_orig = Column(String(255), default="", nullable=True)
    back_image_enhanced = Column(String(255), default="", nullable=True)
    
    # Quality metrics
    quality_score_front = Column(Float, default=0.0)
    quality_score_back = Column(Float, default=0.0)
    is_blurry_front = Column(Boolean, default=False)
    is_blurry_back = Column(Boolean, default=False)
    
    # JSON containing per-field confidence scores (0-100)
    field_confidences = Column(Text, default="{}")

    def to_dict(self):
        confidences = {}
        if self.field_confidences:
            try:
                confidences = json.loads(self.field_confidences)
            except Exception:
                confidences = {}

        return {
            "id": self.id,
            "scan_date": self.scan_date.isoformat() if self.scan_date else "",
            "doc_type": self.doc_type,
            "paternal_surname": self.paternal_surname or "",
            "maternal_surname": self.maternal_surname or "",
            "first_names": self.first_names or "",
            "doc_number": self.doc_number or "",
            "nationality": self.nationality or "",
            "birth_date": self.birth_date or "",
            "sex": self.sex or "",
            "address": self.address or "",
            "ubigeo": self.ubigeo or "",
            "department": self.department or "",
            "province": self.province or "",
            "district": self.district or "",
            "ubigeo_reniec": self.ubigeo_reniec or "",
            "ubigeo_inei": self.ubigeo_inei or "",
            "issue_date": self.issue_date or "",
            "expiry_date": self.expiry_date or "",
            "blood_type": self.blood_type or "",
            "civil_status": self.civil_status or "",
            "migratory_status": self.migratory_status or "",
            "phone": self.phone or "999999999",
            "email": self.email or "sincorreo@gmail.com",
            "pension_system": self.pension_system or "",
            "pension_commission": self.pension_commission or "",
            "cuspp": self.cuspp or "",
            "observations": self.observations or "",
            "front_image_orig": self.front_image_orig or "",
            "front_image_enhanced": self.front_image_enhanced or "",
            "back_image_orig": self.back_image_orig or "",
            "back_image_enhanced": self.back_image_enhanced or "",
            "quality_score_front": self.quality_score_front,
            "quality_score_back": self.quality_score_back,
            "is_blurry_front": self.is_blurry_front,
            "is_blurry_back": self.is_blurry_back,
            "field_confidences": confidences,
            "cod_planilla": self.cod_planilla or "ORP",
            "nro_contrato": self.nro_contrato or "",
            "basico": self.basico if self.basico is not None else 1025.0,
            "inicio_contrato": self.inicio_contrato or "",
            "duracion": self.duracion or "3",
            "fin_contrato": self.fin_contrato or "",
            "fecha_firma_contrato": self.fecha_firma_contrato or "",
            "tipo_contrato": self.tipo_contrato or "05",
            "nro_contrato_ref": self.nro_contrato_ref or "",
            # Personal NISIRA
            "cod_cargo": self.cod_cargo or "048",
            "cod_tipo_trab": self.cod_tipo_trab or "76",
            "cat_ocupacional": self.cat_ocupacional or "02",
            "period_pago": self.period_pago or "3",
            "cod_sucursal": self.cod_sucursal or "CA3",
            "grupo_trabajo": self.grupo_trabajo or "013",
            "tipo_personal": self.tipo_personal or "05",
            "reg_laboral": self.reg_laboral or "26",
            "niv_educativo": self.niv_educativo or "007",
            "tipo_comision": self.tipo_comision or "0",
            "asignacion_familiar": self.asignacion_familiar or "NO",
            "fec_ingreso": self.fec_ingreso or "",
        }


class GeneratedContractLog(Base):
    __tablename__ = "generated_contracts"

    id = Column(Integer, primary_key=True, index=True)
    dni = Column(String(50), nullable=False, index=True)
    worker_name = Column(String(250), nullable=False, index=True)
    contract_type = Column(String(100), default="SUJETO A MODALIDAD")
    start_date = Column(String(50), default="")
    end_date = Column(String(50), default="")
    duration = Column(String(50), default="")
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size_kb = Column(Float, default=0.0)
    status = Column(String(50), default="GENERADO")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    provenance_summary = Column(Text, default="{}")

    def to_dict(self):
        return {
            "id": self.id,
            "dni": self.dni,
            "worker_name": self.worker_name,
            "contract_type": self.contract_type,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "duration": self.duration,
            "file_name": self.file_name,
            "file_path": self.file_path,
            "file_size_kb": self.file_size_kb,
            "status": self.status,
            "created_at": self.created_at.strftime("%d/%m/%Y %H:%M:%S") if self.created_at else "",
        }


class OCRLearningRecord(Base):
    __tablename__ = "ocr_learning_records"

    id = Column(Integer, primary_key=True, index=True)
    doc_type = Column(String(50), default="DNI")
    doc_subtype = Column(String(100), default="")
    doc_number = Column(String(50), index=True)
    field_name = Column(String(50), nullable=False)
    ocr_raw_value = Column(String(255), default="")
    user_corrected_value = Column(String(255), default="")
    confidence_score = Column(Float, default=0.0)
    image_variant_winner = Column(String(100), default="clahe_enhanced")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "doc_type": self.doc_type,
            "doc_subtype": self.doc_subtype,
            "doc_number": self.doc_number,
            "field_name": self.field_name,
            "ocr_raw_value": self.ocr_raw_value,
            "user_corrected_value": self.user_corrected_value,
            "confidence_score": self.confidence_score,
            "image_variant_winner": self.image_variant_winner,
            "created_at": self.created_at.strftime("%d/%m/%Y %H:%M:%S") if self.created_at else "",
        }


class HistoricalWorker(Base):
    """
    Padrón maestro de Data Histórica importada desde Excel (ej. DATA HISTORICA.xlsx).
    Permite consultar trabajadores existentes instantáneamente sin consumir tokens de Factiliza.
    """
    __tablename__ = "historical_workers"

    id = Column(Integer, primary_key=True, index=True)
    doc_number = Column(String(50), nullable=False, index=True, unique=True)
    doc_type = Column(String(50), default="DNI", index=True)
    paternal_surname = Column(String(100), default="", nullable=True)
    maternal_surname = Column(String(100), default="", nullable=True)
    first_names = Column(String(150), default="", nullable=True)
    full_name = Column(String(250), default="", nullable=True)
    birth_date = Column(String(20), default="", nullable=True)
    sex = Column(String(20), default="", nullable=True)
    civil_status = Column(String(50), default="", nullable=True)
    nationality = Column(String(50), default="PERUANA", nullable=True)
    address = Column(Text, default="", nullable=True)
    ubigeo_inei = Column(String(20), default="", nullable=True)
    ubigeo_reniec = Column(String(20), default="", nullable=True)
    ubigeo = Column(String(100), default="", nullable=True)
    department = Column(String(100), default="", nullable=True)
    province = Column(String(100), default="", nullable=True)
    district = Column(String(100), default="", nullable=True)
    phone = Column(String(50), default="999999999", nullable=True)
    email = Column(String(100), default="sincorreo@gmail.com", nullable=True)
    pension_system = Column(String(50), default="", nullable=True)
    pension_commission = Column(String(50), default="", nullable=True)
    cuspp = Column(String(50), default="", nullable=True)
    bank_id = Column(String(50), default="", nullable=True)
    bank_account = Column(String(100), default="", nullable=True)
    cargo = Column(String(100), default="", nullable=True)
    codigo_general = Column(String(50), default="", nullable=True)
    codigo_control = Column(String(50), default="", nullable=True)
    created_at = Column(DateTime, default=get_peru_now, nullable=False)

    def to_dict(self):
        return {
            "success": True,
            "status_code": 200,
            "source": "data_historica",
            "is_historical": True,
            "message": "Trabajador encontrado en Data Histórica (Ahorro de token Factiliza)",
            "doc_type": self.doc_type or "DNI",
            "doc_number": self.doc_number,
            "first_names": self.first_names or "",
            "paternal_surname": self.paternal_surname or "",
            "maternal_surname": self.maternal_surname or "",
            "full_name": self.full_name or f"{self.paternal_surname} {self.maternal_surname} {self.first_names}".strip(),
            "birth_date": self.birth_date or "",
            "sex": self.sex or "",
            "civil_status": self.civil_status or "",
            "nationality": self.nationality or "PERUANA",
            "address": self.address or "",
            "department": self.department or "",
            "province": self.province or "",
            "district": self.district or "",
            "ubigeo_inei": self.ubigeo_inei or "",
            "ubigeo_reniec": self.ubigeo_reniec or "",
            "ubigeo": self.ubigeo or (f"{self.department} / {self.province} / {self.district}" if self.department else ""),
            "phone": self.phone or "999999999",
            "email": self.email or "sincorreo@gmail.com",
            "pension_system": self.pension_system or "",
            "pension_commission": self.pension_commission or "",
            "cuspp": self.cuspp or "",
            "bank_account": self.bank_account or "",
            "cargo": self.cargo or "",
            "raw_response": {
                "origen": "DATA_HISTORICA",
                "doc_number": self.doc_number,
                "full_name": self.full_name,
                "afps": self.pension_system,
                "cuspp": self.cuspp,
                "cuenta_banco": self.bank_account,
                "cargo": self.cargo,
            }
        }


class SBSRecord(Base):
    __tablename__ = "sbs_records"

    id = Column(Integer, primary_key=True, index=True)
    doc_number = Column(String(50), nullable=False, index=True)
    doc_type = Column(String(20), default="DNI", nullable=False)
    paternal_surname = Column(String(100), default="", nullable=True)
    maternal_surname = Column(String(100), default="", nullable=True)
    first_names = Column(String(150), default="", nullable=True)

    afp_actual = Column(String(100), default="ONP / SNP", nullable=True)
    cuspp = Column(String(50), default="-", nullable=True)
    fecha_afiliacion_spp = Column(String(50), default="-", nullable=True)
    situacion_actual = Column(String(100), default="ONP / SNP", nullable=True)
    ultimo_aporte = Column(String(50), default="-", nullable=True)

    consulted_at = Column(DateTime, default=get_peru_now, nullable=False)
    raw_text = Column(Text, default="", nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "doc_number": self.doc_number,
            "doc_type": self.doc_type,
            "paternal_surname": self.paternal_surname or "",
            "maternal_surname": self.maternal_surname or "",
            "first_names": self.first_names or "",
            "full_name": f"{self.paternal_surname or ''} {self.maternal_surname or ''} {self.first_names or ''}".strip(),
            "afp_actual": self.afp_actual or "ONP / SNP",
            "pension_system": self.afp_actual or "ONP / SNP",
            "cuspp": self.cuspp or "-",
            "fecha_afiliacion_spp": self.fecha_afiliacion_spp or "-",
            "situacion_actual": self.situacion_actual or "ONP / SNP",
            "ultimo_aporte": self.ultimo_aporte or "-",
            "consulted_at": self.consulted_at.isoformat() if self.consulted_at else "",
            "source": "sbs_local",
        }


def init_db():
    Base.metadata.create_all(bind=engine)
    # Safe migration for new columns in SQLite
    with engine.connect() as conn:
        for col_name, col_type, default_val in [
            ("phone", "VARCHAR(50)", "'999999999'"),
            ("email", "VARCHAR(100)", "'sincorreo@gmail.com'"),
            ("pension_system", "VARCHAR(50)", "''"),
            ("pension_commission", "VARCHAR(50)", "''"),
            ("cuspp", "VARCHAR(50)", "''"),
            ("department", "VARCHAR(100)", "''"),
            ("province", "VARCHAR(100)", "''"),
            ("district", "VARCHAR(100)", "''"),
            ("ubigeo_reniec", "VARCHAR(20)", "''"),
            ("ubigeo_inei", "VARCHAR(20)", "''"),
            ("cod_planilla", "VARCHAR(10)", "'ORP'"),
            ("nro_contrato", "VARCHAR(50)", "''"),
            ("basico", "FLOAT", "1025.0"),
            ("inicio_contrato", "VARCHAR(20)", "''"),
            ("duracion", "VARCHAR(20)", "'3'"),
            ("fin_contrato", "VARCHAR(20)", "''"),
            ("fecha_firma_contrato", "VARCHAR(20)", "''"),
            ("tipo_contrato", "VARCHAR(10)", "'05'"),
            ("nro_contrato_ref", "VARCHAR(50)", "''"),
            ("cod_cargo", "VARCHAR(10)", "'048'"),
            ("cod_tipo_trab", "VARCHAR(10)", "'76'"),
            ("cat_ocupacional", "VARCHAR(10)", "'02'"),
            ("period_pago", "VARCHAR(10)", "'3'"),
            ("cod_sucursal", "VARCHAR(10)", "'CA3'"),
            ("grupo_trabajo", "VARCHAR(10)", "'013'"),
            ("tipo_personal", "VARCHAR(10)", "'05'"),
            ("reg_laboral", "VARCHAR(10)", "'26'"),
            ("niv_educativo", "VARCHAR(10)", "'007'"),
            ("tipo_comision", "VARCHAR(10)", "'0'"),
            ("asignacion_familiar", "VARCHAR(10)", "'NO'"),
            ("fec_ingreso", "VARCHAR(20)", "''"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE scanned_records ADD COLUMN {col_name} {col_type} DEFAULT {default_val}"))
                conn.commit()
            except Exception:
                pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
