import json
import logging
import asyncio
from pathlib import Path
from typing import Dict, Any, Optional, List
import httpx
from backend.config import DATA_DIR
from backend.services.ubigeo_service import UbigeoService

logger = logging.getLogger("factiliza_service")

CONFIG_FILE = DATA_DIR / "factiliza_config.json"
FACTILIZA_DNI_URL = "https://api.factiliza.com/v1/dni/info"
FACTILIZA_CEE_URL = "https://api.factiliza.com/v1/cee/info"


def get_saved_token() -> str:
    """Obtiene el token guardado en el archivo de configuración local."""
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return (data.get("token") or "").strip()
        except Exception as e:
            logger.warning(f"No se pudo leer {CONFIG_FILE}: {e}")
    return ""


def save_token(token: str) -> None:
    """Guarda el token de Factiliza en el archivo de configuración local."""
    token_clean = (token or "").strip()
    try:
        CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump({"token": token_clean}, f, indent=2, ensure_ascii=False)
        logger.info("Token de Factiliza guardado correctamente.")
    except Exception as e:
        logger.error(f"Error al guardar token de Factiliza: {e}")
        raise


def _to_str(val) -> str:
    """Convierte de forma segura cualquier tipo de dato (incluyendo listas) a string limpio."""
    if val is None:
        return ""
    if isinstance(val, list):
        # Si es una lista como ["13", "1309", "130901"], tomar el último elemento (código distrital de 6 dígitos)
        return str(val[-1]).strip() if val else ""
    return str(val).strip()


async def query_dni_factiliza(dni: str, token: Optional[str] = None) -> Dict[str, Any]:
    """
    Consulta los datos de un DNI peruano (8 dígitos) a través de Factiliza API.
    GET https://api.factiliza.com/v1/dni/info/{dni}
    Header: Authorization: Bearer <token>
    """
    clean_dni = (dni or "").strip().replace(" ", "")
    if not clean_dni.isdigit() or len(clean_dni) != 8:
        return {
            "success": False,
            "status_code": 400,
            "error": "El DNI debe contener exactamente 8 dígitos numéricos.",
            "doc_number": clean_dni,
            "dni": clean_dni,
        }

    active_token = (token or "").strip() or get_saved_token()
    if not active_token:
        return {
            "success": False,
            "status_code": 401,
            "error": "El DNI no figura en la Data Histórica (7,752 registros) y no se ha configurado el Token de Factiliza para consultar en línea.",
            "needs_token": True,
            "doc_number": clean_dni,
            "dni": clean_dni,
        }

    url = f"{FACTILIZA_DNI_URL}/{clean_dni}"
    headers = {
        "Authorization": f"Bearer {active_token}",
        "Accept": "application/json",
        "User-Agent": "EscanDNI-Peru/2.6 (Agroindustrias Chavin)",
    }

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.get(url, headers=headers)

        if response.status_code == 200:
            raw_json = response.json()
            data = raw_json.get("data", raw_json) if isinstance(raw_json, dict) else {}

            if not data or not isinstance(data, dict):
                return {
                    "success": False,
                    "status_code": 404,
                    "error": f"DNI {clean_dni} no encontrado en el padrón de Factiliza. Puedes registrar los datos manualmente.",
                    "doc_number": clean_dni,
                    "dni": clean_dni,
                    "can_fill_manually": True,
                }

            # Normalizar campos de Factiliza de forma 100% segura
            nombres = _to_str(data.get("nombres") or data.get("first_names")).upper()
            apellido_paterno = _to_str(data.get("apellido_paterno") or data.get("paternal_surname")).upper()
            apellido_materno = _to_str(data.get("apellido_materno") or data.get("maternal_surname")).upper()
            nombre_completo = _to_str(data.get("nombre_completo") or f"{nombres} {apellido_paterno} {apellido_materno}".strip()).upper()

            # En caso vengan nombres y apellidos en una sola cadena
            if not nombres and nombre_completo:
                parts = nombre_completo.replace(",", "").split()
                if len(parts) >= 3:
                    apellido_paterno = parts[0]
                    apellido_materno = parts[1]
                    nombres = " ".join(parts[2:])
                elif len(parts) == 2:
                    apellido_paterno = parts[0]
                    nombres = parts[1]

            sexo = _to_str(data.get("sexo")).upper()
            if sexo in ["1", "M", "MASCULINO"]:
                sexo = "MASCULINO"
            elif sexo in ["2", "F", "FEMENINO"]:
                sexo = "FEMENINO"

            fecha_nacimiento = _to_str(data.get("fecha_nacimiento") or data.get("nacimiento"))
            if "-" in fecha_nacimiento and len(fecha_nacimiento) == 10:
                y, m, d = fecha_nacimiento.split("-")
                fecha_nacimiento = f"{d}/{m}/{y}"

            direccion = _to_str(data.get("direccion") or data.get("direccion_completa")).upper()
            departamento = _to_str(data.get("departamento")).upper()
            provincia = _to_str(data.get("provincia")).upper()
            distrito = _to_str(data.get("distrito")).upper()

            ubigeo_reniec = _to_str(data.get("ubigeo_reniec"))
            ubigeo_inei = _to_str(data.get("ubigeo_sunat") or data.get("ubigeo_inei"))
            if not ubigeo_inei and isinstance(data.get("ubigeo"), list):
                ubigeo_inei = _to_str(data.get("ubigeo"))

            # Si tenemos departamento, provincia y distrito pero falta ubigeo, resolverlo
            if (not ubigeo_reniec or not ubigeo_inei) and departamento and distrito:
                try:
                    ub_service = UbigeoService.get_instance()
                    matches = ub_service.search_ubigeos(f"{departamento} {distrito}", limit=1)
                    if matches:
                        best = matches[0]
                        ubigeo_reniec = ubigeo_reniec or best.get("ubigeo_reniec", "")
                        ub_inei = ubigeo_inei or best.get("ubigeo_inei", "")
                except Exception:
                    pass

            return {
                "success": True,
                "status_code": 200,
                "source": "factiliza",
                "doc_type": "DNI",
                "doc_number": clean_dni,
                "first_names": nombres,
                "paternal_surname": apellido_paterno,
                "maternal_surname": apellido_materno,
                "full_name": nombre_completo,
                "sex": sexo,
                "birth_date": fecha_nacimiento,
                "nationality": "PERUANA",
                "address": direccion,
                "department": departamento,
                "province": provincia,
                "district": distrito,
                "ubigeo_reniec": ubigeo_reniec,
                "ubigeo_inei": ubigeo_inei,
                "raw_response": data,
            }

        elif response.status_code == 401:
            return {
                "success": False,
                "status_code": 401,
                "error": "Token de Factiliza no autorizado o vencido. Por favor actualiza tu token en la casilla superior.",
                "needs_token": True,
                "doc_number": clean_dni,
                "dni": clean_dni,
            }
        elif response.status_code == 404:
            return {
                "success": False,
                "status_code": 404,
                "error": f"DNI {clean_dni} no encontrado en el padrón de Factiliza. Puedes registrar los datos manualmente.",
                "doc_number": clean_dni,
                "dni": clean_dni,
                "can_fill_manually": True,
            }
        else:
            return {
                "success": False,
                "status_code": response.status_code,
                "error": f"Factiliza respondió con código {response.status_code}. Puedes completar los datos manualmente.",
                "doc_number": clean_dni,
                "dni": clean_dni,
                "can_fill_manually": True,
            }

    except httpx.TimeoutException:
        return {
            "success": False,
            "status_code": 504,
            "error": "Tiempo de espera agotado al consultar Factiliza. Puedes intentar de nuevo o ingresar los datos manualmente.",
            "doc_number": clean_dni,
            "dni": clean_dni,
            "can_fill_manually": True,
        }
    except Exception as e:
        logger.error(f"Error consultando Factiliza para DNI {clean_dni}: {e}")
        return {
            "success": False,
            "status_code": 500,
            "error": f"Error de conexión con Factiliza: {str(e)}. Puedes ingresar los datos manualmente.",
            "doc_number": clean_dni,
            "dni": clean_dni,
            "can_fill_manually": True,
        }


