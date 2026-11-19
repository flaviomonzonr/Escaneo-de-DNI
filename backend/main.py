import sys
from pathlib import Path

# Ensure project root is in sys.path
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

import os
import re
import logging
import concurrent.futures

logger = logging.getLogger("main")
from datetime import datetime, date, timezone
from typing import Optional, List, Dict, Any, Tuple, Union
import json
import zipfile
import socket

def _get_local_ips() -> List[str]:
    ips = []
    try:
        hostname = socket.gethostname()
        for ip in socket.gethostbyname_ex(hostname)[2]:
            if not ip.startswith("127.") and not ip.startswith("169.254"):
                if ip not in ips:
                    ips.append(ip)
    except Exception:
        pass
    return ips

from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, func

from backend.config import (
    DATA_DIR,
    UPLOADS_DIR,
    EXPORTS_DIR,
    CONTRACTS_DIR,
    TEMPLATES_DIR,
    MASTER_EXCEL_PATH,
    BLUR_THRESHOLD,
    find_tesseract_binary,
    OCR_ENGINE,
    get_peru_now,
    PERU_TZ,
)
from backend.database import init_db, get_db, ScannedRecord, GeneratedContractLog
from backend.schemas import (
    ScanResponse,
    RecordCreate,
    RecordResponse,
    PaginatedRecordsResponse,
    StatsResponse,
    QualityMetric,
    FieldConfidence,
    WorkerProfileResponse,
    CalculateDatesRequest,
    ContractGenerateRequest,
    BatchContractGenerateRequest,
    ContractLogResponse,
    ContractBatchUpdateRequest,
    StandardPeruDocResponse,
    format_to_standard_peru_doc,
)
from backend.image_processing.multi_variant_pipeline import generate_multi_variants
from backend.image_processing.classifier import classify_document
from backend.ocr import get_ocr_engine
from backend.ocr.consensus_engine import ConsensusEngine
from backend.extractors import extract_dni_data, extract_ce_data
from backend.extractors.validators import validate_dni, validate_ce, normalize_and_validate_date
from backend.ocr_engine import extract_dni_from_bytes, process_dni_image
from backend.storage.file_manager import save_image_matrix
from backend.storage.excel_manager import append_record_to_excel, generate_filtered_excel
from backend.services import (
    ExcelAnalyzer,
    WorkerConsolidator,
    ContractGenerator,
    ExcelTemplateService,
    backup_service,
    supabase_template_service,
)
from backend.services.worker_matcher import WorkerMatcher
from backend.services.learning_service import LearningService
from backend.services.factiliza_service import (
    query_dni_factiliza,
    query_cee_factiliza,
    query_document_factiliza,
    query_batch_factiliza,
    get_saved_token,
    save_token,
)
from backend.services.historical_data_service import HistoricalDataService
from backend.services.sbs_service import SBSService, REPORTE_SBS_EXCEL_PATH
from backend.database import SBSRecord
from pydantic import BaseModel as PyBaseModel


class SBSQueryRequest(PyBaseModel):
    doc_number: str
    paternal_surname: str
    maternal_surname: Optional[str] = ""
    first_names: Optional[str] = ""
    doc_type: Optional[str] = "DNI"
    force_refresh: Optional[bool] = False


class FactilizaQueryRequest(PyBaseModel):
    dni: Optional[str] = None
    doc_type: Optional[str] = "DNI"
    doc_number: Optional[str] = None
    cee: Optional[str] = None
    token: Optional[str] = None


class FactilizaConfigRequest(PyBaseModel):
    token: str


class FactilizaBatchRequest(PyBaseModel):
    dnis: List[str]
    token: Optional[str] = None


class FactilizaBatchSaveRequest(PyBaseModel):
    records: List[Dict[str, Any]]
    cod_planilla: Optional[str] = "ORP"
    tipo_contrato: Optional[str] = "05"
    basico: Optional[float] = 1025.0
    inicio_contrato: Optional[str] = None
    duracion: Optional[str] = "3"
    fin_contrato: Optional[str] = None


