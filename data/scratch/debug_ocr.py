import os
import sys
import glob
import cv2

sys.path.insert(0, os.path.abspath(".."))
from backend.ocr.rapid_engine import RapidOCREngine
from backend.extractors.dni_extractor import extract_dni_data

def run_debug():
    engine = RapidOCREngine()
    files = glob.glob("../DNIS/*.jpeg") + glob.glob("../DNIS/*.jpg")
    print(f"Total test files in DNIS: {len(files)}")

    for img_path in files[:10]:
        print("="*80)
        print(f"FILE: {os.path.basename(img_path)}")
        img = cv2.imread(img_path)
        if img is None:
            print("Could not load image")
            continue
        
        ocr_res = engine.extract(img)
        print("\n--- [1] RAW OCR FULL TEXT ---")
        print(ocr_res.full_text)
        
        print("\n--- [2] OCR LINES (CONFIDENCE & TEXT) ---")
        for idx, l in enumerate(ocr_res.lines):
            print(f"[{idx:02d}] (conf: {l.confidence:.1f}%) -> '{l.text}'")
        
        extracted, fields, warnings = extract_dni_data(ocr_res)
        print("\n--- [3] EXTRACTED FIELDS ---")
        for k in ['doc_number', 'paternal_surname', 'maternal_surname', 'first_names', 'birth_date', 'sex', 'civil_status', 'address', 'ubigeo']:
            fc = fields.get(k)
            if fc:
                print(f"{k:18s}: val='{fc.value}' | conf={fc.confidence:.1f}% | status={fc.status} | anchor='{fc.anchor_matched}'")
        print("="*80 + "\n")

if __name__ == "__main__":
    run_debug()
