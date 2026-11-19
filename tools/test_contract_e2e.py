import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.services.excel_template_service import ExcelTemplateService
from backend.database import init_db, SessionLocal, ScannedRecord
import openpyxl

init_db()
excel_template_service = ExcelTemplateService()
db = SessionLocal()

# Create or fetch test scanned record
test_dni = "78965412"
rec = db.query(ScannedRecord).filter_by(doc_number=test_dni).first()
if not rec:
    rec = ScannedRecord(
        doc_type="DNI",
        doc_number=test_dni,
        paternal_surname="QUISPE",
        maternal_surname="MAMANI",
        first_names="CARLOS ALBERTO",
        cod_planilla="ERA",
        nro_contrato="045-2026",
        basico=1500.50,
        inicio_contrato="2026-11-01",
        duracion="3",
        fin_contrato="2027-01-31",
        fecha_firma_contrato="2026-11-01",
        tipo_contrato="02",
        nro_contrato_ref="REF-QUISPE"
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
else:
    rec.cod_planilla = "ERA"
    rec.nro_contrato = "045-2026"
    rec.basico = 1500.50
    rec.inicio_contrato = "2026-11-01"
    rec.duracion = "3"
    rec.fin_contrato = "2027-01-31"
    rec.fecha_firma_contrato = "2026-11-01"
    rec.tipo_contrato = "02"
    rec.nro_contrato_ref = "REF-QUISPE"
    db.commit()

# Test records array
records = [rec.to_dict()]

print(f"Testing template filling with record DNI={rec.doc_number}, Tipo Contrato={rec.tipo_contrato}, Planilla={rec.cod_planilla}")

out_fn, out_path, num_workers, yellow_cols = excel_template_service.fill_template_batch(
    template_name="CARGA DATOS CONTRATOS NISIRA.xlsx",
    records=records,
    sheet_name="CONTRATO"
)

print(f"Output generated: {out_fn}")
print(f"Total workers filled: {num_workers}")
print(f"Yellow/Contract cols detected: {yellow_cols}")

# Inspect generated excel with openpyxl
wb = openpyxl.load_workbook(out_path)
ws = wb["CONTRATO"]

row2 = [ws.cell(row=2, column=c).value for c in range(1, 12)]
print("Row 2 data in generated Excel:")
for c_idx, val in enumerate(row2, start=1):
    header = ws.cell(row=1, column=c_idx).value
    num_fmt = ws.cell(row=2, column=c_idx).number_format
    print(f"  Col {c_idx} [{header}]: value = '{val}' (type: {type(val).__name__}, format: '{num_fmt}')")

# Verifications
assert str(ws.cell(row=2, column=1).value).strip() == test_dni, f"DNI mismatch: {ws.cell(row=2, column=1).value}"
assert "QUISPE" in str(ws.cell(row=2, column=2).value), "Name mismatch"
assert ws.cell(row=2, column=3).value == "ERA", f"Cod. Planilla mismatch: {ws.cell(row=2, column=3).value}"
assert ws.cell(row=2, column=4).value == "045-2026", f"Nro Contrato mismatch: {ws.cell(row=2, column=4).value}"
assert float(ws.cell(row=2, column=5).value) == 1500.50, f"Basico mismatch: {ws.cell(row=2, column=5).value}"
assert ws.cell(row=2, column=10).value == "02", f"Tipo de Contrato mismatch (must preserve leading zero): {ws.cell(row=2, column=10).value}"

print("\n>>> ALL EXCEL CONTRACT ASSIGNMENT ASSERTIONS PASSED 100%! <<<")