app = FastAPI(
    title="Sistema de Escaneo de DNI y Carnet de Extranjería - Perú",
    description="Backend API con OpenCV, Tesseract OCR, SQLite y exportación incremental a Excel.",
    version="1.0.0",
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads directory for static image serving
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.on_event("startup")
def on_startup():
    init_db()

    import threading
    import time

    def _delayed_warmup():
        time.sleep(3)  # deja que el servidor termine de arrancar primero
        try:
            from backend.ocr import get_ocr_engine
            engine = get_ocr_engine()
            engine.warmup()
        except Exception:
            pass

    threading.Thread(target=_delayed_warmup, daemon=True).start()

    def _sync_history():
        try:
            from backend.services.historical_data_service import HistoricalDataService
            HistoricalDataService.sync_all_existing_data()
        except Exception as e:
            logger.warning(f"Error en sincronización inicial de histórico: {e}")

    threading.Thread(target=_sync_history, daemon=True).start()




# Global service instances
excel_analyzer = ExcelAnalyzer(MASTER_EXCEL_PATH)
worker_matcher = WorkerMatcher(excel_analyzer)
worker_consolidator = WorkerConsolidator(MASTER_EXCEL_PATH)
contract_generator = ContractGenerator(TEMPLATES_DIR, CONTRACTS_DIR)
excel_template_service = ExcelTemplateService()

@app.on_event("startup")
def warmup_template_cache():
    import threading
    threading.Thread(target=excel_template_service.list_templates, daemon=True).start()

_FRONTEND_DIST = _PROJECT_ROOT / "frontend" / "dist"
if _FRONTEND_DIST.exists():
    _ASSETS_DIR = _FRONTEND_DIST / "assets"
    if _ASSETS_DIR.exists():
        app.mount("/assets", StaticFiles(directory=str(_ASSETS_DIR)), name="frontend_assets")

    @app.get("/")
    def serve_frontend_index():
        index_file = _FRONTEND_DIST / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        return {
            "system": "EscanDNI Perú - Backend API",
            "status": "online",
            "docs_url": "/docs",
        }
else:
    @app.get("/")
    def root():
        return {
            "system": "EscanDNI Perú - Backend API",
            "status": "online",
            "frontend_url": "http://localhost:5173",
            "docs_url": "/docs",
            "message": "El servidor Backend está funcionando correctamente. Para usar la interfaz gráfica abre http://localhost:5173 en tu navegador.",
        }


@app.get("/api/health")
def health_check():
    tesseract_path = find_tesseract_binary()
    ocr_engine = get_ocr_engine()
    ocr_ok = ocr_engine.is_available()
    engine_label = "RapidOCR AI" if "Rapid" in ocr_engine.__class__.__name__ else ocr_engine.__class__.__name__.replace("OCREngine", "")

    backup_info = backup_service.get_backup_status()

    ips = _get_local_ips()
    tunnel_file = DATA_DIR / "tunnel_url.txt"
    tunnel_url = ""
    if tunnel_file.exists():
        try:
            tunnel_url = tunnel_file.read_text(encoding="utf-8").strip()
        except Exception:
            pass

    return {
        "status": "healthy" if ocr_ok else "degraded",
        "ocr_engine": engine_label,
        "ocr_available": ocr_ok,
        "tesseract_installed": tesseract_path is not None,
        "tesseract_path": tesseract_path,
        "blur_threshold": BLUR_THRESHOLD,
        "master_excel_exists": MASTER_EXCEL_PATH.exists(),
        "backup": backup_info,
        "network_ips": ips,
        "wifi_urls": [f"http://{ip}:5173" for ip in ips],
        "tunnel_url": tunnel_url,
    }


@app.get("/api/system/network-info")
def get_network_info():
    """Retorna las direcciones IP locales para compartir la app en la misma red Wi-Fi."""
    ips = _get_local_ips()
    tunnel_file = DATA_DIR / "tunnel_url.txt"
    tunnel_url = ""
    if tunnel_file.exists():
        try:
            tunnel_url = tunnel_file.read_text(encoding="utf-8").strip()
        except Exception:
            pass

    return {
        "laptop_url": "http://localhost:5173",
        "wifi_ips": ips,
        "wifi_urls": [f"http://{ip}:5173" for ip in ips],
        "tunnel_url": tunnel_url,
    }


@app.get("/api/backups/status")
def get_backups_status():
    """Retorna el estado de copias de seguridad y persistencia de datos."""
    return backup_service.get_backup_status()


@app.post("/api/backups/create")
def create_manual_backup():
    """Crea una copia de seguridad manual inmediata de records.db y Registros.xlsx."""
    res = backup_service.create_backup("manual_trigger")
    return res


@app.get("/api/backups/download-zip")
def download_full_backup_zip():
    """Descarga un archivo .ZIP completo con records.db, Registros.xlsx y todas las plantillas."""
    zip_path = backup_service.create_full_zip_package()
    if not zip_path.exists():
        raise HTTPException(status_code=500, detail="No se pudo empaquetar el archivo de respaldo.")
    return FileResponse(
        path=str(zip_path),
        filename=zip_path.name,
        media_type="application/zip",
    )



@app.post("/api/scan", response_model=ScanResponse)
async def scan_document(
    front_image: UploadFile = File(...),
    back_image: Optional[UploadFile] = File(None),
    doc_type: str = Form("DNI"),
    db: Session = Depends(get_db),
):
    """
    Motor OCR Multi-Intento Ultrarrápido con Consenso Ponderado y Procesamiento Paralelo:
    1. Preprocesamiento OpenCV Multi-Variante en paralelo para Anverso y Reverso.
    2. Clasificación automática de documento y detección de caras.
    3. Ejecución concurrente de OCR Multi-Intento con matriz de confusión y votación de consenso.
    4. Extracción semántica por anclas y proximidad (cero coordenadas fijas).
    5. Búsqueda inteligente en base Excel / SQLite con corrección difusa y detección de duplicados.
    """
    # Read image bytes synchronously
    front_bytes = front_image.file.read()
    back_bytes = back_image.file.read() if back_image else None

    if not front_bytes:
        raise HTTPException(
            status_code=400,
            detail="Debe proporcionar al menos la imagen del anverso del documento.",
        )

    # 1. Generate Multi-Variants with OpenCV in parallel for Front and Back
    try:
        if back_bytes:
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                f_future = executor.submit(generate_multi_variants, front_bytes)
                b_future = executor.submit(generate_multi_variants, back_bytes)
                front_variants_res = f_future.result()
                back_variants_res = b_future.result()
        else:
            front_variants_res = generate_multi_variants(front_bytes)
            back_variants_res = None
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Error durante el preprocesamiento de la imagen con OpenCV: {str(e)}",
        )

    # Save images - Always store and serve the clean cropped DNI card (no background/hands)
    front_orig_fn = save_image_matrix(front_variants_res.warped_bgr, "front_orig")
    front_enh_fn = save_image_matrix(
        front_variants_res.variants.get("clahe_enhanced", list(front_variants_res.variants.values())[0]).image,
        "front_enhanced"
    )
    front_orig_url = f"/uploads/{front_orig_fn}"
    front_enh_url = f"/uploads/{front_enh_fn}"

    back_orig_url = ""
    back_enh_url = ""
    if back_variants_res:
        back_orig_fn = save_image_matrix(back_variants_res.warped_bgr, "back_orig")
        back_enh_fn = save_image_matrix(
            back_variants_res.variants.get("clahe_enhanced", list(back_variants_res.variants.values())[0]).image,
            "back_enhanced"
        )
        back_orig_url = f"/uploads/{back_orig_fn}"
        back_enh_url = f"/uploads/{back_enh_fn}"

    # 2. Multi-Attempt OCR with Consensus Engine in parallel for Front and Back
    ocr_engine = get_ocr_engine()
    consensus_engine = ConsensusEngine(ocr_engine)

    if back_variants_res:
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            f_ocr_fut = executor.submit(consensus_engine.run_multi_attempt_ocr, front_variants_res)
            b_ocr_fut = executor.submit(consensus_engine.run_multi_attempt_ocr, back_variants_res)
            front_consensus = f_ocr_fut.result()
            back_consensus = b_ocr_fut.result()
    else:
        front_consensus = consensus_engine.run_multi_attempt_ocr(front_variants_res)
        back_consensus = None

    combined_mrz = (
        (front_consensus.combined_mrz or "") + "\n" + ((back_consensus.combined_mrz if back_consensus else "") or "")
    ).strip()

    # 3. Document Classification & Side Detection (100% Automático sobre imagen recortada)
    front_classif = classify_document(
        image_bgr=front_variants_res.warped_bgr,
        ocr_text=front_consensus.primary_ocr.full_text,
        declared_type=doc_type if doc_type != "AUTO" else "DNI",
    )
    back_classif = classify_document(
        image_bgr=back_variants_res.warped_bgr,
        ocr_text=back_consensus.primary_ocr.full_text if back_consensus else "",
        declared_type=doc_type if doc_type != "AUTO" else "DNI",
    ) if back_variants_res else None

    # Automatic detection takes precedence unless user explicitly selected document type
    if doc_type not in ["AUTO", "", None]:
        effective_doc_type = doc_type
    elif front_classif.confidence >= 45 and front_classif.doc_type != "INDETERMINADO":
        effective_doc_type = front_classif.doc_type
    else:
        effective_doc_type = front_classif.doc_type

    doc_subtype = front_classif.doc_subtype

    # Merge Candidate Pools across front and back
    merged_candidate_pools = dict(front_consensus.candidate_pools)
    if back_consensus:
        for k, v in back_consensus.candidate_pools.items():
            merged_candidate_pools.setdefault(k, []).extend(v)

    # 4. Semantic Extraction
    all_warnings = []
    if effective_doc_type == "INDETERMINADO":
        all_warnings.append("Tipo de documento no identificado con suficiente certeza. Revise y seleccione el tipo correcto.")

    if front_variants_res.is_blurry:
        all_warnings.append(f"Anverso: {front_variants_res.quality_message}")
    if back_variants_res and back_variants_res.is_blurry:
        all_warnings.append(f"Reverso: {back_variants_res.quality_message}")

    if effective_doc_type == "Carnet de Extranjería":
        extracted_dict, fields_dict, doc_warnings = extract_ce_data(
            front_ocr=front_consensus.primary_ocr,
            back_ocr=back_consensus.primary_ocr if back_consensus else None,
            mrz_text=combined_mrz,
            candidate_pools=merged_candidate_pools,
        )
    else:
        extracted_dict, fields_dict, doc_warnings = extract_dni_data(
            front_ocr=front_consensus.primary_ocr,
            back_ocr=back_consensus.primary_ocr if back_consensus else None,
            mrz_text=combined_mrz,
            candidate_pools=merged_candidate_pools,
        )

    all_warnings.extend(doc_warnings)

    # 4B. REGLA MAESTRA OCR: FOCALIZAR Y PRIORIZAR LOS 4 CAMPOS OBJETIVO
    # 1. doc_number, 2. birth_date, 3. issue_date, 4. expiry_date
    for target_key in ["doc_number", "birth_date", "issue_date", "expiry_date"]:
        if target_key in fields_dict:
            fields_dict[target_key].source = "ocr"

    clean_doc_number = (extracted_dict.get("doc_number") or "").strip()
    is_dni_type = (effective_doc_type != "Carnet de Extranjería")

    api_complemented = False
    api_status_info: Optional[Dict[str, Any]] = None

    # Validar estrictamente el número según tipo documental antes de consultar API
    is_valid_for_api = False
    target_query_type = "DNI"
    target_query_num = clean_doc_number

    if is_dni_type:
        val_dni_ok, norm_dni, _ = validate_dni(clean_doc_number)
        if val_dni_ok:
            is_valid_for_api = True
            target_query_type = "DNI"
            target_query_num = norm_dni
            extracted_dict["doc_number"] = norm_dni
            if "doc_number" in fields_dict:
                fields_dict["doc_number"].value = norm_dni
                fields_dict["doc_number"].is_valid = True
    else:
        val_ce_ok, norm_ce, _ = validate_ce(clean_doc_number)
        if val_ce_ok:
            is_valid_for_api = True
            target_query_type = "CEE"
            target_query_num = norm_ce
            extracted_dict["doc_number"] = norm_ce
            if "doc_number" in fields_dict:
                fields_dict["doc_number"].value = norm_ce
                fields_dict["doc_number"].is_valid = True

    # 4C. CONSULTA AUTOMÁTICA PARA COMPLEMENTAR DATOS (POST-OCR)
    # PRIORIDAD ESTRICTA:
    # 1ª OPCIÓN: Buscar en Data Histórica local (0 tokens)
    # 2ª OPCIÓN: Si no existe en Data Histórica, recurrir a Factiliza API (Token)
    if is_valid_for_api:
        try:
            # 1. Buscar primero en Data Histórica
            hist_worker = HistoricalDataService.find_worker_by_doc(target_query_num, db)
            if hist_worker:
                api_res = hist_worker
                source_id = "data_historica"
                origin_badge_hint = "Data Histórica (Planilla)"
                status_msg = "Datos del trabajador complementados desde Data Histórica (0 tokens consumidos)."
            else:
                # 2. Si no está en Data Histórica, consultar Factiliza API
                api_res = await query_document_factiliza(
                    doc_type=target_query_type,
                    doc_number=target_query_num,
                )
                source_id = "factiliza"
                origin_badge_hint = "Factiliza API (RENIEC)"
                status_msg = "Datos de identidad complementados exitosamente desde Factiliza / RENIEC."

            if api_res.get("success"):
                api_complemented = True
                api_status_info = {
                    "queried": True,
                    "success": True,
                    "source": source_id,
                    "doc_type": target_query_type,
                    "message": status_msg,
                }

                def _set_api_field(field_key: str, val_raw: str, label_hint: str):
                    s_val = (val_raw or "").strip()
                    if s_val:
                        extracted_dict[field_key] = s_val
                        fields_dict[field_key] = FieldConfidence(
                            value=s_val,
                            confidence=99.0,
                            is_valid=True,
                            status="CONFIRMADO",
                            origin_type="COMPLEMENTADO_HISTORICO" if source_id == "data_historica" else "COMPLEMENTADO_API",
                            source=source_id,
                            anchor_matched=label_hint,
                        )

                # Nombres y Apellidos oficiales
                _set_api_field("first_names", api_res.get("first_names") or "", origin_badge_hint)
                _set_api_field("paternal_surname", api_res.get("paternal_surname") or "", origin_badge_hint)
                _set_api_field("maternal_surname", api_res.get("maternal_surname") or "", origin_badge_hint)

                # Sexo y Estado Civil
                if api_res.get("sex"):
                    _set_api_field("sex", api_res.get("sex"), f"{origin_badge_hint} (Sexo)")
                if api_res.get("civil_status"):
                    _set_api_field("civil_status", api_res.get("civil_status"), f"{origin_badge_hint} (Estado Civil)")

                # Dirección y Ubicación geográfica
                if api_res.get("address"):
                    _set_api_field("address", api_res.get("address"), f"{origin_badge_hint} (Dirección)")
                if api_res.get("department"):
                    _set_api_field("department", api_res.get("department"), f"{origin_badge_hint} (Departamento)")
                if api_res.get("province"):
                    _set_api_field("province", api_res.get("province"), f"{origin_badge_hint} (Provincia)")
                if api_res.get("district"):
                    _set_api_field("district", api_res.get("district"), f"{origin_badge_hint} (Distrito)")
                if api_res.get("ubigeo_reniec"):
                    _set_api_field("ubigeo_reniec", api_res.get("ubigeo_reniec"), f"{origin_badge_hint} (Ubigeo RENIEC)")
                if api_res.get("ubigeo_inei"):
                    _set_api_field("ubigeo_inei", api_res.get("ubigeo_inei"), f"{origin_badge_hint} (Ubigeo INEI)")
                if api_res.get("nationality"):
                    _set_api_field("nationality", api_res.get("nationality"), f"{origin_badge_hint} (Nacionalidad)")

                # Campos previsionales y bancarios (Planilla)
                if api_res.get("pension_system"):
                    _set_api_field("pension_system", api_res.get("pension_system"), f"{origin_badge_hint} (AFP)")
                if api_res.get("pension_commission"):
                    _set_api_field("pension_commission", api_res.get("pension_commission"), f"{origin_badge_hint} (Comisión)")
                if api_res.get("cuspp"):
                    _set_api_field("cuspp", api_res.get("cuspp"), f"{origin_badge_hint} (CUSPP)")
                if api_res.get("bank_account"):
                    _set_api_field("bank_account", api_res.get("bank_account"), f"{origin_badge_hint} (Cuenta)")
                if api_res.get("cargo"):
                    _set_api_field("cargo", api_res.get("cargo"), f"{origin_badge_hint} (Cargo)")
                if api_res.get("phone") and api_res.get("phone") != "999999999":
                    _set_api_field("phone", api_res.get("phone"), f"{origin_badge_hint} (Teléfono)")
                if api_res.get("email") and api_res.get("email") != "sincorreo@gmail.com":
                    _set_api_field("email", api_res.get("email"), f"{origin_badge_hint} (Email)")

                # Síntesis legible de Ubigeo
                dept_s = extracted_dict.get("department", "")
                prov_s = extracted_dict.get("province", "")
                dist_s = extracted_dict.get("district", "")
                ub_inei_s = extracted_dict.get("ubigeo_inei", "")
                if dept_s and dist_s:
                    extracted_dict["ubigeo"] = f"{dept_s} / {prov_s} / {dist_s} ({ub_inei_s})" if ub_inei_s else f"{dept_s} / {prov_s} / {dist_s}"
                    fields_dict["ubigeo"] = FieldConfidence(
                        value=extracted_dict["ubigeo"],
                        confidence=99.0,
                        is_valid=True,
                        status="CONFIRMADO",
                        origin_type="COMPLEMENTADO_HISTORICO" if source_id == "data_historica" else "COMPLEMENTADO_API",
                        source=source_id,
                        anchor_matched=f"{origin_badge_hint} (Ubigeo sintetizado)",
                    )

                # PRECEDENCIA ESTRICTA DE CAMPOS OBJETIVO:
                # 1. doc_number: confirmado, conservando atribución OCR
                if "doc_number" in fields_dict:
                    fields_dict["doc_number"].status = "CONFIRMADO"
                    fields_dict["doc_number"].confidence = 99.8
                    fields_dict["doc_number"].source = "ocr"
                    fields_dict["doc_number"].validation_message = "Verificado en base de datos"

                # 2. birth_date: PRIORIDAD OCR. Solo si OCR no la detectó, usar Data Histórica / API como respaldo
                ocr_birth = fields_dict.get("birth_date")
                if not (ocr_birth and ocr_birth.is_valid and ocr_birth.value):
                    api_birth = (api_res.get("birth_date") or "").strip()
                    if api_birth:
                        val_b_ok, fmt_b, _ = normalize_and_validate_date(api_birth, field_type="birth_date")
                        if val_b_ok:
                            extracted_dict["birth_date"] = fmt_b
                            fields_dict["birth_date"] = FieldConfidence(
                                value=fmt_b,
                                confidence=95.0,
                                is_valid=True,
                                status="CONFIRMADO",
                                origin_type="COMPLEMENTADO_HISTORICO" if source_id == "data_historica" else "COMPLEMENTADO_API",
                                source=source_id,
                                anchor_matched=f"{origin_badge_hint} (Fecha de nacimiento)",
                            )
                else:
                    fields_dict["birth_date"].source = "ocr"

                # 3. issue_date y expiry_date: Son físicas del documento, NUNCA sobreescribir
                if "issue_date" in fields_dict:
                    fields_dict["issue_date"].source = "ocr"
                if "expiry_date" in fields_dict:
                    fields_dict["expiry_date"].source = "ocr"

                # 4. Búsqueda automática SBS para completar AFP y CUSPP si están ausentes
                s_pension = (extracted_dict.get("pension_system") or "").strip()
                s_cuspp = (extracted_dict.get("cuspp") or "").strip()
                pat_name = (extracted_dict.get("paternal_surname") or "").strip()
                f_name = (extracted_dict.get("first_names") or "").strip()
                m_name = (extracted_dict.get("maternal_surname") or "").strip()

                if clean_doc_number and pat_name and (not s_pension or s_pension in ("-", "ONP / SNP", "")):
                    try:
                        sbs_data = await SBSService.consultar_trabajador(
                            doc_number=clean_doc_number,
                            paternal_surname=pat_name,
                            maternal_surname=m_name,
                            first_names=f_name,
                            doc_type=effective_doc_type,
                            db=db,
                            force_refresh=False,
                        )
                        if sbs_data.get("success"):
                            afp_found = sbs_data.get("afp_actual") or "ONP / SNP"
                            cuspp_found = sbs_data.get("cuspp") or "-"
                            extracted_dict["pension_system"] = afp_found
                            fields_dict["pension_system"] = FieldConfidence(
                                value=afp_found,
                                confidence=99.0,
                                is_valid=True,
                                status="CONFIRMADO",
                                origin_type="CONSULTA_SBS",
                                source="sbs",
                                anchor_matched=f"SBS Oficial ({sbs_data.get('situacion_actual', 'SPP')})",
                            )
                            if cuspp_found and cuspp_found != "-":
                                extracted_dict["cuspp"] = cuspp_found
                                fields_dict["cuspp"] = FieldConfidence(
                                    value=cuspp_found,
                                    confidence=99.0,
                                    is_valid=True,
                                    status="CONFIRMADO",
                                    origin_type="CONSULTA_SBS",
                                    source="sbs",
                                    anchor_matched=f"SBS CUSPP ({sbs_data.get('fecha_afiliacion_spp', '-')})",
                                )
                    except Exception as err_sbs:
                        logger.warning(f"Error consultando SBS en scan_document: {err_sbs}")

            else:
                err_msg = api_res.get("error", "No se encontró el documento en la base histórica ni en la API.")
                api_status_info = {
                    "queried": True,
                    "success": False,
                    "source": "factiliza",
                    "doc_type": target_query_type,
                    "message": err_msg,
                    "can_fill_manually": True,
                }
                all_warnings.append(f"Aviso: {err_msg}")
        except Exception as e:
            logger.warning(f"Error consultando Data Histórica / API tras OCR: {e}")
            api_status_info = {
                "queried": True,
                "success": False,
                "source": "factiliza",
                "doc_type": target_query_type,
                "message": f"Error en consulta automática: {str(e)}",
                "can_fill_manually": True,
            }
    else:
        api_status_info = {
            "queried": False,
            "success": False,
            "source": "factiliza",
            "doc_type": target_query_type,
            "message": "Número de documento no detectado con formato válido para consultar en la API. Por favor verifica o ingresa los datos manualmente.",
            "can_fill_manually": True,
        }

    # 5. Worker Matcher & Duplicate Detection
    extracted_dni = extracted_dict.get("doc_number", "")
    first_names = extracted_dict.get("first_names", "")
    pat_surname = extracted_dict.get("paternal_surname", "")
    mat_surname = extracted_dict.get("maternal_surname", "")

    match_res = worker_matcher.find_worker(
        raw_dni=extracted_dni,
        first_names=first_names,
        paternal_surname=pat_surname,
        maternal_surname=mat_surname,
        db=db,
    )

    if match_res.duplicate_warning:
        all_warnings.append(match_res.duplicate_warning)

    if match_res.is_probable_correction and match_res.correction_message:
        all_warnings.append(match_res.correction_message)
        # Add candidate proposal to doc_number field
        if "doc_number" in fields_dict:
            fields_dict["doc_number"].status = "REVISAR"
            fields_dict["doc_number"].validation_message = match_res.correction_message
            fields_dict["doc_number"].origin_type = "CORREGIDO_PROBABLE"

    # Quality Metrics
    qm_front = QualityMetric(
        laplacian_var=front_variants_res.laplacian_variance,
        is_blurry=front_variants_res.is_blurry,
        quality_message=front_variants_res.quality_message,
        perspective_corrected=front_variants_res.perspective_corrected,
        original_size=[int(front_variants_res.original_bgr.shape[1]), int(front_variants_res.original_bgr.shape[0])],
        processed_size=[int(front_variants_res.variants.get("clahe_enhanced", list(front_variants_res.variants.values())[0]).image.shape[1]), int(front_variants_res.variants.get("clahe_enhanced", list(front_variants_res.variants.values())[0]).image.shape[0])],
    )
    qm_back = None
    if back_variants_res:
        qm_back = QualityMetric(
            laplacian_var=back_variants_res.laplacian_variance,
            is_blurry=back_variants_res.is_blurry,
            quality_message=back_variants_res.quality_message,
            perspective_corrected=back_variants_res.perspective_corrected,
            original_size=[int(back_variants_res.original_bgr.shape[1]), int(back_variants_res.original_bgr.shape[0])],
            processed_size=[int(back_variants_res.variants.get("clahe_enhanced", list(back_variants_res.variants.values())[0]).image.shape[1]), int(back_variants_res.variants.get("clahe_enhanced", list(back_variants_res.variants.values())[0]).image.shape[0])],
        )

    return ScanResponse(
        success=True,
        doc_type=effective_doc_type,
        doc_subtype=doc_subtype,
        detected_side_front=front_classif.side,
        detected_side_back=back_classif.side if back_classif else None,
        paternal_surname=extracted_dict.get("paternal_surname", ""),
        maternal_surname=extracted_dict.get("maternal_surname", ""),
        first_names=extracted_dict.get("first_names", ""),
        doc_number=extracted_dict.get("doc_number", ""),
        nationality=extracted_dict.get("nationality", "PERUANA"),
        birth_date=extracted_dict.get("birth_date", ""),
        sex=extracted_dict.get("sex", ""),
        address=extracted_dict.get("address", ""),
        ubigeo=extracted_dict.get("ubigeo", ""),
        department=extracted_dict.get("department", ""),
        province=extracted_dict.get("province", ""),
        district=extracted_dict.get("district", ""),
        ubigeo_reniec=extracted_dict.get("ubigeo_reniec", ""),
        ubigeo_inei=extracted_dict.get("ubigeo_inei", ""),
        issue_date=extracted_dict.get("issue_date", ""),
        expiry_date=extracted_dict.get("expiry_date", ""),
        blood_type=extracted_dict.get("blood_type", ""),
        civil_status=extracted_dict.get("civil_status", ""),
        migratory_status=extracted_dict.get("migratory_status", ""),
        phone="999999999",
        email="sincorreo@gmail.com",
        pension_system="",
        pension_commission="",
        cuspp="",
        observations=extracted_dict.get("observations", ""),
        fields=fields_dict,
        quality_front=qm_front,
        quality_back=qm_back,
        front_image_orig=front_orig_url,
        front_image_enhanced=front_enh_url,
        back_image_orig=back_orig_url,
        back_image_enhanced=back_enh_url,
        duplicate_warning=match_res.duplicate_warning,
        worker_match_status=match_res.match_type,
        matched_worker_name=match_res.worker_name,
        matched_worker_dni=match_res.worker_dni,
        warnings=all_warnings,
        api_complemented=api_complemented,
        api_status=api_status_info,
    )


