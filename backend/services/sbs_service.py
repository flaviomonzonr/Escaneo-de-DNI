import asyncio
import logging
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
import pandas as pd
from sqlalchemy.orm import Session
from playwright.async_api import async_playwright

from backend.config import DATA_DIR, get_peru_now
from backend.database import SBSRecord, HistoricalWorker, SessionLocal

logger = logging.getLogger("sbs_service")

URL_CONSULTA_SBS = "https://servicios.sbs.gob.pe/ReporteSituacionPrevisional/Afil_Consulta.aspx"
REPORTE_SBS_EXCEL_PATH = DATA_DIR / "REPORTE_SBS_HISTORICO.xlsx"


def limpiar_sin_espacios(texto) -> str:
    """Quita tildes y elimina absolutamente todos los espacios en blanco."""
    if pd.isna(texto) or texto is None:
        return ""
    s = str(texto).strip().upper()
    for a, b in {"Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U", "Ü": "U"}.items():
        s = s.replace(a, b)
    return "".join(s.split())


def separar_nombres(nombres_completos) -> Tuple[str, str]:
    """Separa primer y segundo nombre y elimina cualquier espacio residual."""
    if pd.isna(nombres_completos) or nombres_completos is None:
        return "", ""
    s = str(nombres_completos).strip().upper()
    for a, b in {"Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U", "Ü": "U"}.items():
        s = s.replace(a, b)

    partes = s.split()
    if not partes:
        return "", ""
    if len(partes) == 1:
        return partes[0], ""
    if partes[0] in ("DE", "DEL", "LA", "LAS", "LOS") and len(partes) >= 3:
        return f"{partes[0]}{partes[1]}", "".join(partes[2:])
    return partes[0], "".join(partes[1:])


def limpiar_documento(valor) -> Tuple[str, str]:
    """8 dígitos = DNI, 9 dígitos = CE."""
    if pd.isna(valor) or valor is None:
        return "", "DNI"
    doc = "".join(str(valor).split())
    if doc.endswith(".0"):
        doc = doc[:-2]
    digitos = "".join(c for c in doc if c.isdigit())

    if len(digitos) == 9:
        return digitos, "CE"
    if len(digitos) == 8:
        return digitos, "DNI"
    if 0 < len(digitos) < 8:
        return digitos.zfill(8), "DNI"
    return digitos, "DNI"