async def query_cee_factiliza(cee: str, token: Optional[str] = None) -> Dict[str, Any]:
    """
    Consulta los datos de un Carnet de Extranjería a través de Factiliza API.
    GET https://api.factiliza.com/v1/cee/info/{cee}
    Header: Authorization: Bearer <token>
    """
    clean_cee = (cee or "").strip().replace(" ", "").upper()
    if not clean_cee:
        return {
            "success": False,
            "status_code": 400,
            "error": "Por favor ingresa un número de Carnet de Extranjería válido.",
            "doc_number": clean_cee,
        }

    active_token = (token or "").strip() or get_saved_token()
    if not active_token:
        return {
            "success": False,
            "status_code": 401,
            "error": "El documento no figura en la Data Histórica (7,752 registros) y no se ha configurado el Token de Factiliza para consultar en línea.",
            "needs_token": True,
            "doc_number": clean_cee,
        }

    url = f"{FACTILIZA_CEE_URL}/{clean_cee}"
    headers = {
        "Authorization": f"Bearer {active_token}",
        "Accept": "application/json",
        "User-Agent": "EscanDNI-Peru/2.6 (Agroindustrias Chavin)",
    }

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.get(url, headers=headers)

        if response.status_code == 200:
            raw_json = response.json()
            data = raw_json.get("data", raw_json) if isinstance(raw_json, dict) else {}

            if not data or not isinstance(data, dict):
                return {
                    "success": False,
                    "status_code": 404,
                    "error": f"Carnet de Extranjería {clean_cee} no encontrado en Factiliza. Puedes registrar los datos manualmente.",
                    "doc_number": clean_cee,
                    "can_fill_manually": True,
                }

            nombres = _to_str(data.get("nombres") or data.get("first_names")).upper()
            apellido_paterno = _to_str(data.get("apellido_paterno") or data.get("paternal_surname")).upper()
            apellido_materno = _to_str(data.get("apellido_materno") or data.get("maternal_surname")).upper()
            nombre_completo = _to_str(data.get("nombre_completo") or f"{nombres} {apellido_paterno} {apellido_materno}".strip()).upper()
            num = _to_str(data.get("numero") or clean_cee)

            return {
                "success": True,
                "status_code": 200,
                "source": "factiliza",
                "doc_type": "Carnet de Extranjería",
                "doc_number": num,
                "first_names": nombres,
                "paternal_surname": apellido_paterno,
                "maternal_surname": apellido_materno,
                "full_name": nombre_completo,
                "nationality": _to_str(data.get("nacionalidad") or data.get("pais")).upper(),
                "birth_date": _to_str(data.get("fecha_nacimiento")),
                "sex": _to_str(data.get("sexo")).upper(),
                "address": _to_str(data.get("direccion")).upper(),
                "raw_response": data,
            }
        elif response.status_code == 401:
            return {
                "success": False,
                "status_code": 401,
                "error": "Token de Factiliza no autorizado o vencido. Por favor actualiza tu token en la casilla superior.",
                "needs_token": True,
                "doc_number": clean_cee,
            }
        elif response.status_code == 404:
            return {
                "success": False,
                "status_code": 404,
                "error": f"Carnet de Extranjería {clean_cee} no encontrado en Factiliza. Puedes registrar los datos manualmente.",
                "doc_number": clean_cee,
                "can_fill_manually": True,
            }
        else:
            return {
                "success": False,
                "status_code": response.status_code,
                "error": f"Factiliza respondió con código {response.status_code}. Puedes completar los datos manualmente.",
                "doc_number": clean_cee,
                "can_fill_manually": True,
            }
    except Exception as e:
        logger.error(f"Error consultando Factiliza para CEE {clean_cee}: {e}")
        return {
            "success": False,
            "status_code": 500,
            "error": f"Error de conexión con Factiliza: {str(e)}. Puedes ingresar los datos manualmente.",
            "doc_number": clean_cee,
            "can_fill_manually": True,
        }


