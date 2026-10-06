import os
import sys
import glob
import cv2

sys.path.insert(0, os.path.abspath(".."))
from backend.ocr.rapid_engine import RapidOCREngine
from backend.extractors.dni_extractor import extract_dni_data

def run_targeted_test():
    engine = RapidOCREngine()
    
    # 1. Front sample 1 (DNIe)
    f1 = "../DNIS/WhatsApp Image 2026-09-14 at 11.18.00 PM.jpeg"
    # 2. Front sample 2 (DNIe multiple)
    f2 = "../DNIS/WhatsApp Image 2026-09-14 at 11.18.02 PM.jpeg"
    # 3. Back sample 1
    back_files = glob.glob("../uploads/*_back_enhanced.jpg")
    b1 = back_files[0] if back_files else None
    
    test_set = [("ANVERSO 1 (WhatsApp Image 11.18.00)", f1, None)]
    if b1:
        test_set.append(("ANVERSO + REVERSO PAIR", f1, b1))
        test_set.append(("REVERSO SOLO", None, b1))

    for title, front_path, back_path in test_set:
        print("="*80, flush=True)
        print(f"TEST: {title}", flush=True)
        front_res = None
        back_res = None
        
        if front_path and os.path.exists(front_path):
            img_front = cv2.imread(front_path)
            if img_front is not None:
                front_res = engine.extract(img_front)
                print("\n>>> [ANVERSO] TEXTO COMPLETO OCR:", flush=True)
                for line in front_res.lines:
                    safe = line.text.encode("ascii", "replace").decode("ascii")
                    print(f"   (conf: {line.confidence:.1f}%) [box: {line.box}] -> '{safe}'", flush=True)

        if back_path and os.path.exists(back_path):
            img_back = cv2.imread(back_path)
            if img_back is not None:
                back_res = engine.extract(img_back)
                print("\n>>> [REVERSO] TEXTO COMPLETO OCR:", flush=True)
                for line in back_res.lines:
                    safe = line.text.encode("ascii", "replace").decode("ascii")
                    print(f"   (conf: {line.confidence:.1f}%) [box: {line.box}] -> '{safe}'", flush=True)

        extracted, fields, warnings = extract_dni_data(front_res, back_res)
        print("\n>>> [MAPEO Y RESULTADOS DE EXTRACCIÓN]:", flush=True)
        for k in ['doc_number', 'paternal_surname', 'maternal_surname', 'first_names', 'birth_date', 'sex', 'civil_status', 'address', 'ubigeo']:
            fc = fields.get(k)
            if fc:
                safe_val = str(fc.value).encode("ascii", "replace").decode("ascii")
                safe_anchor = str(fc.anchor_matched).encode("ascii", "replace").decode("ascii") if fc.anchor_matched else "None"
                print(f"   * {k:18s}: valor='{safe_val}' | conf={fc.confidence:.1f}% | status={fc.status} | ancla='{safe_anchor}'", flush=True)
        print("="*80 + "\n", flush=True)

if __name__ == "__main__":
    run_targeted_test()
