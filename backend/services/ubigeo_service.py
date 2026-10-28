import os
import json
import re
import unicodedata
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
JSON_PATH = DATA_DIR / "ubigeos.json"
EXCEL_PATH = DATA_DIR / "ubigeos_peru.xlsx"
FALLBACK_EXCEL_PATH = DATA_DIR / "ubigeos_con_provincia_y_departamento.xlsx"


def _normalize_str(text: Optional[str]) -> str:
    """Removes accents, uppercase, strips extra whitespace."""
    if not text:
        return ""
    text = str(text).strip().upper()
    # Normalize unicode to decompose accents (NFD) and remove non-spacing marks
    nfkd = unicodedata.normalize('NFD', text)
    cleaned = "".join([c for c in nfkd if unicodedata.category(c) != 'Mn'])
    # Replace non-alphanumeric (except spaces)
    cleaned = re.sub(r"[^A-Z0-9\s]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


class UbigeoService:
    _instance: Optional["UbigeoService"] = None

    def __init__(self):
        self.records: List[Dict[str, Any]] = []
        self.by_inei: Dict[str, Dict[str, Any]] = {}
        self.by_reniec: Dict[str, Dict[str, Any]] = {}
        self.by_hierarchy: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
        self.by_prov_dist: Dict[Tuple[str, str], List[Dict[str, Any]]] = {}
        self.by_dist: Dict[str, List[Dict[str, Any]]] = {}
        self.by_dept: Dict[str, List[Dict[str, Any]]] = {}
        self._load_data()

    @classmethod
    def get_instance(cls) -> "UbigeoService":
        if cls._instance is None:
            cls._instance = UbigeoService()
        return cls._instance

    def _load_data(self):
        """Loads Ubigeo records from JSON or Excel."""
        if JSON_PATH.exists():
            try:
                with open(JSON_PATH, "r", encoding="utf-8") as f:
                    raw_list = json.load(f)
                    for item in raw_list:
                        self._index_record(item)
                if self.records:
                    return
            except Exception as e:
                print(f"[UbigeoService] Warning: Could not load ubigeos.json: {e}")

        # Fallback to Excel if JSON failed or missing
        target_excel = EXCEL_PATH if EXCEL_PATH.exists() else FALLBACK_EXCEL_PATH
        if target_excel.exists():
            try:
                import openpyxl
                wb = openpyxl.load_workbook(target_excel, data_only=True)
                ws = wb.active
                for r in range(2, ws.max_row + 1):
                    dept = str(ws.cell(row=r, column=1).value or "").strip()
                    prov = str(ws.cell(row=r, column=2).value or "").strip()
                    dist = str(ws.cell(row=r, column=3).value or "").strip()
                    id_prov = str(ws.cell(row=r, column=6).value or "").strip().lstrip("'")
                    id_dept = str(ws.cell(row=r, column=7).value or "").strip().lstrip("'")
                    reniec = str(ws.cell(row=r, column=8).value or "").strip().lstrip("'").zfill(6)
                    inei = str(ws.cell(row=r, column=9).value or "").strip().lstrip("'").zfill(6)

                    item = {
                        "ubigeo_reniec": reniec,
                        "ubigeo_inei": inei,
                        "departamento": dept.upper(),
                        "provincia": prov.upper(),
                        "distrito": dist.upper(),
                        "id_departamento": id_dept.zfill(2),
                        "id_provincia": id_prov.zfill(2),
                        "full_text": f"{dept.upper()} / {prov.upper()} / {dist.upper()} ({inei})"
                    }
                    self._index_record(item)
            except Exception as e:
                print(f"[UbigeoService] Error loading Excel: {e}")

    def _index_record(self, item: Dict[str, Any]):
        inei = str(item.get("ubigeo_inei") or "").strip().zfill(6)
        reniec = str(item.get("ubigeo_reniec") or "").strip().zfill(6)
        dept = str(item.get("departamento") or "").strip().upper()
        prov = str(item.get("provincia") or "").strip().upper()
        dist = str(item.get("distrito") or "").strip().upper()

        record = {
            "ubigeo_inei": inei,
            "ubigeo_reniec": reniec,
            "idubigeo": inei,
            "departamento": dept,
            "provincia": prov,
            "distrito": dist,
            "id_departamento": str(item.get("id_departamento") or "").zfill(2),
            "id_provincia": str(item.get("id_provincia") or "").zfill(2),
            "full_text": item.get("full_text") or f"{dept} / {prov} / {dist} ({inei})"
        }
        self.records.append(record)

        if inei and inei != "000000":
            self.by_inei[inei] = record
        if reniec and reniec != "000000":
            self.by_reniec[reniec] = record

        dept_n = _normalize_str(dept)
        prov_n = _normalize_str(prov)
        dist_n = _normalize_str(dist)

        self.by_hierarchy[(dept_n, prov_n, dist_n)] = record
        self.by_prov_dist.setdefault((prov_n, dist_n), []).append(record)
        self.by_dist.setdefault(dist_n, []).append(record)
        self.by_dept.setdefault(dept_n, []).append(record)

    def lookup_by_code(self, code: Optional[str]) -> Optional[Dict[str, Any]]:
        """Finds record by 6-digit INEI or RENIEC code."""
        if not code:
            return None
        clean_code = re.sub(r"\D", "", str(code))
        if len(clean_code) != 6:
            return None
        # Try INEI first (official IDUBIGEO)
        if clean_code in self.by_inei:
            return self.by_inei[clean_code]
        # Then RENIEC
        if clean_code in self.by_reniec:
            return self.by_reniec[clean_code]
        return None

    def lookup_by_hierarchy(
        self,
        departamento: Optional[str],
        provincia: Optional[str],
        distrito: Optional[str]
    ) -> Optional[Dict[str, Any]]:
        """Exact or fuzzy match by Department, Province, and District names."""
        dept_n = _normalize_str(departamento)
        prov_n = _normalize_str(provincia)
        dist_n = _normalize_str(distrito)

        # 1. Exact triple match
        if (dept_n, prov_n, dist_n) in self.by_hierarchy:
            return self.by_hierarchy[(dept_n, prov_n, dist_n)]

        # 2. Province + District match
        if (prov_n, dist_n) in self.by_prov_dist:
            matches = self.by_prov_dist[(prov_n, dist_n)]
            if dept_n:
                for m in matches:
                    if _normalize_str(m["departamento"]) == dept_n or dept_n in _normalize_str(m["departamento"]):
                        return m
            return matches[0]

        # 3. District match with optional department or province hint
        if dist_n in self.by_dist:
            matches = self.by_dist[dist_n]
            if len(matches) == 1:
                return matches[0]
            # Multiple districts with same name (e.g. SAN ISIDRO, MIRAFLORES, CARMEN DE LA LEGUA)
            if dept_n:
                for m in matches:
                    if _normalize_str(m["departamento"]) == dept_n:
                        if prov_n and _normalize_str(m["provincia"]) == prov_n:
                            return m
                        return m
            if prov_n:
                for m in matches:
                    if _normalize_str(m["provincia"]) == prov_n:
                        return m
            return matches[0]

        # 4. Fuzzy / substring matching for OCR misspellings
        # e.g., "OUILLO" -> "QUILLO", "CHAVIN HUANTAR" -> "CHAVIN DE HUANTAR"
        dist_fixed = dist_n
        if dist_fixed.startswith("OUI"):
            dist_fixed = "QUI" + dist_fixed[3:]
        elif dist_fixed.startswith("OUE"):
            dist_fixed = "QUE" + dist_fixed[3:]

        if dist_fixed in self.by_dist:
            matches = self.by_dist[dist_fixed]
            if dept_n:
                for m in matches:
                    if _normalize_str(m["departamento"]) == dept_n:
                        return m
            return matches[0]

        # Search by word inclusion in district name
        if len(dist_n) >= 4:
            for k_dist, cand_list in self.by_dist.items():
                if dist_n in k_dist or k_dist in dist_n:
                    if dept_n:
                        for m in cand_list:
                            if _normalize_str(m["departamento"]) == dept_n:
                                return m
                    return cand_list[0]

        return None

    def resolve_from_text(self, text: Optional[str]) -> Optional[Dict[str, Any]]:
        """
        Intelligently resolves an Ubigeo record from any raw text:
        - 6-digit code: "020502"
        - Slash separated: "ANCASH / BOLOGNESI / ABELARDO PARDO LEZAMETA (020502)"
        - Dash separated: "LIMA - LIMA - MIRAFLORES"
        - Text with embedded code: "UBIGEO 150116"
        """
        if not text:
            return None
        text_str = str(text).strip()

        # Check if contains a 6 digit code
        m_code = re.search(r"\b(\d{6})\b", text_str)
        if m_code:
            match = self.lookup_by_code(m_code.group(1))
            if match:
                return match

        # Check slash or dash separation
        parts = [p.strip() for p in re.split(r"[/\-–—]", text_str) if p.strip()]
        if len(parts) >= 3:
            dept = parts[0]
            prov = parts[1]
            dist = parts[2]
            # Strip code in parentheses if present, e.g. "ABELARDO PARDO LEZAMETA (020502)"
            dist_clean = re.sub(r"\(.*?\)", "", dist).strip()
            res = self.lookup_by_hierarchy(dept, prov, dist_clean)
            if res:
                return res

        if len(parts) == 2:
            cand1 = parts[0]
            cand2 = re.sub(r"\(.*?\)", "", parts[1]).strip()
            # Try as (Dept, Dist) or (Prov, Dist)
            res = self.lookup_by_hierarchy(cand1, None, cand2)
            if res:
                return res
            res = self.lookup_by_hierarchy(None, cand1, cand2)
            if res:
                return res

        # Single word or phrase
        single_clean = re.sub(r"\(.*?\)", "", text_str).strip()
        return self.lookup_by_hierarchy(None, None, single_clean)

    def search_ubigeos(self, query: str, limit: int = 15) -> List[Dict[str, Any]]:
        """Returns autocomplete suggestions matching query."""
        if not query or len(query.strip()) < 2:
            return []

        q_clean = query.strip()
        q_norm = _normalize_str(q_clean)
        is_num = q_clean.isdigit()

        results = []
        seen = set()

        # 1. Exact prefix matching on code
        if is_num:
            for item in self.records:
                if item["ubigeo_inei"].startswith(q_clean) or item["ubigeo_reniec"].startswith(q_clean):
                    if item["ubigeo_inei"] not in seen:
                        seen.add(item["ubigeo_inei"])
                        results.append(item)
                        if len(results) >= limit:
                            return results

        # 2. Match on District (highest priority for user search)
        for item in self.records:
            dist_n = _normalize_str(item["distrito"])
            if dist_n.startswith(q_norm) or q_norm in dist_n:
                if item["ubigeo_inei"] not in seen:
                    seen.add(item["ubigeo_inei"])
                    results.append(item)
                    if len(results) >= limit:
                        return results

        # 3. Match on Province or Department
        for item in self.records:
            prov_n = _normalize_str(item["provincia"])
            dept_n = _normalize_str(item["departamento"])
            if q_norm in prov_n or q_norm in dept_n:
                if item["ubigeo_inei"] not in seen:
                    seen.add(item["ubigeo_inei"])
                    results.append(item)
                    if len(results) >= limit:
                        return results

        return results


# Global singleton helper
ubigeo_service = UbigeoService.get_instance()