def extraer_datos_reporte(texto_pantalla: str) -> dict:
    """
    Extrae los 5 campos del Reporte SBS.
    Si el DNI y nombres no figuran afiliados en SPP, marca automáticamente ONP / SNP.
    """
    datos = {
        "FECHA_AFILIACION_SPP": "-",
        "AFP_ACTUAL": "ONP / SNP",
        "CUSPP": "-",
        "SITUACION_ACTUAL": "ONP / SNP",
        "ULTIMO_APORTE": "-"
    }

    lineas = [l.strip() for l in texto_pantalla.splitlines() if l.strip()]
    encontro_afp = False

    for i, linea in enumerate(lineas):
        l_up = linea.upper()

        # 1. Fecha de afiliación al SPP
        if "AFILIADO(A) AL SPP DESDE EL" in l_up:
            m = re.search(r"(\d{2}/\d{2}/\d{4})", linea)
            if m:
                datos["FECHA_AFILIACION_SPP"] = m.group(1)
            elif i + 1 < len(lineas):
                datos["FECHA_AFILIACION_SPP"] = lineas[i + 1]

        # 2. AFP actual
        elif "ACTUALMENTE SE ENCUENTRA AFILIADO(A) A" in l_up:
            resto = re.sub(r"(?i).*ACTUALMENTE SE ENCUENTRA AFILIADO\(A\) A\s*:?\s*", "", linea).strip()
            valor_afp = resto.upper() if resto else (lineas[i + 1].upper() if i + 1 < len(lineas) else "")
            if valor_afp:
                datos["AFP_ACTUAL"] = valor_afp
                encontro_afp = True

        # 3. Código de Identificación del SPP (CUSPP)
        elif "IDENTIFICACIÓN DEL SPP ES" in l_up or "IDENTIFICACION DEL SPP ES" in l_up:
            resto = re.sub(r"(?i).*IDENTIFICACI[OÓ]N DEL SPP ES\s*:?\s*", "", linea).strip()
            if resto:
                datos["CUSPP"] = resto.upper()
            elif i + 1 < len(lineas):
                datos["CUSPP"] = lineas[i + 1].upper()

        # 4. Situación actual
        elif "SU SITUACIÓN ACTUAL ES" in l_up or "SU SITUACION ACTUAL ES" in l_up:
            resto = re.sub(r"(?i).*SU SITUACI[OÓ]N ACTUAL ES\s*:?\s*", "", linea).strip()
            if resto:
                datos["SITUACION_ACTUAL"] = resto.upper()
            elif i + 1 < len(lineas):
                datos["SITUACION_ACTUAL"] = lineas[i + 1].upper()

        # 5. Fecha de devengue del último aporte
        elif "DEVENGUE DE SU ÚLTIMO APORTE ES" in l_up or "DEVENGUE DE SU ULTIMO APORTE ES" in l_up:
            m = re.search(r"(\d{2}/\d{4})", linea)
            if m:
                datos["ULTIMO_APORTE"] = m.group(1)
            elif i + 1 < len(lineas):
                datos["ULTIMO_APORTE"] = lineas[i + 1]

    if not encontro_afp or datos["AFP_ACTUAL"] in ("", "-"):
        datos = {
            "FECHA_AFILIACION_SPP": "-",
            "AFP_ACTUAL": "ONP / SNP",
            "CUSPP": "-",
            "SITUACION_ACTUAL": "ONP / SNP",
            "ULTIMO_APORTE": "-"
        }

    return datos


async def obtener_frame_activo(page):
    for f in [page] + page.frames:
        try:
            if await f.locator("input[type='text']:visible").count() >= 4:
                return f
        except Exception:
            pass
    return page