@app.post("/api/scan/standard", response_model=StandardPeruDocResponse)
async def scan_document_standard(
    front_image: UploadFile = File(...),
    back_image: Optional[UploadFile] = File(None),
    doc_type: str = Form("AUTO"),
    db: Session = Depends(get_db),
):
    """
    Endpoint conforme al skill 'ocr-documentos-peru'.
    Retorna estrictamente el esquema JSON estandarizado para DNI Azul, DNIe y Carné de Extranjería.
    """
    scan_resp = await scan_document(
        front_image=front_image,
        back_image=back_image,
        doc_type=doc_type,
        db=db,
    )
    return format_to_standard_peru_doc(scan_resp)


@app.get("/api/factiliza/config")
def get_factiliza_config():
    """Retorna el estado de configuración del Token de Factiliza sin exponer el secreto."""
    saved = get_saved_token()
    return {
        "has_token": bool(saved),
        "masked_token": f"{saved[:6]}...{saved[-4:]}" if len(saved) > 10 else ("***" if saved else ""),
    }


@app.post("/api/factiliza/config")
def set_factiliza_config(req: FactilizaConfigRequest):
    """Guarda o actualiza el Token de Factiliza en la configuración local."""
    clean = req.token.strip()
    save_token(clean)
    return {
        "success": True,
        "has_token": bool(clean),
        "masked_token": f"{clean[:6]}...{clean[-4:]}" if len(clean) > 10 else ("***" if clean else ""),
        "message": "Token de Factiliza guardado correctamente."
    }


def _enrich_worker_match(result: dict, db: Session):
    """Enriquece el resultado con verificación de duplicados de trabajadores."""
    try:
        matcher = WorkerMatcher()
        match_res = matcher.find_worker(
            raw_dni=result.get("doc_number", "") or result.get("dni", ""),
            first_names=result.get("first_names", ""),
            paternal_surname=result.get("paternal_surname", ""),
            maternal_surname=result.get("maternal_surname", ""),
            db=db,
        )
        if match_res:
            result["duplicate_warning"] = match_res.duplicate_warning
            result["worker_match_status"] = match_res.match_type
            result["matched_worker_name"] = match_res.worker_name
            result["matched_worker_dni"] = match_res.worker_dni
    except Exception as e:
        logger.warning(f"Error en WorkerMatcher: {e}")


@app.post("/api/factiliza/dni")
async def lookup_dni_factiliza(req: FactilizaQueryRequest, db: Session = Depends(get_db)):
    """
    Consulta un DNI peruano de 8 dígitos:
    1ª OPCIÓN: Buscar en Data Histórica local (0 tokens consumidos).
    2ª OPCIÓN: Si no existe, recurrir a la API de Factiliza con el token configurado.
    3ª COMPLEMENTO AUTOMÁTICO SBS: Búsqueda en portal SBS para obtener AFP y CUSPP, persistiendo en disco local.
    """
    dni = req.dni or req.doc_number or ""
    clean_dni = re.sub(r"\D", "", dni).strip()

    # 1. Buscar en Data Histórica primero (ahorro de tokens)
    hist_worker = HistoricalDataService.find_worker_by_doc(clean_dni, db)
    if hist_worker:
        # Si ya tiene datos de pensión en histórico, guardar en reporte SBS local para unificar historial
        if hist_worker.get("pension_system"):
            try:
                SBSService.save_record_to_local_disk(
                    doc_num=clean_dni,
                    doc_type="DNI",
                    ap_pat=hist_worker.get("paternal_surname", ""),
                    ap_mat=hist_worker.get("maternal_surname", ""),
                    nombres=hist_worker.get("first_names", ""),
                    sbs_data={
                        "AFP_ACTUAL": hist_worker.get("pension_system", "ONP / SNP"),
                        "CUSPP": hist_worker.get("cuspp", "-"),
                        "FECHA_AFILIACION_SPP": "-",
                        "SITUACION_ACTUAL": "HISTORICO",
                        "ULTIMO_APORTE": "-",
                    },
                    db=db,
                )
            except Exception as e:
                logger.warning(f"Error registrando en SBS local: {e}")

        # Si le falta pensión o CUSPP, consultar a la SBS
        if not hist_worker.get("pension_system") or hist_worker.get("pension_system") in ("-", "ONP / SNP", ""):
            try:
                sbs_data = await SBSService.consultar_trabajador(
                    doc_number=clean_dni,
                    paternal_surname=hist_worker.get("paternal_surname", ""),
                    maternal_surname=hist_worker.get("maternal_surname", ""),
                    first_names=hist_worker.get("first_names", ""),
                    doc_type="DNI",
                    db=db,
                    force_refresh=False,
                )
                if sbs_data.get("success"):
                    hist_worker["pension_system"] = sbs_data.get("afp_actual", "ONP / SNP")
                    hist_worker["cuspp"] = sbs_data.get("cuspp", "-")
                    hist_worker["sbs_status"] = sbs_data
            except Exception as e:
                logger.warning(f"Error consultando SBS para histórico: {e}")

        _enrich_worker_match(hist_worker, db)
        return hist_worker

    # 2. Si no está en Data Histórica, usar Factiliza API
    result = await query_dni_factiliza(dni, req.token)
    if not result.get("success"):
        return result

    # 3. Búsqueda automática en la SBS para completar AFP y CUSPP
    try:
        sbs_data = await SBSService.consultar_trabajador(
            doc_number=clean_dni,
            paternal_surname=result.get("paternal_surname", ""),
            maternal_surname=result.get("maternal_surname", ""),
            first_names=result.get("first_names", ""),
            doc_type="DNI",
            db=db,
            force_refresh=False,
        )
        if sbs_data.get("success"):
            result["pension_system"] = sbs_data.get("afp_actual", "ONP / SNP")
            result["cuspp"] = sbs_data.get("cuspp", "-")
            result["sbs_status"] = sbs_data
    except Exception as e:
        logger.warning(f"Error consultando SBS para {clean_dni}: {e}")

    try:
        HistoricalDataService.save_or_update_worker(clean_dni, result, db)
    except Exception as e:
        logger.warning(f"Error persistiendo resultado Factiliza en HistoricalWorker: {e}")

    _enrich_worker_match(result, db)
    return result


@app.post("/api/factiliza/cee")
async def lookup_cee_factiliza(req: FactilizaQueryRequest, db: Session = Depends(get_db)):
    """
    Consulta un Carnet de Extranjería:
    1ª OPCIÓN: Buscar en Data Histórica local (0 tokens).
    2ª OPCIÓN: Si no existe, recurrir a Factiliza API.
    3ª COMPLEMENTO AUTOMÁTICO SBS: Búsqueda en SBS para completar AFP y CUSPP.
    """
    cee = req.cee or req.doc_number or req.dni or ""
    clean_cee = (cee or "").strip().upper()

    # 1. Buscar en Data Histórica primero
    hist_worker = HistoricalDataService.find_worker_by_doc(clean_cee, db)
    if hist_worker:
        _enrich_worker_match(hist_worker, db)
        return hist_worker

    # 2. Si no está en Data Histórica, usar Factiliza API
    result = await query_cee_factiliza(cee, req.token)
    if not result.get("success"):
        return result

    # 3. Búsqueda automática en SBS
    try:
        sbs_data = await SBSService.consultar_trabajador(
            doc_number=clean_cee,
            paternal_surname=result.get("paternal_surname", ""),
            maternal_surname=result.get("maternal_surname", ""),
            first_names=result.get("first_names", ""),
            doc_type="CE",
            db=db,
            force_refresh=False,
        )
        if sbs_data.get("success"):
            result["pension_system"] = sbs_data.get("afp_actual", "ONP / SNP")
            result["cuspp"] = sbs_data.get("cuspp", "-")
            result["sbs_status"] = sbs_data
    except Exception as e:
        logger.warning(f"Error consultando SBS para CE {clean_cee}: {e}")

    try:
        HistoricalDataService.save_or_update_worker(clean_dni, result, db)
    except Exception as e:
        logger.warning(f"Error persistiendo resultado Factiliza en HistoricalWorker: {e}")

    _enrich_worker_match(result, db)
    return result


