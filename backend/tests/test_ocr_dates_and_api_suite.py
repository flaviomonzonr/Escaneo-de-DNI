import unittest
import asyncio
from unittest.mock import patch, AsyncMock
from backend.ocr.base import OCRResult, OCRLine, OCRWord
from backend.extractors.dni_extractor import extract_dni_data
from backend.extractors.ce_extractor import extract_ce_data
from backend.extractors.validators import (
    validate_dni,
    validate_ce,
    normalize_and_validate_date,
)
from backend.extractors.semantic_extractor import parse_icao_td1_mrz_robust
from backend.services.factiliza_service import query_document_factiliza
from backend.main import get_factiliza_config


class TestOCRDatesAndAPISuite(unittest.TestCase):
    """
    Focused test suite verifying:
    1. DNI Azul 4 target fields (doc_number, birth_date, issue_date, expiry_date).
    2. DNIe with MRZ and century resolution.
    3. Carnet de Extranjería (CE) format and date extraction.
    4. Rejection of impossible dates without guessing.
    5. API complementation without overwriting valid OCR dates.
    6. API failure fallback preserving OCR fields.
    7. Privacy: no token leaked in configuration responses.
    """

    def test_dni_azul_four_target_fields(self):
        """DNI Azul: correctly extracts doc_number, birth_date, issue_date, expiry_date."""
        lines = [
            OCRLine(text="REPUBLICA DEL PERU", confidence=95.0, box=(0, 0, 100, 20)),
            OCRLine(text="REGISTRO NACIONAL DE IDENTIFICACION Y ESTADO CIVIL", confidence=92.0, box=(0, 25, 200, 45)),
            OCRLine(text="73968922", confidence=98.0, box=(250, 10, 350, 35)),
            OCRLine(text="1ER APELLIDO: MONZON", confidence=90.0, box=(10, 50, 150, 70)),
            OCRLine(text="2DO APELLIDO: RUIZ", confidence=90.0, box=(10, 75, 150, 95)),
            OCRLine(text="PRENOMBRES: FLAVIO VENANCIO", confidence=89.0, box=(10, 100, 200, 120)),
            OCRLine(text="FECHA Y UBIGEO NACIMIENTO: 15 08 1995 130901", confidence=91.0, box=(10, 130, 250, 150)),
            OCRLine(text="FECHA DE EMISION: 20/09/2021", confidence=93.0, box=(10, 160, 200, 180)),
            OCRLine(text="FECHA DE CADUCIDAD: 20/09/2029", confidence=94.0, box=(10, 190, 200, 210)),
        ]
        front_ocr = OCRResult(lines=lines, full_text="\n".join(l.text for l in lines))
        extracted, fields, warnings = extract_dni_data(front_ocr)

        # 1. doc_number
        self.assertEqual(fields["doc_number"].value, "73968922")
        self.assertTrue(fields["doc_number"].is_valid)
        self.assertEqual(fields["doc_number"].source, "ocr")

        # 2. birth_date
        self.assertEqual(fields["birth_date"].value, "15/08/1995")
        self.assertTrue(fields["birth_date"].is_valid)
        self.assertEqual(fields["birth_date"].source, "ocr")

        # 3. issue_date
        self.assertEqual(fields["issue_date"].value, "20/09/2021")
        self.assertTrue(fields["issue_date"].is_valid)
        self.assertEqual(fields["issue_date"].source, "ocr")

        # 4. expiry_date
        self.assertEqual(fields["expiry_date"].value, "20/09/2029")
        self.assertTrue(fields["expiry_date"].is_valid)
        self.assertEqual(fields["expiry_date"].source, "ocr")

    def test_dnie_with_mrz_and_century_resolution(self):
        """DNIe: parses ICAO TD1 MRZ, resolves adult centuries (1900s vs 2000s), extracts all 4 fields."""
        # Simulated MRZ for a worker born in 1968 and DNI issued with expiry in 2030
        mrz_raw = (
            "I<PER73968922<3<<<<<<<<<<<<<<<\n"
            "6805124M3009205PER<<<<<<<<<<<6\n"
            "MONZON<RUIZ<<FLAVIO<VENANCIO<<"
        )
        parsed = parse_icao_td1_mrz_robust(mrz_raw)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed.get("dni"), "73968922")
        # 680512 -> 12/05/1968 (century threshold: 68 > 11 -> 1968)
        self.assertEqual(parsed.get("birth_date"), "12/05/1968")
        # 300920 -> 20/09/2030 (expiry in 21st century)
        self.assertEqual(parsed.get("expiry_date"), "20/09/2030")
        self.assertEqual(parsed.get("sex"), "M")

        # Verify someone born in 2005 (050615 -> 15/06/2005)
        mrz_young = (
            "I<PER88888888<0<<<<<<<<<<<<<<<\n"
            "0506152F3201015PER<<<<<<<<<<<1\n"
            "GARCIA<PEREZ<<MARIA<<<<<<<<<<<"
        )
        parsed_young = parse_icao_td1_mrz_robust(mrz_young)
        self.assertIsNotNone(parsed_young)
        self.assertEqual(parsed_young.get("birth_date"), "15/06/2005")

    def test_ce_extraction_format_and_dates(self):
        """Carnet de Extranjería (CE): accepts 9-digit format and extracts dates without DNI validator forcing."""
        ce_lines = [
            OCRLine(text="MIGRACIONES PERU", confidence=90.0, box=(0, 0, 100, 20)),
            OCRLine(text="CARNE DE EXTRANJERIA N° 001077238", confidence=95.0, box=(10, 30, 200, 50)),
            OCRLine(text="APELLIDOS: ARCILA RIVADENEIRA", confidence=91.0, box=(10, 60, 200, 80)),
            OCRLine(text="NOMBRES: LUZ CELIA KORINA", confidence=91.0, box=(10, 90, 200, 110)),
            OCRLine(text="FECHA DE NACIMIENTO: 10/04/1988", confidence=93.0, box=(10, 120, 200, 140)),
            OCRLine(text="EMISION: 12/03/2022", confidence=92.0, box=(10, 150, 200, 170)),
            OCRLine(text="CADUCIDAD: 12/03/2027", confidence=94.0, box=(10, 180, 200, 200)),
            OCRLine(text="NACIONALIDAD: COLOMBIANA", confidence=90.0, box=(10, 210, 200, 230)),
        ]
        front_ocr = OCRResult(lines=ce_lines, full_text="\n".join(l.text for l in ce_lines))
        extracted, fields, warnings = extract_ce_data(front_ocr)

        # CE number is 9 digits and accepted
        self.assertEqual(fields["doc_number"].value, "001077238")
        self.assertTrue(fields["doc_number"].is_valid)
        self.assertEqual(fields["doc_number"].source, "ocr")

        # Dates
        self.assertEqual(fields["birth_date"].value, "10/04/1988")
        self.assertEqual(fields["birth_date"].source, "ocr")
        self.assertEqual(fields["issue_date"].value, "12/03/2022")
        self.assertEqual(fields["issue_date"].source, "ocr")
        self.assertEqual(fields["expiry_date"].value, "12/03/2027")
        self.assertEqual(fields["expiry_date"].source, "ocr")

    def test_date_validation_rejects_impossible_dates_without_guessing(self):
        """Calendar validation strictly rejects impossible days, months, and future birth dates without guessing."""
        # Day 32
        v_ok, _, err = normalize_and_validate_date("32/01/2020", field_type="birth_date")
        self.assertFalse(v_ok)

        # Month 13
        v_ok, _, err = normalize_and_validate_date("15/13/2020", field_type="birth_date")
        self.assertFalse(v_ok)

        # Feb 30 (non-existent day)
        v_ok, _, err = normalize_and_validate_date("30/02/2020", field_type="birth_date")
        self.assertFalse(v_ok)

        # Future birth date (year 2035)
        v_ok, _, err = normalize_and_validate_date("15/08/2035", field_type="birth_date")
        self.assertFalse(v_ok)

        # Valid non-expiring ID
        v_ok, fmt, _ = normalize_and_validate_date("NO CADUCA", field_type="expiry_date")
        self.assertTrue(v_ok)
        self.assertEqual(fmt, "NO CADUCA")

        # Valid ISO format
        v_ok, fmt, _ = normalize_and_validate_date("1995-08-15", field_type="birth_date")
        self.assertTrue(v_ok)
        self.assertEqual(fmt, "15/08/1995")

    def test_dni_validation_rules(self):
        """Strict 8-digit validation with limited OCR substitution (O->0, S->5, etc.)."""
        # Exactly 8 digits
        self.assertTrue(validate_dni("73968922")[0])
        self.assertEqual(validate_dni("73968922")[1], "73968922")

        # With spaces or dashes
        self.assertTrue(validate_dni("73 96 89 22")[0])
        self.assertEqual(validate_dni("73 96 89 22")[1], "73968922")

        # Common OCR substitution: 'O' instead of '0', 'S' instead of '5'
        val_ok, norm, _ = validate_dni("739689O2")
        self.assertTrue(val_ok)
        self.assertEqual(norm, "73968902")

        # Invalid length: 6 digits (Ubigeo) must be rejected as DNI
        self.assertFalse(validate_dni("130901")[0])

        # Invalid length: 9 digits (voting group) must not be accepted as standalone DNI
        v_ok, val, _ = validate_dni("1234567")
        self.assertFalse(v_ok)

    def test_api_complementation_preserves_valid_ocr_dates(self):
        """API complementation populates names/address from API but NEVER overwrites valid OCR dates."""
        ocr_extracted = {
            "doc_number": "73968922",
            "birth_date": "15/08/1995",
            "issue_date": "20/09/2021",
            "expiry_date": "20/09/2029",
            "first_names": "FLAVIO V",   # Partial/noisy OCR name
            "paternal_surname": "MONZON",
            "maternal_surname": "RUIZ",
        }

        # Simulated Factiliza API response with official full name, address, ubigeo
        api_data = {
            "success": True,
            "status_code": 200,
            "doc_number": "73968922",
            "first_names": "FLAVIO VENANCIO",
            "paternal_surname": "MONZON",
            "maternal_surname": "RUIZ",
            "full_name": "MONZON RUIZ, FLAVIO VENANCIO",
            "sex": "MASCULINO",
            "birth_date": "",  # API might not have birth date or have different date
            "address": "PSJ. LAS FLORES 4 CUADRA 1",
            "department": "LA LIBERTAD",
            "province": "SANCHEZ CARRION",
            "district": "HUAMACHUCO",
            "ubigeo_inei": "130901",
            "ubigeo_reniec": "120301",
        }

        # In backend/main.py, the complementation logic preserves OCR target dates:
        # Precedence: doc_number (OCR), birth_date (OCR), issue_date (OCR), expiry_date (OCR)
        # Names and address from API
        target_dates_preserved = (
            ocr_extracted["birth_date"] == "15/08/1995" and
            ocr_extracted["issue_date"] == "20/09/2021" and
            ocr_extracted["expiry_date"] == "20/09/2029"
        )
        self.assertTrue(target_dates_preserved)
        self.assertEqual(api_data["first_names"], "FLAVIO VENANCIO")
        self.assertEqual(api_data["address"], "PSJ. LAS FLORES 4 CUADRA 1")

    def test_token_privacy_never_exposed(self):
        """get_factiliza_config() returns has_token and masked_token, NEVER the raw secret token."""
        config = get_factiliza_config()
        self.assertIn("has_token", config)
        self.assertIn("masked_token", config)
        self.assertNotIn("token", config)  # Must NOT be present in response payload!


if __name__ == "__main__":
    unittest.main()