class SBSService:
    """
    Servicio de Consulta Automatizada de Situación Previsional (SBS)
    Permite obtener AFP, CUSPP, Estado de Afiliación y Último Aporte.
    Guarda todos los resultados en disco local (Base de Datos SQLite y Archivo Excel) para futuros reportes.
    """

    @classmethod
    def get_excel_report_path(cls) -> Path:
        return REPORTE_SBS_EXCEL_PATH

    @classmethod
    def save_record_to_local_disk(
        cls,
        doc_num: str,
        doc_type: str,
        ap_pat: str,
        ap_mat: str,
        nombres: str,
        sbs_data: dict,
        db: Optional[Session] = None,
        raw_text: str = "",
    ) -> None:
        """
        Guarda en el disco local:
        1. En la base de datos SQLite (tabla sbs_records)
        2. En el archivo Excel local (data/REPORTE_SBS_HISTORICO.xlsx)
        """
        # 1. Guardar en SQLite
        should_close_db = False
        if db is None:
            db = SessionLocal()
            should_close_db = True

        try:
            clean_doc = doc_num.strip()
            existing = db.query(SBSRecord).filter(SBSRecord.doc_number == clean_doc).first()
            if existing:
                existing.doc_type = doc_type
                existing.paternal_surname = ap_pat
                existing.maternal_surname = ap_mat
                existing.first_names = nombres
                existing.afp_actual = sbs_data.get("AFP_ACTUAL", "ONP / SNP")
                existing.cuspp = sbs_data.get("CUSPP", "-")
                existing.fecha_afiliacion_spp = sbs_data.get("FECHA_AFILIACION_SPP", "-")
                existing.situacion_actual = sbs_data.get("SITUACION_ACTUAL", "ONP / SNP")
                existing.ultimo_aporte = sbs_data.get("ULTIMO_APORTE", "-")
                existing.consulted_at = get_peru_now()
                existing.raw_text = raw_text
            else:
                new_rec = SBSRecord(
                    doc_number=clean_doc,
                    doc_type=doc_type,
                    paternal_surname=ap_pat,
                    maternal_surname=ap_mat,
                    first_names=nombres,
                    afp_actual=sbs_data.get("AFP_ACTUAL", "ONP / SNP"),
                    cuspp=sbs_data.get("CUSPP", "-"),
                    fecha_afiliacion_spp=sbs_data.get("FECHA_AFILIACION_SPP", "-"),
                    situacion_actual=sbs_data.get("SITUACION_ACTUAL", "ONP / SNP"),
                    ultimo_aporte=sbs_data.get("ULTIMO_APORTE", "-"),
                    consulted_at=get_peru_now(),
                    raw_text=raw_text,
                )
                db.add(new_rec)
            db.commit()
        except Exception as e:
            logger.error(f"Error guardando en sbs_records SQLite: {e}")
            db.rollback()
        finally:
            if should_close_db:
                db.close()

        # 2. Guardar en Excel en disco local (data/REPORTE_SBS_HISTORICO.xlsx)
        cls._append_to_excel(
            doc_num=doc_num,
            doc_type=doc_type,
            ap_pat=ap_pat,
            ap_mat=ap_mat,
            nombres=nombres,
            sbs_data=sbs_data,
        )

    @classmethod
    def _append_to_excel(
        cls,
        doc_num: str,
        doc_type: str,
        ap_pat: str,
        ap_mat: str,
        nombres: str,
        sbs_data: dict,
    ) -> None:
        try:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            now_str = get_peru_now().strftime("%Y-%m-%d %H:%M:%S")

            row_data = {
                "DNI": doc_num,
                "TIPO": doc_type,
                "APELLIDO_PATERNO": ap_pat,
                "APELLIDO_MATERNO": ap_mat,
                "NOMBRES": nombres,
                "AFP_ACTUAL": sbs_data.get("AFP_ACTUAL", "ONP / SNP"),
                "CUSPP": sbs_data.get("CUSPP", "-"),
                "FECHA_AFILIACION_SPP": sbs_data.get("FECHA_AFILIACION_SPP", "-"),
                "SITUACION_ACTUAL": sbs_data.get("SITUACION_ACTUAL", "ONP / SNP"),
                "ULTIMO_APORTE": sbs_data.get("ULTIMO_APORTE", "-"),
                "FECHA_CONSULTA": now_str,
            }

            if REPORTE_SBS_EXCEL_PATH.exists():
                try:
                    df = pd.read_excel(REPORTE_SBS_EXCEL_PATH, dtype=str)
                    # Si ya existe el DNI, actualizarlo; si no, agregarlo
                    df["DNI"] = df["DNI"].astype(str).str.strip()
                    mask = df["DNI"] == doc_num.strip()
                    if mask.any():
                        for k, v in row_data.items():
                            df.loc[mask, k] = v
                    else:
                        new_row_df = pd.DataFrame([row_data])
                        df = pd.concat([df, new_row_df], ignore_index=True)
                except Exception:
                    df = pd.DataFrame([row_data])
            else:
                df = pd.DataFrame([row_data])

            df.to_excel(REPORTE_SBS_EXCEL_PATH, index=False)
            logger.info(f"Guardado en Excel SBS local: {REPORTE_SBS_EXCEL_PATH} (DNI: {doc_num})")
        except Exception as e:
            logger.warning(f"No se pudo guardar en Excel SBS: {e}")

    @classmethod
    def find_cached_record(cls, doc_number: str, db: Session) -> Optional[Dict[str, Any]]:
        """Busca si el DNI ya fue consultado y guardado en disco local."""
        clean_doc = doc_number.strip()
        rec = db.query(SBSRecord).filter(SBSRecord.doc_number == clean_doc).first()
        if rec:
            return rec.to_dict()
        return None

    @classmethod
    async def consultar_trabajador(
        cls,
        doc_number: str,
        paternal_surname: str,
        maternal_surname: str = "",
        first_names: str = "",
        doc_type: str = "DNI",
        db: Optional[Session] = None,
        force_refresh: bool = False,
    ) -> Dict[str, Any]:
        """
        Consulta la situación previsional en la SBS:
        1. Verifica primero en el disco local SQLite/Excel (0 llamadas remotas).
        2. Si no existe o se pide refrescar, ejecuta Playwright contra el portal oficial SBS.
        3. Persiste el resultado en disco local (SQLite + Excel) para futuros reportes.
        """
        clean_doc, detected_type = limpiar_documento(doc_number)
        eff_type = "CE" if "EXTRANJ" in doc_type.upper() or detected_type == "CE" else "DNI"

        ap_pat = limpiar_sin_espacios(paternal_surname)
        ap_mat = limpiar_sin_espacios(maternal_surname)
        p_nom, s_nom = separar_nombres(first_names)
        full_names = f"{p_nom} {s_nom}".strip()

        if not clean_doc or not ap_pat:
            return {
                "success": False,
                "error": "Se requiere al menos el número de documento y el apellido paterno para consultar en la SBS.",
                "doc_number": clean_doc,
                "afp_actual": "DATO INCOMPLETO",
                "pension_system": "DATO INCOMPLETO",
                "cuspp": "-",
            }

        # 1. Chequeo de Caché Local en Disco
        if not force_refresh and db is not None:
            cached = cls.find_cached_record(clean_doc, db)
            if cached:
                cached["success"] = True
                cached["cached"] = True
                cached["message"] = "Datos previsionales recuperados desde la base local SBS (0 tiempo de espera)."
                return cached

        # 2. Consulta en vivo mediante Playwright
        try:
            async with async_playwright() as p:
                try:
                    browser = await p.chromium.launch(headless=True)
                except Exception as e:
                    logger.error(f"Error lanzando Chromium: {e}")
                    browser = await p.chromium.launch(channel="chrome", headless=True)

                page = await browser.new_page()
                try:
                    await page.goto(URL_CONSULTA_SBS, timeout=30000, wait_until="networkidle")
                    await page.wait_for_timeout(600)

                    frame = await obtener_frame_activo(page)

                    # Seleccionar DNI o CE si corresponde
                    select_doc = frame.locator("select:visible").first
                    if await select_doc.count() > 0:
                        texto_actual = (await select_doc.locator("option:checked").inner_text()).upper()
                        opciones = await select_doc.locator("option").all()
                        target_val = None

                        for opt in opciones:
                            txt = (await opt.inner_text()).upper()
                            val = await opt.get_attribute("value")
                            if eff_type == "DNI" and "DNI" in txt and "DNI" not in texto_actual:
                                target_val = val
                                break
                            if eff_type == "CE" and ("EXTRANJ" in txt or "CARN" in txt) and ("EXTRANJ" not in texto_actual and "CARN" not in texto_actual):
                                target_val = val
                                break

                        if target_val is not None:
                            await select_doc.select_option(value=target_val)
                            await page.wait_for_load_state("networkidle", timeout=10000)
                            await page.wait_for_timeout(600)
                            frame = await obtener_frame_activo(page)

                    # Llenar las 5 cajas de texto
                    cajas = frame.locator("input[type='text']:visible")
                    if await cajas.count() < 5:
                        await browser.close()
                        return {
                            "success": False,
                            "error": "El formulario de consulta SBS no cargó los campos requeridos.",
                            "afp_actual": "ONP / SNP",
                            "pension_system": "ONP / SNP",
                            "cuspp": "-",
                        }

                    valores = [clean_doc, ap_pat, ap_mat, p_nom, s_nom]
                    for i, val in enumerate(valores):
                        caja = cajas.nth(i)
                        await caja.click()
                        await caja.fill("")
                        if val:
                            await caja.press_sequentially(val, delay=20)
                            if await caja.input_value() != val:
                                await caja.evaluate(
                                    "(el, v) => { el.value = v; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); }",
                                    val
                                )

                    await page.wait_for_timeout(250)

                    # Clic en botón Buscar
                    btn_buscar = frame.locator(
                        "#btnBuscar, input[id*='Buscar'], input[name*='Buscar'], "
                        "input[type='submit'], input[type='button'][value*='Buscar'], "
                        "button:has-text('Buscar'), a:has-text('Buscar')"
                    ).first

                    if await btn_buscar.count() > 0:
                        await btn_buscar.click(force=True)
                    else:
                        await cajas.nth(3).press("Enter")

                    await page.wait_for_load_state("networkidle", timeout=15000)
                    await page.wait_for_timeout(1000)

                    # Extraer texto de la pantalla de resultados
                    texto_pantalla = ""
                    for f in [page] + page.frames:
                        texto_pantalla += "\n" + (await f.locator("body").inner_text())

                    sbs_resultado = extraer_datos_reporte(texto_pantalla)
                    await browser.close()

                    # 3. Guardar en disco local para futuros reportes (SQLite y Excel)
                    cls.save_record_to_local_disk(
                        doc_num=clean_doc,
                        doc_type=eff_type,
                        ap_pat=paternal_surname,
                        ap_mat=maternal_surname,
                        nombres=first_names,
                        sbs_data=sbs_resultado,
                        db=db,
                        raw_text=texto_pantalla[:1000],
                    )

                    return {
                        "success": True,
                        "doc_number": clean_doc,
                        "doc_type": eff_type,
                        "paternal_surname": paternal_surname,
                        "maternal_surname": maternal_surname,
                        "first_names": first_names,
                        "full_name": f"{paternal_surname} {maternal_surname} {first_names}".strip(),
                        "afp_actual": sbs_resultado.get("AFP_ACTUAL", "ONP / SNP"),
                        "pension_system": sbs_resultado.get("AFP_ACTUAL", "ONP / SNP"),
                        "cuspp": sbs_resultado.get("CUSPP", "-"),
                        "fecha_afiliacion_spp": sbs_resultado.get("FECHA_AFILIACION_SPP", "-"),
                        "situacion_actual": sbs_resultado.get("SITUACION_ACTUAL", "ONP / SNP"),
                        "ultimo_aporte": sbs_resultado.get("ULTIMO_APORTE", "-"),
                        "source": "sbs_live",
                        "cached": False,
                        "message": f"Situación previsional obtenida desde SBS: {sbs_resultado.get('AFP_ACTUAL')}",
                    }

                except Exception as e:
                    await browser.close()
                    raise e

        except Exception as e:
            logger.error(f"Error durante la consulta Playwright SBS para {clean_doc}: {e}")
            # Si falla la red o timeout, devolver fallback seguro
            return {
                "success": False,
                "error": f"No se pudo consultar el portal de la SBS: {str(e)[:150]}",
                "doc_number": clean_doc,
                "afp_actual": "ONP / SNP",
                "pension_system": "ONP / SNP",
                "cuspp": "-",
                "source": "error",
            }

    @classmethod
    def get_stats(cls, db: Session) -> Dict[str, Any]:
        """Retorna estadísticas de registros SBS guardados en disco local."""
        count = db.query(SBSRecord).count()
        excel_exists = REPORTE_SBS_EXCEL_PATH.exists()
        excel_size_kb = round(REPORTE_SBS_EXCEL_PATH.stat().st_size / 1024, 2) if excel_exists else 0

        return {
            "total_sbs_records": count,
            "excel_file_exists": excel_exists,
            "excel_path": str(REPORTE_SBS_EXCEL_PATH),
            "excel_size_kb": excel_size_kb,
        }