@app.post("/api/factiliza/query")
async def lookup_document_factiliza(req: FactilizaQueryRequest, db: Session = Depends(get_db)):
    """
    Consulta cualquier documento (DNI o Carnet de Extranjería) de forma automática:
    1ª OPCIÓN: Buscar en Data Histórica.
    2ª OPCIÓN: Si no existe, recurrir a Factiliza.
    3ª COMPLEMENTO AUTOMÁTICO SBS: Completar AFP y CUSPP.
    """
    doc_num = req.doc_number or req.dni or req.cee or ""
    doc_type = req.doc_type or "DNI"

    # 1. Buscar en Data Histórica primero
    hist_worker = HistoricalDataService.find_worker_by_doc(doc_num, db)
    if hist_worker:
        _enrich_worker_match(hist_worker, db)
        return hist_worker

    # 2. Si no está en Data Histórica, usar Factiliza API
    result = await query_document_factiliza(doc_type, doc_num, req.token)
    if not result.get("success"):
        return result

    # 3. Consulta automática SBS
    try:
        sbs_data = await SBSService.consultar_trabajador(
            doc_number=doc_num,
            paternal_surname=result.get("paternal_surname", ""),
            maternal_surname=result.get("maternal_surname", ""),
            first_names=result.get("first_names", ""),
            doc_type=doc_type,
            db=db,
            force_refresh=False,
        )
        if sbs_data.get("success"):
            result["pension_system"] = sbs_data.get("afp_actual", "ONP / SNP")
            result["cuspp"] = sbs_data.get("cuspp", "-")
            result["sbs_status"] = sbs_data
    except Exception as e:
        logger.warning(f"Error consultando SBS para {doc_num}: {e}")

    try:
        HistoricalDataService.save_or_update_worker(clean_dni, result, db)
    except Exception as e:
        logger.warning(f"Error persistiendo resultado Factiliza en HistoricalWorker: {e}")

    _enrich_worker_match(result, db)
    return result


@app.post("/api/factiliza/batch")
async def batch_lookup_factiliza(req: FactilizaBatchRequest, db: Session = Depends(get_db)):
    """
    Búsqueda masiva por lote de DNIs:
    1ª OPCIÓN: Resolver todos los posibles en Data Histórica local (sin consumir tokens).
    2ª OPCIÓN: Consultar a Factiliza solo los DNIs que no existan en Data Histórica.
    """
    all_results = []
    missing_dnis = []

    for d in req.dnis:
        clean_d = re.sub(r"\D", "", d or "").strip()
        if not clean_d:
            continue
        hist_worker = HistoricalDataService.find_worker_by_doc(clean_d, db)
        if hist_worker:
            hist_worker["dni"] = clean_d
            _enrich_worker_match(hist_worker, db)
            all_results.append(hist_worker)
        else:
            missing_dnis.append(clean_d)

    # Solo consultar a la API los que falten
    if missing_dnis:
        batch_res = await query_batch_factiliza(missing_dnis, req.token)
        for item in batch_res.get("results", []):
            if item.get("success"):
                try:
                    _enrich_worker_match(item, db)
                except Exception as e:
                    logger.warning(f"Error enriching worker match for {item.get('dni')}: {e}")
            all_results.append(item)

    found_count = sum(1 for r in all_results if r.get("success"))
    hist_count = sum(1 for r in all_results if r.get("source") == "data_historica")
    api_count = sum(1 for r in all_results if r.get("source") == "factiliza")

    return {
        "success": True,
        "total_requested": len(req.dnis),
        "found_count": found_count,
        "not_found_count": len(all_results) - found_count,
        "historical_count": hist_count,
        "api_count": api_count,
        "message": f"{hist_count} resueltos desde Data Histórica (0 tokens), {api_count} consultados en Factiliza.",
        "results": all_results,
    }


@app.get("/api/historical/stats")
def get_historical_data_stats(db: Session = Depends(get_db)):
    """Retorna las estadísticas del padrón de Data Histórica."""
    return HistoricalDataService.get_stats(db)


@app.post("/api/historical/sync")
def sync_historical_data(db: Session = Depends(get_db)):
    """Sincroniza el archivo DATA_HISTORICA.xlsx en la base de datos local SQLite."""
    return HistoricalDataService.import_from_excel(db=db)


# =========================================================================
# ENDPOINTS OFICIALES SBS (SITUACIÓN PREVISIONAL - AFP Y CUSPP)
# =========================================================================

@app.post("/api/sbs/consultar")
async def consultar_sbs_endpoint(req: SBSQueryRequest, db: Session = Depends(get_db)):
    """
    Consulta la situación previsional de un trabajador en la SBS (AFP, CUSPP, Estado, Último Aporte).
    Persiste automáticamente los resultados en disco local (SQLite + Excel REPORTE_SBS_HISTORICO.xlsx).
    """
    res = await SBSService.consultar_trabajador(
        doc_number=req.doc_number,
        paternal_surname=req.paternal_surname,
        maternal_surname=req.maternal_surname or "",
        first_names=req.first_names or "",
        doc_type=req.doc_type or "DNI",
        db=db,
        force_refresh=bool(req.force_refresh),
    )
    return res


@app.get("/api/sbs/stats")
def get_sbs_stats(db: Session = Depends(get_db)):
    """Retorna estadísticas de registros SBS guardados en disco local."""
    return SBSService.get_stats(db)


@app.get("/api/sbs/records")
def list_sbs_records(limit: int = 100, db: Session = Depends(get_db)):
    """Retorna los últimos registros consultados en la SBS desde la base local."""
    records = db.query(SBSRecord).order_by(SBSRecord.consulted_at.desc()).limit(limit).all()
    return {
        "success": True,
        "total": len(records),
        "records": [r.to_dict() for r in records],
    }


@app.get("/api/sbs/download-excel")
def download_sbs_excel():
    """Descarga el reporte maestro de consultas SBS acumulado en disco local (Excel)."""
    excel_path = SBSService.get_excel_report_path()
    if not excel_path.exists():
        raise HTTPException(status_code=404, detail="El archivo Excel de reportes SBS aún no ha sido generado.")
    return FileResponse(
        path=str(excel_path),
        filename="REPORTE_SBS_HISTORICO.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@app.post("/api/factiliza/batch-save")
def batch_save_factiliza(req: FactilizaBatchSaveRequest, db: Session = Depends(get_db)):
    """
    Guarda masivamente en SQLite y Registros.xlsx todos los trabajadores encontrados en la búsqueda masiva.
    """
    saved = []
    skipped = []
    now = get_peru_now()

    for item in req.records:
        dni = (item.get("doc_number") or item.get("dni") or "").strip()
        if not dni:
            continue

        # Verificar si ya existe en la base de datos
        existing = db.query(ScannedRecord).filter(ScannedRecord.doc_number == dni).first()
        if existing:
            skipped.append(dni)
            continue

        try:
            db_record = ScannedRecord(
                scan_date=now,
                doc_type=item.get("doc_type") or "DNI",
                paternal_surname=(item.get("paternal_surname") or "").strip().upper(),
                maternal_surname=(item.get("maternal_surname") or "").strip().upper(),
                first_names=(item.get("first_names") or "").strip().upper(),
                doc_number=dni,
                nationality=(item.get("nationality") or "PERUANA").strip().upper(),
                birth_date=(item.get("birth_date") or "").strip(),
                sex=(item.get("sex") or "").strip().upper(),
                address=(item.get("address") or "").strip(),
                ubigeo=(item.get("district") or item.get("ubigeo_inei") or "").strip(),
                department=(item.get("department") or "").strip().upper(),
                province=(item.get("province") or "").strip().upper(),
                district=(item.get("district") or "").strip().upper(),
                ubigeo_reniec=(item.get("ubigeo_reniec") or "").strip(),
                ubigeo_inei=(item.get("ubigeo_inei") or "").strip(),
                phone=(item.get("phone") or "999999999").strip(),
                email=(item.get("email") or "sincorreo@gmail.com").strip(),
                pension_system=(item.get("pension_system") or "").strip().upper(),
                pension_commission="",
                cuspp=(item.get("cuspp") or "").strip().upper(),
                cod_planilla=(req.cod_planilla or "ORP").strip().upper()[:3],
                tipo_contrato=(req.tipo_contrato or "05").strip()[:2],
                basico=req.basico if req.basico is not None else 1025.0,
                inicio_contrato=(req.inicio_contrato or "").strip(),
                duracion=(req.duracion or "3").strip(),
                fin_contrato=(req.fin_contrato or "").strip(),
                cod_cargo="048",
                cod_tipo_trab="76",
                cat_ocupacional="02",
                period_pago="3",
                cod_sucursal="CA3",
                grupo_trabajo="013",
                tipo_personal="05",
                reg_laboral="26",
                niv_educativo="007",
                tipo_comision="0",
                asignacion_familiar="NO",
                observations=f"Carga Masiva Factiliza {now.strftime('%d/%m/%Y')}",
                field_confidences=json.dumps({"source": "factiliza_batch"}),
            )
            db.add(db_record)
            db.commit()
            db.refresh(db_record)

            # Agregar a Registros.xlsx
            try:
                append_record_to_excel(db_record.to_dict())
            except Exception as e:
                logger.warning(f"Error agregando al Excel para DNI {dni}: {e}")

            saved.append(dni)
        except Exception as e:
            logger.error(f"Error guardando registro en lote para DNI {dni}: {e}")
            db.rollback()

    # Ejecutar backup automático
    try:
        backup_service.create_backup("batch_factiliza_saved")
    except Exception as e:
        logger.warning(f"Backup automático post-batch falló: {e}")

    return {
        "success": True,
        "saved_count": len(saved),
        "skipped_count": len(skipped),
        "saved_dnis": saved,
        "skipped_dnis": skipped,
        "message": f"Se guardaron exitosamente {len(saved)} trabajadores en la Base de Datos y Registros.xlsx" + (f" ({len(skipped)} omitidos porque ya estaban registrados)." if skipped else "."),
    }


@app.post("/api/factiliza/batch-export-excel")
def export_batch_excel(req: FactilizaBatchSaveRequest):
    """
    Genera un archivo Excel (.xlsx) estructurado con los resultados de la consulta masiva.
    """
    import io
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from fastapi.responses import Response

    wb = Workbook()
    ws = wb.active
    ws.title = "Consulta Masiva Factiliza"

    headers = [
        "N°", "DNI", "APELLIDO PATERNO", "APELLIDO MATERNO", "NOMBRES",
        "NOMBRE COMPLETO", "SEXO", "FECHA NACIMIENTO", "DEPARTAMENTO",
        "PROVINCIA", "DISTRITO", "UBIGEO INEI", "UBIGEO RENIEC", "DIRECCIÓN", "ESTADO EN PADRÓN"
    ]
    ws.append(headers)

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="0A3D44", end_color="0A3D44", fill_type="solid")
    align_center = Alignment(horizontal="center", vertical="center")

    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = align_center

    for i, item in enumerate(req.records, 1):
        full = item.get("full_name") or f"{item.get('first_names', '')} {item.get('paternal_surname', '')} {item.get('maternal_surname', '')}".strip()
        row = [
            i,
            item.get("doc_number") or item.get("dni", ""),
            item.get("paternal_surname", ""),
            item.get("maternal_surname", ""),
            item.get("first_names", ""),
            full,
            item.get("sex", ""),
            item.get("birth_date", ""),
            item.get("department", ""),
            item.get("province", ""),
            item.get("district", ""),
            item.get("ubigeo_inei", ""),
            item.get("ubigeo_reniec", ""),
            item.get("address", ""),
            (item.get("status") or ("ENCONTRADO" if item.get("success") else "NO ENCONTRADO")).upper(),
        ]
        ws.append(row)

    # Ajustar ancho automático de columnas
    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        col_letter = col[0].column_letter
        ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    filename = f"Consulta_Masiva_DNI_{get_peru_now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return Response(
        content=buf.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )



