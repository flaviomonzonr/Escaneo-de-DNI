import os
import sys
import glob
import cv2

sys.path.insert(0, os.path.abspath(".."))
from backend.ocr.rapid_engine import RapidOCREngine
from backend.extractors.dni_extractor import extract_dni_data

def run_debug_clean():
    engine = RapidOCREngine()
    files = glob.glob("../DNIS/*.jpeg") + glob.glob("../DNIS/*.jpg")
    print(f"Total test files in DNIS: {len(files)}")

    # Test distinct single and multi DNI samples
    test_files = [
        "../DNIS/CamScanner 01-03-2022 15.10_144.jpg",
        "../DNIS/WhatsApp Image 2026-09-14 at 11.18.00 PM.jpeg",
        "../DNIS/WhatsApp Image 2026-09-14 at 11.18.02 PM.jpeg",
        "../DNIS/WhatsApp Image 2026-09-14 at 11.18.13 PM.jpeg",
        "../DNIS/WhatsApp Image 2026-09-14 at 11.19.14 PM.jpeg",
    ]
    
    # Also find if there are back images in uploads
    back_files = glob.glob("../uploads/*_back_enhanced.jpg") + glob.glob("../uploads/*_back_orig.jpg")
    if back_files:
        test_files.extend(back_files[:3])

    for img_path in test_files:
        if not os.path.exists(img_path):
            continue
        print("\n" + "="*85)
        print(f"FILE: {os.path.basename(img_path)}")
        img = cv2.imread(img_path)
        if img is None:
            print("Could not load image")
            continue
        
        ocr_res = engine.extract(img)
        print("--- [OCR RAW LINES] ---")
        for idx, l in enumerate(ocr_res.lines):
            safe_text = l.text.encode('ascii', errors='replace').decode('ascii')
            print(f"[{idx:02d}] (conf: {l.confidence:.1f}%) box: {l.box} -> '{safe_text}'")
        
        extracted, fields, warnings = extract_dni_data(ocr_res)
        print("--- [EXTRACTED FIELDS & ANCHORS] ---")
        for k in ['doc_number', 'paternal_surname', 'maternal_surname', 'first_names', 'birth_date', 'sex', 'civil_status', 'address', 'ubigeo']:
            fc = fields.get(k)
            if fc:
                safe_val = str(fc.value).encode('ascii', errors='replace').decode('ascii')
                safe_anchor = str(fc.anchor_matched).encode('ascii', errors='replace').decode('ascii') if fc.anchor_matched else "None"
                print(f"{k:18s}: val='{safe_val}' | conf={fc.confidence:.1f}% | status={fc.status} | anchor='{safe_anchor}'")

if __name__ == "__main__":
    run_debug_clean()