async def query_document_factiliza(doc_type: str, doc_number: str, token: Optional[str] = None) -> Dict[str, Any]:
    """Consulta DNI o Carnet de Extranjería automáticamente según el tipo de documento."""
    norm_doc = (doc_type or "DNI").upper()
    if any(k in norm_doc for k in ["CARNET", "EXTRANJERIA", "CEE", "CE"]):
        return await query_cee_factiliza(doc_number, token)
    return await query_dni_factiliza(doc_number, token)


async def query_batch_factiliza(
    dnis: List[str],
    token: Optional[str] = None,
    max_concurrency: int = 4
) -> Dict[str, Any]:
    """
    Consulta un lote masivo de DNIs contra Factiliza API respetando concurrencia controlada.
    """
    clean_dnis = []
    seen = set()
    for d in dnis:
        c = str(d).strip().replace(" ", "")
        if c.isdigit() and len(c) == 8 and c not in seen:
            clean_dnis.append(c)
            seen.add(c)

    if not clean_dnis:
        return {
            "success": False,
            "error": "No se encontraron DNIs válidos de 8 dígitos en la lista proporcionada.",
            "total": 0,
            "found_count": 0,
            "not_found_count": 0,
            "results": [],
        }

    active_token = (token or "").strip() or get_saved_token()
    if not active_token:
        return {
            "success": False,
            "error": "No se ha configurado el Token de Factiliza. Ingrésalo en la casilla superior de la pantalla.",
            "needs_token": True,
            "total": len(clean_dnis),
            "results": [],
        }

    semaphore = asyncio.Semaphore(max_concurrency)

    async def _query_single(dni: str):
        async with semaphore:
            # Ligero delay para proteger el rate limit
            await asyncio.sleep(0.05)
            res = await query_dni_factiliza(dni, active_token)
            return res

    tasks = [_query_single(d) for d in clean_dnis]
    raw_results = await asyncio.gather(*tasks, return_exceptions=True)

    results = []
    found_count = 0
    not_found_count = 0
    error_count = 0

    for i, res in enumerate(raw_results):
        dni = clean_dnis[i]
        if isinstance(res, Exception):
            results.append({
                "success": False,
                "dni": dni,
                "doc_number": dni,
                "status": "error",
                "error": str(res),
            })
            error_count += 1
        elif isinstance(res, dict) and res.get("success"):
            results.append({
                "success": True,
                "dni": dni,
                "status": "found",
                **res,
            })
            found_count += 1
        else:
            err_msg = res.get("error", "No encontrado") if isinstance(res, dict) else "Error desconocido"
            results.append({
                "success": False,
                "dni": dni,
                "doc_number": dni,
                "status": "not_found",
                "error": err_msg,
            })
            not_found_count += 1

    return {
        "success": True,
        "total": len(clean_dnis),
        "found_count": found_count,
        "not_found_count": not_found_count,
        "error_count": error_count,
        "results": results,
    }