@app.post("/api/records", response_model=RecordResponse)
def create_record(record_in: RecordCreate, db: Session = Depends(get_db)):
    """
    Guarda el registro confirmado/editado en SQLite, actualiza Registros.xlsx
    y audita las correcciones en el log de aprendizaje continuo.
    """
    now = get_peru_now()
    confidences_json = json.dumps(record_in.field_confidences or {})

    db_record = ScannedRecord(
        scan_date=now,
        doc_type=record_in.doc_type,
        paternal_surname=record_in.paternal_surname.strip().upper(),
        maternal_surname=record_in.maternal_surname.strip().upper(),
        first_names=record_in.first_names.strip().upper(),
        doc_number=record_in.doc_number.strip().upper(),
        nationality=record_in.nationality.strip().upper() or ("PERUANA" if record_in.doc_type == "DNI" else ""),
        birth_date=record_in.birth_date.strip(),
        sex=record_in.sex.strip().upper(),
        address=record_in.address.strip(),
        ubigeo=record_in.ubigeo.strip(),
        department=(record_in.department or "").strip().upper(),
        province=(record_in.province or "").strip().upper(),
        district=(record_in.district or "").strip().upper(),
        ubigeo_reniec=(record_in.ubigeo_reniec or "").strip(),
        ubigeo_inei=(record_in.ubigeo_inei or "").strip(),
        issue_date=record_in.issue_date.strip(),
        expiry_date=record_in.expiry_date.strip(),
        blood_type=record_in.blood_type.strip(),
        civil_status=record_in.civil_status.strip(),
        migratory_status=record_in.migratory_status.strip(),
        phone=(record_in.phone or "999999999").strip(),
        email=(record_in.email or "sincorreo@gmail.com").strip(),
        pension_system=(record_in.pension_system or "").strip().upper(),
        pension_commission=(record_in.pension_commission or "").strip().upper(),
        cuspp=(record_in.cuspp or "").strip().upper(),
        # Contract NISIRA assignment fields
        cod_planilla=(record_in.cod_planilla or "ORP").strip().upper()[:3],
        nro_contrato=(record_in.nro_contrato or "").strip(),
        basico=record_in.basico if record_in.basico is not None else 1025.0,
        inicio_contrato=(record_in.inicio_contrato or "").strip(),
        duracion=(record_in.duracion or "3").strip(),
        fin_contrato=(record_in.fin_contrato or "").strip(),
        fecha_firma_contrato=(record_in.fecha_firma_contrato or "").strip(),
        tipo_contrato=(record_in.tipo_contrato or "05").strip().zfill(2) if (record_in.tipo_contrato and record_in.tipo_contrato.strip().isdigit()) else (record_in.tipo_contrato or "05").strip()[:2],
        nro_contrato_ref=(record_in.nro_contrato_ref or "").strip(),
        # Personal NISIRA fields (Defaults para OBRERO DE PLANTA)
        cod_cargo=(record_in.cod_cargo or "048").strip().zfill(3),
        cod_tipo_trab=(record_in.cod_tipo_trab or "76").strip()[:2],
        cat_ocupacional=(record_in.cat_ocupacional or "02").strip().zfill(2),
        period_pago=(record_in.period_pago or "3").strip()[:1],
        cod_sucursal=(record_in.cod_sucursal or "CA3").strip().upper()[:3],
        grupo_trabajo=(record_in.grupo_trabajo or "013").strip().zfill(3),
        tipo_personal=(record_in.tipo_personal or "05").strip().zfill(2),
        reg_laboral=(record_in.reg_laboral or "26").strip()[:2],
        niv_educativo=(record_in.niv_educativo or "007").strip().zfill(3),
        tipo_comision=(record_in.tipo_comision or "0").strip()[:1],
        asignacion_familiar=(record_in.asignacion_familiar or "NO").strip().upper(),
        fec_ingreso=(record_in.fec_ingreso or "").strip(),
        observations=record_in.observations.strip(),
        front_image_orig=record_in.front_image_orig or "",
        front_image_enhanced=record_in.front_image_enhanced or "",
        back_image_orig=record_in.back_image_orig or "",
        back_image_enhanced=record_in.back_image_enhanced or "",
        quality_score_front=record_in.quality_score_front,
        quality_score_back=record_in.quality_score_back,
        is_blurry_front=record_in.is_blurry_front,
        is_blurry_back=record_in.is_blurry_back,
        field_confidences=confidences_json,
    )

    db.add(db_record)
    db.commit()
    db.refresh(db_record)

    # Log user corrections for continuous learning
    if record_in.field_confidences:
        confirmed_map = {
            "doc_number": record_in.doc_number,
            "paternal_surname": record_in.paternal_surname,
            "maternal_surname": record_in.maternal_surname,
            "first_names": record_in.first_names,
            "birth_date": record_in.birth_date,
            "sex": record_in.sex,
            "address": record_in.address,
            "ubigeo": record_in.ubigeo,
            "issue_date": record_in.issue_date,
            "expiry_date": record_in.expiry_date,
        }
        try:
            LearningService.log_corrections(
                db=db,
                doc_type=record_in.doc_type,
                doc_number=record_in.doc_number,
                raw_ocr_fields=record_in.field_confidences,
                confirmed_fields=confirmed_map,
            )
        except Exception as e:
            print(f"Warning: No se pudo registrar log de aprendizaje: {e}")

    # Append to Master Excel file
    try:
        append_record_to_excel(db_record.to_dict())
    except Exception as e:
        print(f"Warning: No se pudo agregar al Excel maestro: {e}")

    # Auto backup to ensure permanent persistence and recovery point
    try:
        backup_service.create_backup("record_saved")
    except Exception as e:
        print(f"Warning: No se pudo generar copia de seguridad automática: {e}")

    # Guardar en HistoricalWorker para que futuras consultas no consuman Factiliza
    try:
        HistoricalDataService.save_or_update_worker(db_record.doc_number, db_record.to_dict(), db)
    except Exception as e:
        logger.warning(f"Error actualizando HistoricalWorker al guardar record: {e}")

    return RecordResponse(**db_record.to_dict())



@app.post("/api/scan-and-save")
async def scan_and_save_document(
    front_image: UploadFile = File(...),
    back_image: Optional[UploadFile] = File(None),
    doc_type: str = Form("DNI"),
    db: Session = Depends(get_db),
):
    """
    Escaneo y guardado atómico para procesamiento por lote de DNI:
    1. Ejecuta el recorte y lectura OCR con OpenCV y RapidOCR AI.
    2. Guarda de forma automática el registro en SQLite (ScannedRecord).
    3. Agrega el registro en Registros.xlsx.
    4. Retorna el resultado escaneado y el registro persistido con su ID.
    """
    # 1. Ejecutar escaneo
    scan_res = await scan_document(
        front_image=front_image,
        back_image=back_image,
        doc_type=doc_type,
        db=db
    )

    # 2. Preparar confianzas de campos
    field_confs = {}
    for f_name, f_val in scan_res.fields.items():
        if hasattr(f_val, 'model_dump'):
            field_confs[f_name] = f_val.model_dump()
        elif hasattr(f_val, 'dict'):
            field_confs[f_name] = f_val.dict()
        elif isinstance(f_val, dict):
            field_confs[f_name] = f_val

    record_in = RecordCreate(
        doc_type=scan_res.doc_type,
        paternal_surname=scan_res.paternal_surname,
        maternal_surname=scan_res.maternal_surname,
        first_names=scan_res.first_names,
        doc_number=scan_res.doc_number,
        nationality=scan_res.nationality,
        birth_date=scan_res.birth_date,
        sex=scan_res.sex,
        address=scan_res.address,
        ubigeo=scan_res.ubigeo,
        department=scan_res.department or "",
        province=scan_res.province or "",
        district=scan_res.district or "",
        ubigeo_reniec=scan_res.ubigeo_reniec or "",
        ubigeo_inei=scan_res.ubigeo_inei or "",
        issue_date=scan_res.issue_date,
        expiry_date=scan_res.expiry_date,
        blood_type=scan_res.blood_type,
        civil_status=scan_res.civil_status,
        migratory_status=scan_res.migratory_status,
        phone=scan_res.phone or "999999999",
        email=scan_res.email or "sincorreo@gmail.com",
        pension_system=scan_res.pension_system or "",
        pension_commission=scan_res.pension_commission or "",
        cuspp=scan_res.cuspp or "",
        observations=scan_res.observations,
        front_image_orig=scan_res.front_image_orig,
        front_image_enhanced=scan_res.front_image_enhanced,
        back_image_orig=scan_res.back_image_orig,
        back_image_enhanced=scan_res.back_image_enhanced,
        quality_score_front=scan_res.quality_front.laplacian_var if scan_res.quality_front else None,
        quality_score_back=scan_res.quality_back.laplacian_var if scan_res.quality_back else None,
        is_blurry_front=scan_res.quality_front.is_blurry if scan_res.quality_front else False,
        is_blurry_back=scan_res.quality_back.is_blurry if scan_res.quality_back else False,
        field_confidences=field_confs,
    )

    created_record = create_record(record_in=record_in, db=db)
    record_dict = created_record.model_dump() if hasattr(created_record, 'model_dump') else created_record.dict()
    scan_dict = scan_res.model_dump() if hasattr(scan_res, 'model_dump') else scan_res.dict()

    return {
        "success": True,
        "record": record_dict,
        "scan_data": scan_dict,
    }


@app.post("/api/v1/scan-dni")
async def scan_dni_v1(
    file: Optional[UploadFile] = File(None),
    image: Optional[UploadFile] = File(None),
):
    """
    Endpoint directo de extracción de datos de DNI Peruano (DNI 8 dígitos, Nombres y Apellidos)
    a partir de fotos de celular o archivos subidos, utilizando OpenCV + RapidOCR + Regex
    sin necesidad de etiquetado manual.
    """
    upload_file = file or image
    if upload_file is None:
        raise HTTPException(
            status_code=400,
            detail="Debe proporcionar un archivo de imagen en el campo 'file' o 'image'."
        )

    img_bytes = await upload_file.read()
    if not img_bytes:
        raise HTTPException(status_code=400, detail="El archivo de imagen proporcionado está vacío.")

    try:
        data = extract_dni_from_bytes(img_bytes)
        return {
            "dni": data.get("dni", ""),
            "nombres": data.get("nombres", ""),
            "apellidos": data.get("apellidos", ""),
            "paterno": data.get("paterno", ""),
            "materno": data.get("materno", ""),
            "success": data.get("success", False),
            "raw_text": data.get("raw_text", ""),
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al procesar la imagen con el motor OCR: {str(e)}"
        )


@app.post("/api/v1/scan-folder")
def scan_folder_api(
    folder_path: str = Query("DNIS", description="Ruta de la carpeta dentro del proyecto o absoluta"),
    recursive: bool = Query(True, description="Buscar imágenes recursivamente en subcarpetas"),
    limit: Optional[int] = Query(None, description="Límite opcional de imágenes a procesar"),
):
    """
    Escanea en lote una carpeta del proyecto (ej: DNIS, ENTRADA o ruta completa)
    extrayendo DNI, Nombres y Apellidos de cada imagen con OpenCV + RapidOCR + Regex.
    """
    target_dir = Path(folder_path)
    if not target_dir.is_absolute():
        target_dir = _PROJECT_ROOT / folder_path

    if not target_dir.exists():
        raise HTTPException(status_code=404, detail=f"La carpeta '{target_dir}' no existe.")

    valid_extensions = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}
    if recursive:
        image_files = [f for f in target_dir.rglob("*") if f.is_file() and f.suffix.lower() in valid_extensions]
    else:
        image_files = [f for f in target_dir.iterdir() if f.is_file() and f.suffix.lower() in valid_extensions]

    image_files.sort(key=lambda x: str(x).lower())
    if limit and limit > 0:
        image_files = image_files[:limit]

    results = []
    for idx, img_path in enumerate(image_files, 1):
        try:
            img_bytes = img_path.read_bytes()
            extracted = extract_dni_from_bytes(img_bytes)
            results.append({
                "index": idx,
                "file_name": img_path.name,
                "file_path": str(img_path),
                "dni": extracted.get("dni", ""),
                "apellidos": extracted.get("apellidos", ""),
                "nombres": extracted.get("nombres", ""),
                "paterno": extracted.get("paterno", ""),
                "materno": extracted.get("materno", ""),
                "success": extracted.get("success", False),
            })
        except Exception as e:
            results.append({
                "index": idx,
                "file_name": img_path.name,
                "file_path": str(img_path),
                "error": str(e),
                "success": False,
            })

    total_success = sum(1 for r in results if r.get("success"))

    return {
        "folder": str(target_dir),
        "total_images": len(image_files),
        "total_detected": total_success,
        "results": results,
    }


