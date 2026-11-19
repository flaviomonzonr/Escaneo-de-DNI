import os
import re
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List
from datetime import datetime
import pandas as pd
from sqlalchemy.orm import Session
from backend.config import DATA_DIR, get_peru_now
from backend.database import SessionLocal, HistoricalWorker, ScannedRecord, SBSRecord, init_db
from backend.services.ubigeo_service import UbigeoService

logger = logging.getLogger("historical_data_service")

HISTORICAL_EXCEL_PATH = DATA_DIR / "DATA_HISTORICA.xlsx"


class HistoricalDataService:
    """
    Servicio de gestión y búsqueda de Trabajadores en la Data Histórica de la empresa.
    Prioridad de consulta:
    1ª Opción: Buscar en Data Histórica (local, sin costo de tokens, instantánea).
               Incluye: HistoricalWorker (planilla), ScannedRecord (registros guardados)
               y WorkerMatcher (Excel maestro de contratos).
    2ª Opción: Si no existe, recurrir a la API de Factiliza (consumiendo token).
    """

    @classmethod
    def find_worker_by_doc(cls, doc_number: str, db: Optional[Session] = None) -> Optional[Dict[str, Any]]:
        """
        Busca un trabajador por número de DNI o Carnet de Extranjería en todas las fuentes locales:
        1. Tabla HistoricalWorker (Data de Planilla / Excel Histórico).
        2. Tabla ScannedRecord (Trabajadores ya registrados/escaneados previamente).
        3. WorkerMatcher (Trabajadores en Excel Maestro de Contratos / NISIRA).
        Si se encuentra en cualquiera, lo sincroniza en HistoricalWorker y lo retorna con 0 costo de tokens.
        """
        clean_doc = re.sub(r"[^A-Za-z0-9]", "", str(doc_number or "")).strip().upper()
        if not clean_doc:
            return None

        own_session = False
        if db is None:
            db = SessionLocal()
            own_session = True

        try:
            # 1. Buscar en HistoricalWorker
            worker = db.query(HistoricalWorker).filter(HistoricalWorker.doc_number == clean_doc).first()
            if worker:
                data = worker.to_dict()
                # Enriquecer con SBS local si tiene
                cls._enrich_with_sbs_local(clean_doc, data, db)
                return data

            # 2. Buscar en ScannedRecord (registros ya escaneados o guardados previamente)
            sc = db.query(ScannedRecord).filter(ScannedRecord.doc_number == clean_doc).order_by(ScannedRecord.id.desc()).first()
            if sc:
                logger.info(f"Trabajador {clean_doc} encontrado en ScannedRecord local (id={sc.id}).")
                worker_dict = cls._scanned_record_to_dict(sc)
                cls._enrich_with_sbs_local(clean_doc, worker_dict, db)
                # Guardar en HistoricalWorker para búsquedas ultra rápidas
                cls.save_or_update_worker(clean_doc, worker_dict, db)
                return worker_dict

            # 3. Buscar en WorkerMatcher (Excel Maestro de Contratos / Registros históricos)
            try:
                from backend.services.worker_matcher import WorkerMatcher
                wm = WorkerMatcher()
                match_res = wm.find_worker(clean_doc)
                if match_res and match_res.excel_data and match_res.excel_data.get("fields"):
                    fields = match_res.excel_data.get("fields", {})
                    logger.info(f"Trabajador {clean_doc} encontrado en Excel Maestro vía WorkerMatcher.")
                    worker_dict = cls._matcher_fields_to_dict(clean_doc, fields)
                    cls._enrich_with_sbs_local(clean_doc, worker_dict, db)
                    cls.save_or_update_worker(clean_doc, worker_dict, db)
                    return worker_dict
            except Exception as em:
                logger.debug(f"Error consultando WorkerMatcher para {clean_doc}: {em}")

            return None
        except Exception as e:
            logger.warning(f"Error consultando Data Histórica para {clean_doc}: {e}")
            return None
        finally:
            if own_session:
                db.close()

    @classmethod
    def _enrich_with_sbs_local(cls, doc_number: str, data: Dict[str, Any], db: Session):
        """Si existen datos de AFP / CUSPP en sbs_records, enriquecer el diccionario."""
        try:
            sbs = db.query(SBSRecord).filter(SBSRecord.doc_number == doc_number).first()
            if sbs:
                if not data.get("pension_system") or data.get("pension_system") in ("-", "ONP / SNP", ""):
                    data["pension_system"] = sbs.afp_actual or "ONP / SNP"
                if not data.get("cuspp") or data.get("cuspp") == "-":
                    data["cuspp"] = sbs.cuspp or "-"
                data["sbs_status"] = sbs.to_dict()
        except Exception as e:
            logger.debug(f"Error enriqueciendo con SBS local: {e}")

    @classmethod
    def _scanned_record_to_dict(cls, sc: ScannedRecord) -> Dict[str, Any]:
        """Convierte un ScannedRecord existente al formato estándar de Data Histórica."""
        pat = (getattr(sc, "paternal_surname", None) or "").strip().upper()
        mat = (getattr(sc, "maternal_surname", None) or "").strip().upper()
        names = (getattr(sc, "first_names", None) or "").strip().upper()
        full_name = f"{pat} {mat}, {names}".strip().strip(",")

        # Normalizar sexo
        sex_raw = (getattr(sc, "sex", None) or "").strip().upper()
        if sex_raw in ("M", "MASCULINO", "1"):
            sex = "MASCULINO"
        elif sex_raw in ("F", "FEMENINO", "2"):
            sex = "FEMENINO"
        else:
            sex = sex_raw

        return {
            "success": True,
            "status_code": 200,
            "source": "data_historica",
            "is_historical": True,
            "message": "Trabajador recuperado de registros locales (0 tokens Factiliza consumidos).",
            "doc_type": getattr(sc, "doc_type", None) or "DNI",
            "doc_number": getattr(sc, "doc_number", ""),
            "first_names": names,
            "paternal_surname": pat,
            "maternal_surname": mat,
            "full_name": full_name or f"{pat} {mat} {names}".strip(),
            "birth_date": getattr(sc, "birth_date", "") or "",
            "sex": sex,
            "civil_status": getattr(sc, "civil_status", None) or "SOLTERO",
            "nationality": getattr(sc, "nationality", None) or "PERUANA",
            "address": getattr(sc, "address", "") or "",
            "department": getattr(sc, "department", "") or "",
            "province": getattr(sc, "province", "") or "",
            "district": getattr(sc, "district", "") or "",
            "ubigeo_inei": getattr(sc, "ubigeo_inei", "") or "",
            "ubigeo_reniec": getattr(sc, "ubigeo_reniec", "") or "",
            "ubigeo": getattr(sc, "ubigeo", "") or "",
            "phone": getattr(sc, "phone", None) or "999999999",
            "email": getattr(sc, "email", None) or "sincorreo@gmail.com",
            "pension_system": getattr(sc, "pension_system", "") or "",
            "pension_commission": getattr(sc, "pension_commission", "") or "",
            "cuspp": getattr(sc, "cuspp", "") or "",
            "bank_account": getattr(sc, "bank_account", "") or "",
            "cargo": getattr(sc, "cargo", "") or "",
            "issue_date": getattr(sc, "issue_date", "") or "",
            "expiry_date": getattr(sc, "expiry_date", "") or "",
            "raw_response": {
                "origen": "SCANNED_RECORD_LOCAL",
                "doc_number": getattr(sc, "doc_number", ""),
                "record_id": getattr(sc, "id", None),
            },
        }

    @classmethod
    def _matcher_fields_to_dict(cls, doc_number: str, fields: Dict[str, Any]) -> Dict[str, Any]:
        """Convierte los campos de WorkerMatcher (Excel maestro) al formato estándar."""
        def _get_val(k: str) -> str:
            item = fields.get(k)
            if isinstance(item, dict):
                return str(item.get("value") or "").strip()
            return str(item or "").strip()

        pat = _get_val("paternal_surname").upper()
        mat = _get_val("maternal_surname").upper()
        names = _get_val("first_names").upper()
        full_name = f"{pat} {mat}, {names}".strip().strip(",")

        sex_val = _get_val("sex").upper()
        if sex_val in ("M", "MASCULINO", "1"):
            sex = "MASCULINO"
        elif sex_val in ("F", "FEMENINO", "2"):
            sex = "FEMENINO"
        else:
            sex = sex_val

        # Address y Ubigeo
        dept = _get_val("observaciones") or _get_val("department")
        prov = _get_val("columna_n") or _get_val("province")
        dist = _get_val("columna_o") or _get_val("district")
        address = _get_val("fecha_de_vencimiento") or _get_val("address")  # En algunos excels de NISIRA está en esta col

        # Fechas
        birth_d = _get_val("birth_date")
        issue_d = _get_val("columna_u") or _get_val("issue_date")
        exp_d = _get_val("columna_q") or _get_val("expiry_date")

        return {
            "success": True,
            "status_code": 200,
            "source": "data_historica",
            "is_historical": True,
            "message": "Trabajador recuperado de Excel Maestro local (0 tokens Factiliza consumidos).",
            "doc_type": "DNI" if len(doc_number) == 8 else "Carnet de Extranjería",
            "doc_number": doc_number,
            "first_names": names,
            "paternal_surname": pat,
            "maternal_surname": mat,
            "full_name": full_name or f"{pat} {mat} {names}".strip(),
            "birth_date": birth_d,
            "sex": sex,
            "civil_status": "SOLTERO",
            "nationality": _get_val("nacionalidad") or "PERUANA",
            "address": address,
            "department": dept,
            "province": prov,
            "district": dist,
            "ubigeo_inei": "",
            "ubigeo_reniec": "",
            "ubigeo": f"{dept} / {prov} / {dist}" if (dept and dist) else "",
            "phone": "999999999",
            "email": "sincorreo@gmail.com",
            "pension_system": _get_val("afps") or _get_val("pension_system"),
            "pension_commission": "",
            "cuspp": _get_val("cuspp"),
            "bank_account": "",
            "cargo": _get_val("cargo") or "OBRERO DE CAMPO",
            "issue_date": issue_d,
            "expiry_date": exp_d,
            "raw_response": {
                "origen": "WORKER_MATCHER_EXCEL",
                "doc_number": doc_number,
            },
        }

    @classmethod
    def save_or_update_worker(cls, doc_number: str, data: Dict[str, Any], db: Optional[Session] = None) -> bool:
        """
        Guarda o actualiza un trabajador en HistoricalWorker para que nunca más se consulte a Factiliza.
        """
        clean_doc = re.sub(r"[^A-Za-z0-9]", "", str(doc_number or "")).strip().upper()
        if not clean_doc:
            return False

        own_session = False
        if db is None:
            db = SessionLocal()
            own_session = True

        try:
            worker = db.query(HistoricalWorker).filter(HistoricalWorker.doc_number == clean_doc).first()
            if not worker:
                worker = HistoricalWorker(doc_number=clean_doc)
                db.add(worker)

            worker.doc_type = data.get("doc_type") or ("DNI" if len(clean_doc) == 8 else "Carnet de Extranjería")
            if data.get("first_names"):
                worker.first_names = str(data["first_names"]).strip().upper()
            if data.get("paternal_surname"):
                worker.paternal_surname = str(data["paternal_surname"]).strip().upper()
            if data.get("maternal_surname"):
                worker.maternal_surname = str(data["maternal_surname"]).strip().upper()
            if data.get("full_name"):
                worker.full_name = str(data["full_name"]).strip().upper()
            if data.get("birth_date"):
                worker.birth_date = str(data["birth_date"]).strip()
            if data.get("sex"):
                worker.sex = str(data["sex"]).strip().upper()
            if data.get("civil_status"):
                worker.civil_status = str(data["civil_status"]).strip().upper()
            if data.get("nationality"):
                worker.nationality = str(data["nationality"]).strip().upper()
            if data.get("address"):
                worker.address = str(data["address"]).strip().upper()
            if data.get("department"):
                worker.department = str(data["department"]).strip().upper()
            if data.get("province"):
                worker.province = str(data["province"]).strip().upper()
            if data.get("district"):
                worker.district = str(data["district"]).strip().upper()
            if data.get("ubigeo"):
                worker.ubigeo = str(data["ubigeo"]).strip()
            if data.get("ubigeo_inei"):
                worker.ubigeo_inei = str(data["ubigeo_inei"]).strip()
            if data.get("ubigeo_reniec"):
                worker.ubigeo_reniec = str(data["ubigeo_reniec"]).strip()
            if data.get("pension_system"):
                worker.pension_system = str(data["pension_system"]).strip().upper()
            if data.get("cuspp"):
                worker.cuspp = str(data["cuspp"]).strip().upper()
            if data.get("phone") and data.get("phone") != "999999999":
                worker.phone = str(data["phone"]).strip()
            if data.get("email") and data.get("email") != "sincorreo@gmail.com":
                worker.email = str(data["email"]).strip().lower()
            if data.get("cargo"):
                worker.cargo = str(data["cargo"]).strip().upper()
            if data.get("bank_account"):
                worker.bank_account = str(data["bank_account"]).strip()

            db.commit()
            logger.info(f"Trabajador {clean_doc} guardado/actualizado en HistoricalWorker.")
            return True
        except Exception as e:
            logger.warning(f"Error guardando trabajador en HistoricalWorker: {e}")
            if db:
                db.rollback()
            return False
        finally:
            if own_session:
                db.close()

    @classmethod
    def sync_all_existing_data(cls, db: Optional[Session] = None) -> int:
        """
        Sincroniza todos los ScannedRecord existentes hacia HistoricalWorker para que ningún DNI
        previamente registrado vuelva a consultar Factiliza.
        """
        own_session = False
        if db is None:
            db = SessionLocal()
            own_session = True

        synced = 0
        try:
            records = db.query(ScannedRecord).all()
            for r in records:
                if r.doc_number:
                    d = cls._scanned_record_to_dict(r)
                    cls._enrich_with_sbs_local(r.doc_number, d, db)
                    if cls.save_or_update_worker(r.doc_number, d, db):
                        synced += 1
            logger.info(f"Sincronizados {synced} registros de ScannedRecord a HistoricalWorker.")
        except Exception as e:
            logger.warning(f"Error en sync_all_existing_data: {e}")
        finally:
            if own_session:
                db.close()
        return synced

    @classmethod
    def import_from_excel(
        cls,
        excel_path: Optional[Path] = None,
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        """
        Lee el archivo DATA HISTORICA.xlsx y sincroniza todos los trabajadores en SQLite.
        Utiliza inserción por lotes para procesar más de 10,000 registros en segundos.
        """
        target_path = Path(excel_path or HISTORICAL_EXCEL_PATH)
        if not target_path.exists():
            return {
                "success": False,
                "error": f"No se encontró el archivo de datos en {target_path}",
                "imported_count": 0,
            }

        logger.info(f"Iniciando importación de Data Histórica desde {target_path}...")

        try:
            # Leer el archivo omitiendo las primeras 2 filas de encabezado de reporte si existen
            df = pd.read_excel(target_path, skiprows=2)
            if "NRODOCUMENTO" not in df.columns:
                # Intentar leer sin saltar filas
                df = pd.read_excel(target_path)
                if "NRODOCUMENTO" not in df.columns:
                    return {
                        "success": False,
                        "error": "El archivo Excel no contiene la columna 'NRODOCUMENTO'.",
                        "imported_count": 0,
                    }

            ub_service = None
            try:
                ub_service = UbigeoService.get_instance()
            except Exception:
                pass

            own_session = False
            if db is None:
                init_db()
                db = SessionLocal()
                own_session = True

            total_read = len(df)
            workers_by_dni = {}

            for _, row in df.iterrows():
                raw_doc = row.get("NRODOCUMENTO")
                if pd.isna(raw_doc):
                    continue
                clean_doc = str(raw_doc).strip().upper()
                if not clean_doc or len(clean_doc) < 6:
                    continue

                # Determinar Tipo de Documento
                raw_id_doc = str(row.get("IDDOCIDENTIDAD", "")).strip().split(".")[0]
                doc_type = "Carnet de Extranjería" if raw_id_doc in ["04", "4", "CE", "CEE"] or len(clean_doc) > 8 else "DNI"

                # Nombres y Apellidos
                pat_sur = str(row.get("APELLIDO_PATERNO") or "").strip().upper() if not pd.isna(row.get("APELLIDO_PATERNO")) else ""
                mat_sur = str(row.get("APELLIDO_MATERNO") or "").strip().upper() if not pd.isna(row.get("APELLIDO_MATERNO")) else ""
                names = str(row.get("NOMBRES") or "").strip().upper() if not pd.isna(row.get("NOMBRES")) else ""
                apenom = str(row.get("APENOM") or "").strip().upper() if not pd.isna(row.get("APENOM")) else ""
                full_name = apenom or f"{pat_sur} {mat_sur} {names}".strip()

                # Fecha de Nacimiento
                birth_date = ""
                raw_birth = row.get("FECHA_NACIMIENTO")
                if not pd.isna(raw_birth):
                    if isinstance(raw_birth, (pd.Timestamp, datetime)):
                        birth_date = raw_birth.strftime("%d/%m/%Y")
                    else:
                        s_b = str(raw_birth).strip()
                        if "-" in s_b and len(s_b) >= 10:
                            parts = s_b[:10].split("-")
                            if len(parts) == 3:
                                birth_date = f"{parts[2]}/{parts[1]}/{parts[0]}"
                        elif "/" in s_b and len(s_b) >= 10:
                            birth_date = s_b[:10]

                # Sexo
                raw_sex = str(row.get("SEXO") or "").strip().upper() if not pd.isna(row.get("SEXO")) else ""
                if raw_sex in ["M", "1", "MASCULINO"]:
                    sex = "MASCULINO"
                elif raw_sex in ["F", "2", "FEMENINO"]:
                    sex = "FEMENINO"
                else:
                    sex = ""

                # Estado Civil
                civil_status = str(row.get("ESTADO_CIVIL") or "").strip().upper() if not pd.isna(row.get("ESTADO_CIVIL")) else ""

                # Nacionalidad
                raw_nac = str(row.get("NACIONALIDAD") or "").strip().upper() if not pd.isna(row.get("NACIONALIDAD")) else ""
                nationality = "PERUANA" if ("PERU" in raw_nac or doc_type == "DNI") else (raw_nac or "EXTRANJERO")

                # Dirección y Ubicación
                address = str(row.get("DIRECCION_REFERENCIA") or "").strip().upper() if not pd.isna(row.get("DIRECCION_REFERENCIA")) else ""
                raw_ubigeo = str(row.get("IDUBIGEO") or "").strip().replace(".0", "") if not pd.isna(row.get("IDUBIGEO")) else ""
                ubigeo_inei = raw_ubigeo.zfill(6) if raw_ubigeo and raw_ubigeo.isdigit() else ""
                dist = str(row.get("DIST_DIRECCION") or "").strip().upper() if not pd.isna(row.get("DIST_DIRECCION")) else ""
                prov = str(row.get("PROV_DIRECCION") or "").strip().upper() if not pd.isna(row.get("PROV_DIRECCION")) else ""
                dept = str(row.get("DPTO_DIRECCION") or "").strip().upper() if not pd.isna(row.get("DPTO_DIRECCION")) else ""

                ubigeo_reniec = ""
                if ub_service:
                    if ubigeo_inei:
                        res_ub = ub_service.lookup_by_code(ubigeo_inei)
                        if res_ub:
                            ubigeo_reniec = res_ub.get("ubigeo_reniec", "")
                            dept = dept or res_ub.get("departamento", "")
                            prov = prov or res_ub.get("provincia", "")
                            dist = dist or res_ub.get("distrito", "")
                    elif dept and dist:
                        matches = ub_service.search_ubigeos(f"{dept} {dist}", limit=1)
                        if matches:
                            ubigeo_reniec = matches[0].get("ubigeo_reniec", "")
                            ubigeo_inei = ubigeo_inei or matches[0].get("ubigeo_inei", "")

                ubigeo_synth = f"{dept} / {prov} / {dist}" if (dept and dist) else ""
                if ubigeo_inei and ubigeo_synth:
                    ubigeo_synth = f"{ubigeo_synth} ({ubigeo_inei})"

                # Contacto
                raw_cel = str(row.get("CELULAR") or "").strip().replace(".0", "") if not pd.isna(row.get("CELULAR")) else ""
                phone = raw_cel if raw_cel and raw_cel.isdigit() else "999999999"
                raw_email = str(row.get("EMAIL") or "").strip().lower() if not pd.isna(row.get("EMAIL")) else ""
                email = raw_email if "@" in raw_email else "sincorreo@gmail.com"

                # Previsional
                pension_system = str(row.get("AFPS") or "").strip().upper() if not pd.isna(row.get("AFPS")) else ""
                cuspp = str(row.get("AUTOGENERADOAFP") or "").strip().upper() if not pd.isna(row.get("AUTOGENERADOAFP")) else ""
                pension_comm = str(row.get("TIPO_COMISION") or "").strip() if not pd.isna(row.get("TIPO_COMISION")) else ""

                # Bancario y Cargo
                bank_id = str(row.get("IDBANCO") or "").strip() if not pd.isna(row.get("IDBANCO")) else ""
                bank_account = str(row.get("CUENTA_BANCO") or "").strip() if not pd.isna(row.get("CUENTA_BANCO")) else ""
                cargo = str(row.get("CARGO") or "").strip().upper() if not pd.isna(row.get("CARGO")) else ""

                record = {
                    "doc_number": clean_doc,
                    "doc_type": doc_type,
                    "paternal_surname": pat_sur,
                    "maternal_surname": mat_sur,
                    "first_names": names,
                    "full_name": full_name,
                    "birth_date": birth_date,
                    "sex": sex,
                    "civil_status": civil_status,
                    "nationality": nationality,
                    "address": address,
                    "ubigeo_inei": ubigeo_inei,
                    "ubigeo_reniec": ubigeo_reniec,
                    "ubigeo": ubigeo_synth,
                    "department": dept,
                    "province": prov,
                    "district": dist,
                    "phone": phone,
                    "email": email,
                    "pension_system": pension_system,
                    "pension_commission": pension_comm,
                    "cuspp": cuspp,
                    "bank_id": bank_id,
                    "bank_account": bank_account,
                    "cargo": cargo,
                    "codigo_general": str(row.get("IDCODIGOGENERAL") or "").strip() if not pd.isna(row.get("IDCODIGOGENERAL")) else "",
                    "codigo_control": str(row.get("CODIGO_CONTROL") or "").strip() if not pd.isna(row.get("CODIGO_CONTROL")) else "",
                    "created_at": get_peru_now(),
                }

                # Si ya existe en el diccionario, actualizar si el nuevo tiene más datos
                if clean_doc in workers_by_dni:
                    existing = workers_by_dni[clean_doc]
                    for k, v in record.items():
                        if v and not existing.get(k):
                            existing[k] = v
                else:
                    workers_by_dni[clean_doc] = record

            # Inserción eficiente en SQLite
            # Limpiar tabla previa para sincronización limpia
            db.query(HistoricalWorker).delete()
            db.commit()

            # Insertar en lotes de 1000
            records_to_insert = list(workers_by_dni.values())
            batch_size = 1000
            for i in range(0, len(records_to_insert), batch_size):
                batch = records_to_insert[i : i + batch_size]
                db.bulk_insert_mappings(HistoricalWorker, batch)
                db.commit()

            logger.info(f"Data Histórica importada con éxito: {len(records_to_insert)} trabajadores únicos de {total_read} registros.")

            return {
                "success": True,
                "total_rows_read": total_read,
                "imported_count": len(records_to_insert),
                "message": f"Se sincronizaron exitosamente {len(records_to_insert)} trabajadores desde la Data Histórica.",
            }

        except Exception as e:
            logger.error(f"Error importando Data Histórica: {e}")
            if db:
                db.rollback()
            return {
                "success": False,
                "error": str(e),
                "imported_count": 0,
            }
        finally:
            if own_session and db:
                db.close()

    @classmethod
    def get_stats(cls, db: Optional[Session] = None) -> Dict[str, Any]:
        """Retorna estadísticas de la Data Histórica en la base de datos."""
        own_session = False
        if db is None:
            db = SessionLocal()
            own_session = True

        try:
            total_count = db.query(HistoricalWorker).count()
            excel_exists = HISTORICAL_EXCEL_PATH.exists()
            excel_size_kb = round(HISTORICAL_EXCEL_PATH.stat().st_size / 1024, 2) if excel_exists else 0
            
            return {
                "total_workers": total_count,
                "excel_file_exists": excel_exists,
                "excel_size_kb": excel_size_kb,
                "excel_path": str(HISTORICAL_EXCEL_PATH),
                "is_active": total_count > 0,
            }
        except Exception as e:
            return {
                "total_workers": 0,
                "excel_file_exists": False,
                "error": str(e),
                "is_active": False,
            }
        finally:
            if own_session:
                db.close()