@app.post("/api/ocr/diagnostic")
async def get_ocr_diagnostic(
    image: UploadFile = File(...),
    doc_type: str = Form("DNI"),
):
    """
    Panel técnico/diagnóstico: ejecuta el pipeline multi-variante y retorna
    la inspección visual de las 6 variantes, resultados de cada pasada OCR y consenso.
    """
    img_bytes = await image.read()
    if not img_bytes:
        raise HTTPException(status_code=400, detail="Imagen inválida")

    var_res = generate_multi_variants(img_bytes)
    ocr_engine = get_ocr_engine()
    consensus_engine = ConsensusEngine(ocr_engine)
    cons_res = consensus_engine.run_multi_attempt_ocr(var_res)

    classif = classify_document(
        image_bgr=var_res.original_bgr,
        ocr_text=cons_res.primary_ocr.full_text,
        declared_type=doc_type,
    )

    passes_summary = []
    for p in cons_res.passes:
        # Save temporary thumbnail of variant
        fn = save_image_matrix(p.ocr_result.raw_data if hasattr(p, 'image') else var_res.variants[p.variant_name].image, f"diag_{p.variant_name}")
        passes_summary.append({
            "variant_name": p.variant_name,
            "description": p.description,
            "image_url": f"/uploads/{fn}",
            "quality_score": p.quality_score,
            "line_count": p.line_count,
            "word_count": p.word_count,
            "avg_confidence": p.avg_confidence,
            "full_text_sample": p.ocr_result.full_text[:300],
            "mrz_detected": bool(p.mrz_text),
        })

    return {
        "success": True,
        "classification": {
            "doc_type": classif.doc_type,
            "doc_subtype": classif.doc_subtype,
            "side": classif.side,
            "confidence": classif.confidence,
            "detected_features": classif.detected_features,
            "has_mrz": classif.has_mrz,
            "has_photo": classif.has_photo,
        },
        "quality_metrics": {
            "laplacian_variance": var_res.laplacian_variance,
            "is_blurry": var_res.is_blurry,
            "has_shadows": var_res.has_shadows,
            "has_glare": var_res.has_glare,
            "perspective_corrected": var_res.perspective_corrected,
            "quality_message": var_res.quality_message,
        },
        "consensus": {
            "total_variants_run": cons_res.total_variants_run,
            "best_variant_name": cons_res.best_variant_name,
            "summary": cons_res.consensus_summary,
            "candidate_pools": cons_res.candidate_pools,
            "passes": passes_summary,
        }
    }


@app.get("/api/ocr/learning-stats")
def get_ocr_learning_stats(db: Session = Depends(get_db)):
    """Retorna métricas de aprendizaje continuo y campos más corregidos por operadores."""
    return LearningService.get_learning_stats(db)


@app.get("/api/records", response_model=PaginatedRecordsResponse)
def list_records(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    doc_type: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Lists scanned records with search, filter, and pagination."""
    query = db.query(ScannedRecord)

    if doc_type and doc_type in ["DNI", "Carnet de Extranjería"]:
        query = query.filter(ScannedRecord.doc_type == doc_type)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                ScannedRecord.doc_number.ilike(s),
                ScannedRecord.paternal_surname.ilike(s),
                ScannedRecord.maternal_surname.ilike(s),
                ScannedRecord.first_names.ilike(s),
                ScannedRecord.address.ilike(s),
            )
        )

    if start_date:
        try:
            dt_start = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(ScannedRecord.scan_date >= dt_start)
        except ValueError:
            pass

    if end_date:
        try:
            dt_end = datetime.strptime(f"{end_date} 23:59:59", "%Y-%m-%d %H:%M:%S")
            query = query.filter(ScannedRecord.scan_date <= dt_end)
        except ValueError:
            pass

    total = query.count()
    items = (
        query.order_by(desc(ScannedRecord.scan_date))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return PaginatedRecordsResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[RecordResponse(**item.to_dict()) for item in items],
    )


@app.get("/api/records/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)):
    """Summary metrics for the dashboard."""
    total = db.query(ScannedRecord).count()
    dni_cnt = db.query(ScannedRecord).filter(ScannedRecord.doc_type == "DNI").count()
    ce_cnt = db.query(ScannedRecord).filter(ScannedRecord.doc_type == "Carnet de Extranjería").count()
    
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_cnt = db.query(ScannedRecord).filter(ScannedRecord.scan_date >= today_start).count()

    return StatsResponse(
        total_records=total,
        dni_count=dni_cnt,
        ce_count=ce_cnt,
        scanned_today=today_cnt,
    )


@app.get("/api/records/{record_id}", response_model=RecordResponse)
def get_record(record_id: int, db: Session = Depends(get_db)):
    """Retrieves a single record by ID."""
    rec = db.query(ScannedRecord).filter(ScannedRecord.id == record_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    return RecordResponse(**rec.to_dict())


@app.delete("/api/records/{record_id}")
def delete_record(record_id: int, db: Session = Depends(get_db)):
    """Deletes a record from SQLite database."""
    rec = db.query(ScannedRecord).filter(ScannedRecord.id == record_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    db.delete(rec)
    db.commit()
    return {"success": True, "message": f"Registro #{record_id} eliminado exitosamente."}


@app.get("/api/export-excel")
def export_excel(
    search: Optional[str] = Query(None),
    doc_type: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Downloads either the full master Registros.xlsx or a dynamically filtered export.
    """
    query = db.query(ScannedRecord)

    is_filtered = bool(search or doc_type or start_date or end_date)

    if doc_type and doc_type in ["DNI", "Carnet de Extranjería"]:
        query = query.filter(ScannedRecord.doc_type == doc_type)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                ScannedRecord.doc_number.ilike(s),
                ScannedRecord.paternal_surname.ilike(s),
                ScannedRecord.maternal_surname.ilike(s),
                ScannedRecord.first_names.ilike(s),
            )
        )

    if start_date:
        try:
            dt_start = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(ScannedRecord.scan_date >= dt_start)
        except ValueError:
            pass

    if end_date:
        try:
            dt_end = datetime.strptime(f"{end_date} 23:59:59", "%Y-%m-%d %H:%M:%S")
            query = query.filter(ScannedRecord.scan_date <= dt_end)
        except ValueError:
            pass

    records = query.order_by(desc(ScannedRecord.scan_date)).all()
    records_data = [r.to_dict() for r in records]

    timestamp_str = get_peru_now().strftime("%Y%m%d_%H%M%S")
    temp_filename = f"Export_Registros_{timestamp_str}.xlsx"
    temp_path = EXPORTS_DIR / temp_filename

    # If no filters and master excel exists with all records, we can also generate a clean copy
    generate_filtered_excel(records_data, temp_path)

    return FileResponse(
        path=str(temp_path),
        filename=f"Registros_Documentos_Peruanos_{timestamp_str}.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


# =========================================================================
# Servicios de Inteligencia de Excel, Consolidación y Generación de Contratos
# =========================================================================

excel_analyzer = ExcelAnalyzer(MASTER_EXCEL_PATH)
worker_consolidator = WorkerConsolidator(MASTER_EXCEL_PATH)
contract_generator = ContractGenerator(TEMPLATES_DIR, CONTRACTS_DIR)


@app.get("/api/worker/search/{dni}", response_model=WorkerProfileResponse)
def search_and_consolidate_worker(dni: str, db: Session = Depends(get_db)):
    """
    Busca al trabajador por DNI en el Excel (hojas visibles/ocultas, comentarios y notas)
    y en la base de datos de escaneos previos, retornando su ficha consolidada con procedencia de datos.
    """
    clean_dni = re.sub(r"\D", "", dni).strip()
    if not clean_dni:
        raise HTTPException(status_code=400, detail="DNI inválido")

    # Verificar si existe algún escaneo previo en BD para enriquecer
    latest_scan = (
        db.query(ScannedRecord)
        .filter(ScannedRecord.doc_number.ilike(f"%{clean_dni}%"))
        .order_by(desc(ScannedRecord.scan_date))
        .first()
    )
    ocr_data = latest_scan.to_dict() if latest_scan else {}

    profile = worker_consolidator.consolidate_worker_profile(clean_dni, ocr_data=ocr_data)
    return profile


@app.post("/api/worker/consolidate", response_model=WorkerProfileResponse)
def consolidate_worker_from_scan(payload: Dict[str, Any]):
    """
    Fusiona los datos extraídos en tiempo real por el OCR con la búsqueda profunda en Excel.
    """
    dni = payload.get("dni") or payload.get("doc_number", "")
    ocr_data = payload.get("ocr_data") or payload
    clean_dni = re.sub(r"\D", "", str(dni)).strip()

    if not clean_dni:
        raise HTTPException(status_code=400, detail="Número de DNI no detectado")

    profile = worker_consolidator.consolidate_worker_profile(clean_dni, ocr_data=ocr_data)
    return profile


OFFICIAL_TIPOS_CONTRATO = [
    {"code": "01", "description": "OBREROS AGRARIO - MANDOS MEDIOS"},
    {"code": "02", "description": "EMPLEADOS AGRARIO"},
    {"code": "03", "description": "EMPLEADOS GENERAL"},
    {"code": "04", "description": "OBREROS AGRARIO - MANDOS MEDIAS RENOVACION"},
    {"code": "05", "description": "OBREROS AGRARIO PLANTA - DE EXPORTACIÓN NO TRADICIONAL D.LEY 22342"},
    {"code": "06", "description": "RENOVACION OBREROS AGRARIO PLANTA - DE EXPORTACIÓN NO TRADICIONAL D.LEY 22342"},
    {"code": "07", "description": "OBREROS AGR EXTRANJEROS - DE EXTRANJERO - D.LEG. 689"},
    {"code": "08", "description": "RENOVACION DE CONTRATO AGR EXTRANJERO D.LEG.689"},
    {"code": "09", "description": "CONTRATO OBREROS AGRARIO - CAMPO"},
    {"code": "10", "description": "RENOVACION CONTRATO OBREROS AGRARIO - CAMPO"},
    {"code": "11", "description": "OBREROS AGRARIO - INDETERMINADO"},
    {"code": "12", "description": "EMPLEADOS GENERAL - RENOVACION DE CONTRATO"},
    {"code": "13", "description": "CONTRATO ERG- ASISTENTE Y ANALISTA"},
    {"code": "14", "description": "RENOVACION CONTRATO ERG- ASISTENTE Y ANALISTA"},
    {"code": "15", "description": "1ER-CONTRATO ERA - SUPERVISORES"},
    {"code": "16", "description": "RENOVACION DE CONTRATO ERA - SUPERVISORES"},
    {"code": "17", "description": "EMPLEADO AGRARIO - INDETERMINADO"},
    {"code": "18", "description": "EMPLEADO GENERAL - INDETERMINADO"},
    {"code": "19", "description": "RENOVACION OBRERO_MANGO"},
    {"code": "20", "description": "RENOVACION OBREROS_FRESA_A_MANGO"},
    {"code": "21", "description": "CONTRATO OBRERO_MANGO"},
    {"code": "22", "description": "RENOVACION OBREROS AGRARIO - PLANTA-PALTA"},
]

OFFICIAL_CODIGOS_PLANILLA = [
    {"code": "ERA", "description": "EMPLEADOS REGIMEN AGRARIO"},
    {"code": "ERG", "description": "EMPLEADOS REGIMEN GENERAL"},
    {"code": "ORA", "description": "TEMPORAL"},
    {"code": "ORC", "description": "OBREROS AGRARIO CAMPO"},
    {"code": "ORP", "description": "OBREROS AGRARIO PLANTA"},
    {"code": "PAR", "description": "PRACTICANTES"},
]


@app.get("/api/contracts/catalogs")
def get_contract_catalogs():
    """
    Retorna los catálogos oficiales para asignación de contratos:
    22 Tipos de Contrato (formato 2 dígitos) y 6 Códigos de Planilla (formato 3 caracteres).
    """
    return {
        "tipos_contrato": OFFICIAL_TIPOS_CONTRATO,
        "codigos_planilla": OFFICIAL_CODIGOS_PLANILLA,
    }


@app.post("/api/scanned-records/batch-contracts-update")
def batch_update_contract_fields(req: ContractBatchUpdateRequest, db: Session = Depends(get_db)):
    """
    Actualización masiva de campos de contrato para una o varias filas seleccionadas.
    REGLA ESTRICTA: Solo sobrescribe los campos que el usuario explícitamente marcó para actualizar.
    Conserva los campos no seleccionados.
    """
    if not req.record_ids:
        raise HTTPException(status_code=400, detail="No se proporcionaron IDs de registros a actualizar")

    allowed_fields = {
        # Contratos NISIRA
        "cod_planilla", "nro_contrato", "basico", "inicio_contrato",
        "duracion", "fin_contrato", "fecha_firma_contrato", "tipo_contrato", "nro_contrato_ref",
        # Datos de Personal NISIRA
        "cod_cargo", "cod_tipo_trab", "cat_ocupacional", "period_pago",
        "cod_sucursal", "grupo_trabajo", "tipo_personal", "reg_laboral",
        "niv_educativo", "tipo_comision", "asignacion_familiar", "fec_ingreso",
        "pension_system", "cuspp", "civil_status", "nationality", "sex", "phone", "email", "address", "ubigeo"
    }

    clean_updates = {}
    for k, v in req.updates.items():
        if k in allowed_fields:
            if k == "tipo_contrato":
                s_v = str(v).strip()
                if s_v.isdigit() and len(s_v) == 1:
                    clean_updates[k] = f"0{s_v}"
                elif s_v.isdigit() and len(s_v) == 2:
                    clean_updates[k] = s_v
                else:
                    clean_updates[k] = s_v[:2]
            elif k == "cod_planilla":
                clean_updates[k] = str(v).strip().upper()[:3]
            elif k == "cod_cargo":
                s_v = str(v).strip()
                clean_updates[k] = s_v.zfill(3) if s_v.isdigit() else s_v[:3]
            elif k in ["cod_tipo_trab", "cat_ocupacional", "tipo_personal", "reg_laboral"]:
                s_v = str(v).strip()
                clean_updates[k] = s_v.zfill(2) if (s_v.isdigit() and len(s_v) == 1) else s_v[:2]
            elif k in ["grupo_trabajo", "niv_educativo"]:
                s_v = str(v).strip()
                clean_updates[k] = s_v.zfill(3) if s_v.isdigit() else s_v[:3]
            elif k in ["cod_sucursal", "nationality"]:
                clean_updates[k] = str(v).strip().upper()[:3]
            elif k in ["period_pago", "tipo_comision", "sex"]:
                clean_updates[k] = str(v).strip()[:1]
            elif k == "civil_status":
                clean_updates[k] = str(v).strip().upper()[:2]
            elif k == "asignacion_familiar":
                clean_updates[k] = str(v).strip().upper()
            elif k == "basico":
                try:
                    clean_updates[k] = float(v) if v is not None and str(v).strip() != "" else 1025.0
                except (ValueError, TypeError):
                    clean_updates[k] = 1025.0
            else:
                clean_updates[k] = str(v).strip() if v is not None else ""

    if not clean_updates:
        raise HTTPException(status_code=400, detail="No se seleccionó ningún campo válido para actualizar")

    records = db.query(ScannedRecord).filter(ScannedRecord.id.in_(req.record_ids)).all()
    updated_records = []
    for rec in records:
        for k, v in clean_updates.items():
            setattr(rec, k, v)
        updated_records.append(rec.to_dict())

    db.commit()

    return {
        "success": True,
        "updated_count": len(updated_records),
        "fields_updated": list(clean_updates.keys()),
        "records": updated_records
    }


@app.post("/api/contracts/calculate-dates")
def calculate_contract_dates(req: CalculateDatesRequest):
    """
    Calcula automáticamente la fecha de término del contrato laboral según la norma peruana.
    Ejemplo: Inicio 08/09/2026, 3 meses -> Fin 07/12/2026.
    """
    return worker_consolidator.calculate_contract_dates(req.start_date, req.duration_months)


@app.get("/api/contracts/templates")
def list_contract_templates():
    """Lista las plantillas .docx disponibles."""
    return {"templates": contract_generator.list_templates()}


@app.post("/api/contracts/generate")
def generate_single_contract(req: ContractGenerateRequest, db: Session = Depends(get_db)):
    """
    Genera el contrato laboral .docx para un trabajador conservando el 100% de la plantilla original.
    Registra el contrato en la base de datos para auditoría e historial.
    """
    dates_calc = worker_consolidator.calculate_contract_dates(req.start_date, req.duration_months)
    
    try:
        gen_result = contract_generator.generate_contract(
            worker_data=req.worker_data,
            contract_dates=dates_calc,
            template_name=req.template_name,
            empresa_nombre=req.empresa_nombre or "SERVICIOS INDUSTRIALES DEL PERÚ S.A.C.",
            empresa_ruc=req.empresa_ruc or "20601234567",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando el documento .docx: {str(e)}")

    # Guardar registro en base de datos
    contract_log = GeneratedContractLog(
        dni=gen_result["dni"],
        worker_name=gen_result["worker_name"],
        contract_type=req.worker_data.get("fields", {}).get("tipo_contrato", {}).get("value", "SUJETO A MODALIDAD"),
        start_date=gen_result["start_date"],
        end_date=gen_result["end_date"],
        duration=gen_result["duration"],
        file_name=gen_result["file_name"],
        file_path=gen_result["file_path"],
        file_size_kb=gen_result["size_kb"],
        status="GENERADO",
        provenance_summary=json.dumps({
            k: v.get("origin") for k, v in req.worker_data.get("fields", {}).items() if isinstance(v, dict)
        }),
    )
    db.add(contract_log)
    db.commit()
    db.refresh(contract_log)

    return {
        "success": True,
        "contract": contract_log.to_dict(),
        "download_url": f"/api/contracts/download/{gen_result['file_name']}",
        "file_details": gen_result,
    }


@app.post("/api/contracts/generate-batch")
def generate_batch_contracts(req: BatchContractGenerateRequest, db: Session = Depends(get_db)):
    """
    Generación masiva de contratos para múltiples trabajadores seleccionados o todos los del Excel.
    Empaqueta los archivos .docx generados en un archivo comprimido .zip.
    """
    if not req.workers:
        raise HTTPException(status_code=400, detail="Debe seleccionar al menos un trabajador para la generación masiva.")

    dates_calc = worker_consolidator.calculate_contract_dates(req.start_date, req.duration_months)
    generated_logs = []
    generated_files = []
    errors = []

    for w in req.workers:
        dni = w.get("dni", "")
        try:
            profile = worker_consolidator.consolidate_worker_profile(dni)
            gen_res = contract_generator.generate_contract(
                worker_data=profile,
                contract_dates=dates_calc,
                template_name=req.template_name,
            )
            
            # Guardar log en BD
            contract_log = GeneratedContractLog(
                dni=gen_res["dni"],
                worker_name=gen_res["worker_name"],
                contract_type="SUJETO A MODALIDAD",
                start_date=gen_res["start_date"],
                end_date=gen_res["end_date"],
                duration=gen_res["duration"],
                file_name=gen_res["file_name"],
                file_path=gen_res["file_path"],
                file_size_kb=gen_res["size_kb"],
                status="GENERADO",
            )
            db.add(contract_log)
            generated_logs.append(contract_log)
            generated_files.append(Path(gen_res["file_path"]))
        except Exception as e:
            errors.append({"dni": dni, "name": w.get("full_name", ""), "error": str(e)})

    db.commit()

    # Crear ZIP si hay más de 1 archivo
    zip_filename = None
    zip_download_url = None
    if generated_files:
        timestamp_str = get_peru_now().strftime("%Y%m%d_%H%M%S")
        zip_filename = f"Lote_Contratos_{timestamp_str}.zip"
        zip_path = CONTRACTS_DIR / zip_filename
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for f in generated_files:
                if f.exists():
                    zipf.write(f, arcname=f.name)

        zip_download_url = f"/api/contracts/download/{zip_filename}"

    return {
        "success": True,
        "total_requested": len(req.workers),
        "total_generated": len(generated_files),
        "total_errors": len(errors),
        "zip_file_name": zip_filename,
        "zip_download_url": zip_download_url,
        "generated_items": [l.to_dict() for l in generated_logs],
        "errors": errors,
    }


@app.get("/api/contracts/history")
def get_contracts_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Retorna el historial paginado de contratos generados con buscador por DNI o Nombre."""
    query = db.query(GeneratedContractLog)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                GeneratedContractLog.dni.ilike(s),
                GeneratedContractLog.worker_name.ilike(s),
                GeneratedContractLog.file_name.ilike(s),
            )
        )

    total = query.count()
    items = (
        query.order_by(desc(GeneratedContractLog.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [item.to_dict() for item in items],
    }


@app.get("/api/contracts/download/{filename}")
def download_generated_file(filename: str):
    """Descarga segura de un contrato .docx o archivo .zip generado."""
    clean_name = Path(filename).name
    file_path = CONTRACTS_DIR / clean_name
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Archivo no encontrado: {clean_name}")

    media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    if clean_name.endswith(".zip"):
        media_type = "application/zip"

    return FileResponse(
        path=str(file_path),
        filename=clean_name,
        media_type=media_type,
    )


@app.get("/api/excel/diagnostic")
def get_excel_diagnostic():
    """Retorna el reporte de inspección profunda del archivo Excel (hojas, comentarios, celdas ocultas)."""
    return excel_analyzer.inspect_excel_file()


@app.get("/api/excel/workers")
def list_excel_workers():
    """Retorna la lista de todos los trabajadores identificados en el archivo Excel."""
    workers = excel_analyzer.list_all_workers()
    return {"total": len(workers), "workers": workers}


# ==========================================
# Excel Templates Endpoints (Gestión de Plantillas)
# ==========================================

@app.get("/api/excel-templates")
def list_excel_templates():
    """Retorna todas las plantillas Excel registradas con sus hojas y mapeos de columnas."""
    return {"templates": excel_template_service.list_templates()}


@app.post("/api/excel-templates/upload")
def upload_excel_template(file: UploadFile = File(...)):
    """Sube una nueva plantilla Excel y analiza automáticamente sus columnas."""
    if not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos Excel en formato .xlsx.")
    contents = file.file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="El archivo subido está vacío.")
    analysis = excel_template_service.save_uploaded_template(contents, file.filename)
    return {"message": "Plantilla subida y analizada con éxito.", "template": analysis}


@app.post("/api/excel-templates/fill")
def fill_excel_template(payload: dict):
    """
    Rellena los datos extraídos del DNI en la plantilla Excel seleccionada
    manteniendo exactamente el formato, colores y estilos originales.
    """
    template_name = payload.get("template_name")
    if not template_name:
        raise HTTPException(status_code=400, detail="Debe especificar 'template_name'.")
    dni_data = payload.get("data", {})
    sheet_name = payload.get("sheet_name")

    try:
        out_filename, out_path = excel_template_service.fill_template(
            template_name=template_name,
            data=dni_data,
            sheet_name=sheet_name
        )
        return {
            "success": True,
            "filename": out_filename,
            "download_url": f"/api/exports/download/{out_filename}",
            "message": f"Datos completados con éxito en la plantilla '{template_name}'."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al completar plantilla: {str(e)}")


@app.post("/api/excel-templates/generate-batch")
def generate_batch_excel(payload: dict, db: Session = Depends(get_db)):
    """
    Genera una copia de la plantilla Excel seleccionada llenando únicamente
    las celdas amarillas con los trabajadores seleccionados por fecha/hora.
    """
    template_name = payload.get("template_name")
    if not template_name:
        raise HTTPException(status_code=400, detail="Debe seleccionar una plantilla Excel.")

    record_ids = payload.get("record_ids", [])
    records_data = payload.get("records")
    sheet_name = payload.get("sheet_name")

    if record_ids:
        queried = db.query(ScannedRecord).filter(ScannedRecord.id.in_(record_ids)).all()
        id_map = {r.id: r.to_dict() for r in queried}
        records_override = {r["id"]: r for r in (payload.get("records_override") or payload.get("records") or []) if isinstance(r, dict) and "id" in r}
        records = []
        for rid in record_ids:
            if rid in id_map:
                item = dict(id_map[rid])
                if rid in records_override:
                    item.update(records_override[rid])
                records.append(item)
    elif records_data:
        records = records_data
    else:
        raise HTTPException(status_code=400, detail="Debe seleccionar al menos un trabajador escaneado.")

    if not records:
        raise HTTPException(status_code=400, detail="No se encontraron datos para los trabajadores seleccionados.")

    try:
        out_filename, out_path, num_workers, yellow_cols = excel_template_service.fill_template_batch(
            template_name=template_name,
            records=records,
            sheet_name=sheet_name
        )
        return {
            "success": True,
            "filename": out_filename,
            "download_url": f"/api/exports/download/{out_filename}",
            "total_workers": num_workers,
            "yellow_columns_filled": yellow_cols,
            "message": f"Excel generado con éxito con {num_workers} trabajadores en la plantilla '{template_name}'."
        }
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=404, detail=str(fnf))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar archivo Excel: {str(e)}")


@app.get("/api/scanned-records/dates")
def get_scanned_dates(db: Session = Depends(get_db)):
    """
    Retorna la lista de fechas únicas en que se han realizado escaneos de DNI con su cantidad de registros.
    """
    records = db.query(ScannedRecord.scan_date).all()
    date_counts = {}
    for r in records:
        if r[0]:
            d_str = r[0].strftime("%Y-%m-%d")
            date_counts[d_str] = date_counts.get(d_str, 0) + 1

    sorted_dates = sorted(date_counts.keys(), reverse=True)
    results = []
    for d in sorted_dates:
        try:
            dt = datetime.strptime(d, "%Y-%m-%d")
            formatted = dt.strftime("%d/%m/%Y")
        except Exception:
            formatted = d
        results.append({
            "date": d,
            "formatted": formatted,
            "count": date_counts[d]
        })
    return {"dates": results}


@app.get("/api/scanned-records/by-date-time")
def get_scanned_records_by_date_time(
    date_val: Optional[str] = Query(None, alias="date"),
    start_time: Optional[str] = Query(None),
    end_time: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Filtra los escaneos de DNI por fecha y rango de horas para selección y generación de Excel.
    """
    query = db.query(ScannedRecord)

    if date_val and date_val.strip() and date_val != "all":
        try:
            d_start = datetime.strptime(f"{date_val.strip()} 00:00:00", "%Y-%m-%d %H:%M:%S")
            d_end = datetime.strptime(f"{date_val.strip()} 23:59:59", "%Y-%m-%d %H:%M:%S")
            query = query.filter(ScannedRecord.scan_date >= d_start, ScannedRecord.scan_date <= d_end)
        except Exception:
            pass

    if search and search.strip():
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                ScannedRecord.doc_number.ilike(s),
                ScannedRecord.paternal_surname.ilike(s),
                ScannedRecord.maternal_surname.ilike(s),
                ScannedRecord.first_names.ilike(s),
                ScannedRecord.address.ilike(s),
            )
        )

    all_records = query.order_by(desc(ScannedRecord.scan_date)).all()

    filtered = []
    for rec in all_records:
        rec_dict = rec.to_dict()
        if rec.scan_date:
            rec_time = rec.scan_date.strftime("%H:%M")
            rec_date_str = rec.scan_date.strftime("%d/%m/%Y")
            rec_dict["formatted_time"] = rec_time
            rec_dict["formatted_date"] = rec_date_str
            rec_dict["display_datetime"] = f"{rec_date_str} {rec_time}"

            if start_time and start_time.strip():
                if rec_time < start_time.strip():
                    continue
            if end_time and end_time.strip():
                if rec_time > end_time.strip():
                    continue
        else:
            rec_dict["formatted_time"] = ""
            rec_dict["formatted_date"] = ""
            rec_dict["display_datetime"] = ""

        filtered.append(rec_dict)

    return {
        "total": len(filtered),
        "items": filtered
    }


@app.delete("/api/excel-templates/{filename:path}")
def delete_excel_template(filename: str):
    """Elimina una plantilla Excel registrada."""
    try:
        excel_template_service.delete_template(filename)
        return {"success": True, "message": f"Plantilla '{filename}' eliminada correctamente."}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Plantilla '{filename}' no encontrada.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar plantilla: {str(e)}")


@app.put("/api/excel-templates/{filename:path}/rename")
def rename_excel_template(filename: str, payload: dict):
    """Renombra una plantilla Excel registrada."""
    new_name = payload.get("new_name")
    if not new_name:
        raise HTTPException(status_code=400, detail="Debe especificar 'new_name'.")
    try:
        updated = excel_template_service.rename_template(filename, new_name)
        return {"success": True, "message": f"Plantilla renombrada a '{new_name}'.", "template": updated}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Plantilla '{filename}' no encontrada.")
    except FileExistsError as fe:
        raise HTTPException(status_code=400, detail=str(fe))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al renombrar plantilla: {str(e)}")


@app.get("/api/excel-templates/download/{filename:path}")
def download_excel_template(filename: str):
    """Descarga el archivo original de la plantilla Excel."""
    try:
        file_path = excel_template_service.get_template_path(filename)
        return FileResponse(
            path=str(file_path),
            filename=file_path.name,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Plantilla '{filename}' no encontrada.")


@app.post("/api/excel-templates/{filename:path}/mapping")
def save_template_mapping(filename: str, payload: dict):
    """Guarda mapeos personalizados de columnas para una hoja específica de la plantilla."""
    sheet_name = payload.get("sheet_name")
    mappings = payload.get("mappings", {})
    if not sheet_name:
        raise HTTPException(status_code=400, detail="Debe especificar 'sheet_name'.")
    try:
        updated = excel_template_service.save_template_mapping(filename, sheet_name, mappings)
        return {"success": True, "message": "Mapeo guardado con éxito.", "template": updated}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Plantilla '{filename}' no encontrada.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar mapeo: {str(e)}")


@app.get("/api/exports/download/{filename}")
def download_export_file(filename: str):
    """Descarga de archivos Excel generados."""
    clean_name = Path(filename).name
    file_path = EXPORTS_DIR / clean_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Archivo no encontrado: {clean_name}")
    return FileResponse(
        path=str(file_path),
        filename=clean_name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


# =============================================================================
# Módulo Supabase: Gestión de Plantillas en la Nube (Storage + Database)
# =============================================================================

@app.get("/api/supabase/config")
def get_supabase_config():
    """Retorna la configuración actual de Supabase y el estado de conexión."""
    return {
        "config": supabase_template_service.get_config(),
        "status": supabase_template_service.check_connection(),
    }


@app.post("/api/supabase/config")
def save_supabase_config(payload: dict):
    """Guarda y valida las credenciales de conexión con Supabase."""
    url = payload.get("supabase_url", "")
    key = payload.get("supabase_key", "")
    bucket = payload.get("bucket_name", "templates")
    if not url or not key:
        raise HTTPException(status_code=400, detail="Debe ingresar la URL y la API Key de Supabase.")
    res = supabase_template_service.save_config(url, key, bucket)
    return res


@app.post("/api/supabase/test-connection")
def test_supabase_connection():
    """Prueba la conexión a la base de datos y al bucket de Supabase."""
    return supabase_template_service.check_connection()


@app.get("/api/supabase-templates")
def list_supabase_templates():
    """Retorna todas las plantillas registradas en la base de datos de Supabase."""
    templates = supabase_template_service.list_templates()
    return {"templates": templates, "total": len(templates)}


@app.post("/api/supabase-templates/upload")
def upload_supabase_template(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    template_type: str = Form("EXCEL_CARGA_MASIVA"),
    version: str = Form("1.0"),
    user_name: str = Form("Flavio Monzón"),
):
    """
    Sube un nuevo archivo Excel a Supabase Storage y registra sus metadatos
    (nombre, tipo, versión, fecha, usuario, celdas amarillas) en Supabase Database.
    """
    if not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos Excel en formato .xlsx.")

    file_bytes = file.file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="El archivo subido está vacío.")

    try:
        res = supabase_template_service.upload_template(
            file_bytes=file_bytes,
            filename=file.filename,
            name=name,
            template_type=template_type,
            version=version,
            user_name=user_name,
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/supabase-templates/{template_id}/download")
def download_supabase_template(template_id: str):
    """Descarga el archivo físico original de la plantilla desde Supabase Storage."""
    try:
        file_bytes, filename = supabase_template_service.download_template_file(template_id)
        return FileResponse(
            path=str(supabase_template_service.get_template_path_for_processing(template_id)),
            filename=filename,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Error al descargar plantilla de Supabase: {str(e)}")


@app.post("/api/supabase-templates/{template_id}/replace")
def replace_supabase_template_file(
    template_id: str,
    file: UploadFile = File(...),
    user_name: str = Form("Flavio Monzón"),
):
    """
    Reemplaza el archivo físico en Supabase Storage, recalcula las celdas amarillas
    e incrementa automáticamente la versión en Supabase Database.
    """
    if not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos Excel .xlsx.")

    file_bytes = file.file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="El archivo está vacío.")

    try:
        res = supabase_template_service.replace_template_file(
            template_id=template_id,
            file_bytes=file_bytes,
            filename=file.filename,
            user_name=user_name,
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/supabase-templates/{template_id}")
def update_supabase_template_metadata(template_id: str, payload: dict):
    """Actualiza metadatos (nombre descriptivo, tipo, versión) en Supabase Database."""
    try:
        res = supabase_template_service.update_template_metadata(
            template_id=template_id,
            name=payload.get("name"),
            template_type=payload.get("template_type"),
            version=payload.get("version"),
            sheets_metadata=payload.get("sheets_metadata"),
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/supabase-templates/{template_id}")
def delete_supabase_template(template_id: str):
    """Elimina la plantilla tanto de Supabase Storage como de Supabase Database."""
    try:
        res = supabase_template_service.delete_template(template_id)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/supabase-templates/{template_id}/mapping")
def save_supabase_template_mapping(template_id: str, payload: dict):
    """Guarda mapeos personalizados de columnas en los metadatos de Supabase Database."""
    sheet_name = payload.get("sheet_name")
    mappings = payload.get("mappings", {})
    if not sheet_name:
        raise HTTPException(status_code=400, detail="Debe especificar 'sheet_name'.")

    tpl = supabase_template_service.get_template(template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada en Supabase.")

    sheets = tpl.get("sheets", [])
    for sh in sheets:
        if sh.get("sheet_name") == sheet_name:
            sh["custom_mappings"] = mappings
            break

    try:
        supabase_template_service.update_template_metadata(template_id, sheets_metadata=sheets)
        return {"success": True, "message": "Mapeo guardado en Supabase exitosamente."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/supabase-templates/generate-batch")
def generate_batch_excel_supabase(payload: dict, db: Session = Depends(get_db)):
    """
    Genera un archivo Excel llenando únicamente las celdas amarillas a partir de una
    plantilla almacenada en Supabase Storage con los trabajadores seleccionados.
    """
    template_id = payload.get("template_id")
    if not template_id:
        raise HTTPException(status_code=400, detail="Debe especificar 'template_id' de Supabase.")

    record_ids = payload.get("record_ids", [])
    records_data = payload.get("records")
    sheet_name = payload.get("sheet_name")

    if record_ids:
        queried = db.query(ScannedRecord).filter(ScannedRecord.id.in_(record_ids)).all()
        id_map = {r.id: r.to_dict() for r in queried}
        records_override = {r["id"]: r for r in (payload.get("records_override") or payload.get("records") or []) if isinstance(r, dict) and "id" in r}
        records = []
        for rid in record_ids:
            if rid in id_map:
                item = dict(id_map[rid])
                if rid in records_override:
                    item.update(records_override[rid])
                records.append(item)
    elif records_data:
        records = records_data
    else:
        raise HTTPException(status_code=400, detail="Debe seleccionar al menos un trabajador escaneado.")

    if not records:
        raise HTTPException(status_code=400, detail="No se encontraron datos para los trabajadores seleccionados.")

    # 1. Obtener la plantilla desde Supabase y garantizar que esté en caché local
    try:
        template_file_path = supabase_template_service.get_template_path_for_processing(template_id)
        tpl_metadata = supabase_template_service.get_template(template_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"No se pudo descargar la plantilla de Supabase: {str(e)}")

    # 2. Utilizar el motor de llenado de celdas amarillas con el archivo de Supabase
    try:
        out_filename, out_path, num_workers, yellow_cols = excel_template_service.fill_template_batch_from_file(
            source_file_path=template_file_path,
            template_display_name=tpl_metadata.get("name", template_file_path.name) if tpl_metadata else template_file_path.name,
            records=records,
            sheet_name=sheet_name
        )
        return {
            "success": True,
            "filename": out_filename,
            "download_url": f"/api/exports/download/{out_filename}",
            "total_workers": num_workers,
            "yellow_columns_filled": yellow_cols,
            "template_name": tpl_metadata.get("name") if tpl_metadata else template_file_path.name,
            "template_version": tpl_metadata.get("version", "1.0") if tpl_metadata else "1.0",
            "message": f"Excel generado con éxito con {num_workers} trabajadores desde la plantilla Supabase."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar archivo Excel: {str(e)}")


# ==========================================
# Ubigeo Perú Database & Autocomplete Endpoints
# ==========================================

@app.get("/api/ubigeo/search")
def search_ubigeos(q: str = Query("", description="Nombre de distrito, provincia, dpto o código de 6 dígitos"), limit: int = 15):
    """
    Busca coincidencias en la base de datos de Ubigeos del Perú para autocompletado en tiempo real.
    """
    from backend.services.ubigeo_service import ubigeo_service
    results = ubigeo_service.search_ubigeos(q, limit=limit)
    return {"success": True, "query": q, "total": len(results), "items": results}


@app.get("/api/ubigeo/lookup")
def lookup_ubigeo_by_code(code: str = Query(..., description="Código de 6 dígitos INEI o RENIEC")):
    """
    Busca los datos de ubicación a partir de un código de 6 dígitos (INEI o RENIEC).
    """
    from backend.services.ubigeo_service import ubigeo_service
    record = ubigeo_service.lookup_by_code(code)
    if not record:
        raise HTTPException(status_code=404, detail=f"No se encontró Ubigeo para el código '{code}'.")
    return {"success": True, "item": record}


@app.get("/api/ubigeo/resolve")
def resolve_ubigeo_text(text: str = Query(..., description="Texto OCR o nombres Departamento / Provincia / Distrito")):
    """
    Resuelve inteligentemente los códigos INEI y RENIEC y nombres normalizados a partir de texto libre.
    """
    from backend.services.ubigeo_service import ubigeo_service
    record = ubigeo_service.resolve_from_text(text)
    if not record:
        return {"success": False, "item": None, "message": "No se pudo resolver el Ubigeo con el texto provisto."}
    return {"success": True, "item": record}


@app.get("/api/ubigeo/download-excel")
def download_ubigeo_excel():
    """
    Permite descargar la base de datos completa de Ubigeos del Perú en formato Excel.
    """
    from backend.services.ubigeo_service import EXCEL_PATH, FALLBACK_EXCEL_PATH
    target = EXCEL_PATH if EXCEL_PATH.exists() else FALLBACK_EXCEL_PATH
    if not target.exists():
        raise HTTPException(status_code=404, detail="El archivo Excel de Ubigeos no se encuentra disponible.")
    return FileResponse(
        path=str(target),
        filename="ubigeos_peru.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


# Servir la app React frontend compilada si existe la carpeta dist
_FRONTEND_DIST = _PROJECT_ROOT / "frontend" / "dist"
if _FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(_FRONTEND_DIST), html=True), name="frontend_dist")



