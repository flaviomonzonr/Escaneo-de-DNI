import os
import sys
import time
import json
import numpy as np
import cv2

# Set path to project root
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, PROJECT_ROOT)

from backend.image_processing.multi_variant_pipeline import generate_multi_variants
from backend.image_processing.classifier import classify_document
from backend.ocr import get_ocr_engine
from backend.ocr.consensus_engine import ConsensusEngine
from backend.extractors.dni_extractor import extract_dni_data
from backend.extractors.ce_extractor import extract_ce_data
from backend.extractors.semantic_extractor import compute_mrz_check_digit


def generate_synthetic_image(doc_type: str, scenario: str) -> np.ndarray:
    """
    Generates a 100% synthetic Peruvian ID card with strictly fictitious data.
    doc_type: 'DNI_AZUL' | 'DNI_ELECTRONICO' | 'CARNET_EXTRANJERIA'
    scenario: 'clear' | 'cell_shadow' | 'blurry' | 'tilted' | 'glare' | 'low_res'
    """
    h, w = 640, 1014
    img = np.zeros((h, w, 3), dtype=np.uint8)

    if doc_type == "DNI_AZUL":
        # Classic Blue gradient & guilloche microtext
        for y in range(h):
            blue_val = int(225 + (y / h) * 25)
            img[y, :] = [blue_val, 215, 175]
        for y in range(0, h, 8):
            cv2.line(img, (0, y), (w, y), (210, 195, 160), 1)

        # Header banner
        cv2.rectangle(img, (0, 0), (w, 80), (180, 50, 40), -1)
        cv2.putText(img, "REPUBLICA DEL PERU", (180, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (255, 255, 255), 2)
        cv2.putText(img, "DOCUMENTO NACIONAL DE IDENTIDAD", (220, 68), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (240, 240, 240), 2)

        # Photo placeholder
        cv2.rectangle(img, (40, 110), (280, 460), (160, 160, 160), -1)
        cv2.putText(img, "FOTO", (120, 290), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)

        # DNI Number
        cv2.putText(img, "DNI: 70123456 - 1", (330, 140), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (20, 20, 20), 3)

        # Surnames & Names
        cv2.putText(img, "1ER APELLIDO", (330, 200), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (90, 90, 90), 2)
        cv2.putText(img, "RAMIREZ", (330, 235), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (20, 20, 20), 2)

        cv2.putText(img, "2DO APELLIDO", (330, 280), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (90, 90, 90), 2)
        cv2.putText(img, "FLORES", (330, 315), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (20, 20, 20), 2)

        cv2.putText(img, "PRENOMBRES", (330, 360), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (90, 90, 90), 2)
        cv2.putText(img, "CARLOS ALBERTO", (330, 395), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (20, 20, 20), 2)

        cv2.putText(img, "FECHA DE NACIMIENTO: 15/08/1992", (330, 450), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (20, 20, 20), 2)
        cv2.putText(img, "SEXO: M", (700, 450), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (20, 20, 20), 2)
        cv2.putText(img, "ESTADO CIVIL: S", (330, 490), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (20, 20, 20), 2)
        cv2.putText(img, "FECHA DE CADUCIDAD: 15/08/2030", (330, 530), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (20, 20, 20), 2)

    elif doc_type == "DNI_ELECTRONICO":
        # White / Light Cyan
        img[:] = [248, 248, 245]
        for y in range(0, h, 10):
            cv2.line(img, (0, y), (w, y), (235, 235, 230), 1)

        # Header banner
        cv2.rectangle(img, (0, 0), (w, 75), (140, 70, 30), -1)
        cv2.putText(img, "REPUBLICA DEL PERU", (180, 38), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (255, 255, 255), 2)
        cv2.putText(img, "DNI ELECTRONICO", (360, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (230, 230, 230), 2)

        # Photo
        cv2.rectangle(img, (40, 100), (280, 440), (170, 170, 170), -1)
        cv2.putText(img, "FOTO", (120, 280), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)

        # Text fields
        cv2.putText(img, "DNI: 71234567", (330, 130), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (10, 10, 10), 3)

        cv2.putText(img, "APELLIDOS", (330, 190), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (90, 90, 90), 2)
        cv2.putText(img, "MENDOZA CASTRO", (330, 225), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (10, 10, 10), 2)

        cv2.putText(img, "NOMBRES", (330, 275), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (90, 90, 90), 2)
        cv2.putText(img, "MARIA LUCIA", (330, 310), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (10, 10, 10), 2)

        cv2.putText(img, "NACIONALIDAD: PERUANA", (330, 360), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (10, 10, 10), 2)
        cv2.putText(img, "FECHA DE NACIMIENTO: 22/11/1995", (330, 400), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (10, 10, 10), 2)
        cv2.putText(img, "SEXO: F", (700, 400), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (10, 10, 10), 2)
        cv2.putText(img, "CADUCIDAD: 22/11/2033", (330, 440), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (10, 10, 10), 2)

        # TD1 MRZ block (3 lines x 30 chars with authentic check digits)
        # Line 1: I<PER71234567<5<<<<<<<<<<<<<<<
        # Line 2: 9511224F3311226PER<<<<<<<<<<<2
        # Line 3: MENDOZA<CASTRO<<MARIA<LUCIA<<<
        cv2.rectangle(img, (20, 490), (w - 20, h - 10), (240, 240, 240), -1)
        mrz_l1 = "I<PER71234567<5<<<<<<<<<<<<<<<"
        mrz_l2 = "9511224F3311226PER<<<<<<<<<<<2"
        mrz_l3 = "MENDOZA<CASTRO<<MARIA<LUCIA<<<"
        cv2.putText(img, mrz_l1, (30, 525), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (10, 10, 10), 2)
        cv2.putText(img, mrz_l2, (30, 565), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (10, 10, 10), 2)
        cv2.putText(img, mrz_l3, (30, 605), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (10, 10, 10), 2)

    elif doc_type == "CARNET_EXTRANJERIA":
        # Cyan / teal background
        img[:] = [225, 235, 210]
        for y in range(0, h, 10):
            cv2.line(img, (0, y), (w, y), (210, 220, 195), 1)

        # Header banner
        cv2.rectangle(img, (0, 0), (w, 80), (150, 100, 30), -1)
        cv2.putText(img, "REPUBLICA DEL PERU", (200, 35), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)
        cv2.putText(img, "CARNE DE EXTRANJERIA - MIGRACIONES", (150, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (230, 230, 230), 2)

        # Photo
        cv2.rectangle(img, (40, 100), (280, 440), (170, 170, 170), -1)
        cv2.putText(img, "FOTO", (120, 280), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)

        # Fields specific to CE
        cv2.putText(img, "NUMERO: 001234567", (330, 130), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (10, 10, 10), 3)

        cv2.putText(img, "CALIDAD MIGRATORIA", (330, 180), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (90, 90, 90), 2)
        cv2.putText(img, "TRABAJADOR RESIDENTE", (330, 210), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (10, 10, 10), 2)

        cv2.putText(img, "NACIONALIDAD", (330, 250), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (90, 90, 90), 2)
        cv2.putText(img, "COLOMBIANA", (330, 280), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (10, 10, 10), 2)

        cv2.putText(img, "APELLIDOS", (330, 320), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (90, 90, 90), 2)
        cv2.putText(img, "GOMEZ RESTREPO", (330, 350), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (10, 10, 10), 2)

        cv2.putText(img, "NOMBRES", (330, 390), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (90, 90, 90), 2)
        cv2.putText(img, "JUAN CAMILO", (330, 420), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (10, 10, 10), 2)

        cv2.putText(img, "NACIMIENTO: 10/03/1988", (330, 460), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (10, 10, 10), 2)
        cv2.putText(img, "SEXO: M", (680, 460), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (10, 10, 10), 2)
        cv2.putText(img, "CADUCIDAD: 10/03/2028", (330, 500), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (10, 10, 10), 2)
        cv2.putText(img, "DOMICILIO: AV. AREQUIPA 1520 LIMA", (330, 540), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (10, 10, 10), 2)

    # Apply scenario degradations
    if scenario == "cell_shadow":
        # Lighting gradient simulating hand / phone angle
        grad = np.linspace(0.4, 1.05, w).reshape(1, w, 1)
        img = (img * grad).clip(0, 255).astype(np.uint8)
    elif scenario == "blurry":
        # Gaussian blur
        img = cv2.GaussianBlur(img, (7, 7), 2.2)
    elif scenario == "tilted":
        # 6 degree rotation
        M = cv2.getRotationMatrix2D((w // 2, h // 2), 6.0, 1.0)
        img = cv2.warpAffine(img, M, (w, h), borderMode=cv2.BORDER_REPLICATE)
    elif scenario == "glare":
        # White specular flash circle
        cv2.circle(img, (720, 280), 90, (255, 255, 255), -1)
    elif scenario == "low_res":
        # Downsample and upsample back
        small = cv2.resize(img, (480, 300), interpolation=cv2.INTER_AREA)
        img = cv2.resize(small, (w, h), interpolation=cv2.INTER_LINEAR)

    return img


def run_benchmark(output_json: str = "tools/baseline_antes.json"):
    ocr_engine = get_ocr_engine()
    ocr_engine.warmup()
    consensus = ConsensusEngine(ocr_engine)

    doc_types = ["DNI_AZUL", "DNI_ELECTRONICO", "CARNET_EXTRANJERIA"]
    scenarios = ["clear", "cell_shadow", "blurry", "tilted", "glare", "low_res"]

    results = []
    by_type_stats = {dt: {"total_ms": [], "stages": {"prep": [], "ocr": [], "classif": [], "ext": []}, "fields": []} for dt in doc_types}

    print(f"=== INICIANDO BENCHMARK SINTÉTICO (18 CASOS: 3 TIPOS x 6 ESCENARIOS) ===")

    for dt in doc_types:
        for sc in scenarios:
            img = generate_synthetic_image(dt, sc)
            _, buf = cv2.imencode(".png", img)
            raw_bytes = buf.tobytes()

            t0 = time.perf_counter()

            # 1. Preprocessing
            t_prep0 = time.perf_counter()
            variants_res = generate_multi_variants(raw_bytes)
            t_prep = (time.perf_counter() - t_prep0) * 1000

            # 2. OCR Consensus
            t_ocr0 = time.perf_counter()
            consensus_res = consensus.run_multi_attempt_ocr(variants_res)
            t_ocr = (time.perf_counter() - t_ocr0) * 1000

            # 3. Document Classification
            t_class0 = time.perf_counter()
            classif = classify_document(
                image_bgr=variants_res.warped_bgr,
                ocr_text=consensus_res.primary_ocr.full_text,
                declared_type="AUTO",
            )
            t_class = (time.perf_counter() - t_class0) * 1000

            effective_doc_type = classif.doc_type

            # 4. Semantic Extraction
            t_ext0 = time.perf_counter()
            if effective_doc_type == "Carnet de Extranjería":
                extracted_dict, fields_dict, warnings = extract_ce_data(
                    front_ocr=consensus_res.primary_ocr,
                    back_ocr=None,
                    mrz_text=consensus_res.combined_mrz or "",
                    candidate_pools=consensus_res.candidate_pools,
                )
            else:
                extracted_dict, fields_dict, warnings = extract_dni_data(
                    front_ocr=consensus_res.primary_ocr,
                    back_ocr=None,
                    mrz_text=consensus_res.combined_mrz or "",
                    candidate_pools=consensus_res.candidate_pools,
                )
            t_ext = (time.perf_counter() - t_ext0) * 1000
            t_tot = (time.perf_counter() - t0) * 1000

            # Count correctly extracted non-empty fields
            extracted_fields = [k for k, v in extracted_dict.items() if v]

            case_data = {
                "doc_type": dt,
                "scenario": sc,
                "detected_type": effective_doc_type,
                "total_ms": round(t_tot, 1),
                "prep_ms": round(t_prep, 1),
                "ocr_ms": round(t_ocr, 1),
                "classif_ms": round(t_class, 1),
                "ext_ms": round(t_ext, 1),
                "extracted_fields_count": len(extracted_fields),
                "doc_number_extracted": bool(extracted_dict.get("doc_number")),
                "names_extracted": bool(extracted_dict.get("first_names") or extracted_dict.get("paternal_surname")),
                "birth_date_extracted": bool(extracted_dict.get("birth_date")),
                "expiry_date_extracted": bool(extracted_dict.get("expiry_date")),
                "address_or_ubigeo_extracted": bool(extracted_dict.get("address") or extracted_dict.get("ubigeo")),
                "migratory_status_extracted": bool(extracted_dict.get("migratory_status")),
                "mrz_validated": bool(fields_dict.get("doc_number") and fields_dict["doc_number"].origin_type == "LEIDO_MRZ_VALIDADO"),
            }
            results.append(case_data)

            by_type_stats[dt]["total_ms"].append(t_tot)
            by_type_stats[dt]["stages"]["prep"].append(t_prep)
            by_type_stats[dt]["stages"]["ocr"].append(t_ocr)
            by_type_stats[dt]["stages"]["classif"].append(t_class)
            by_type_stats[dt]["stages"]["ext"].append(t_ext)
            by_type_stats[dt]["fields"].append(len(extracted_fields))

            print(f"[{dt:18s} | {sc:11s}] -> Total: {t_tot:6.1f} ms (OCR: {t_ocr:6.1f} ms) | Tipo Detectado: {effective_doc_type} | Campos: {len(extracted_fields)}")

    # Summary table per document type
    summary = {}
    print("\n" + "="*80)
    print("RESUMEN DE LÍNEA BASE POR TIPO DE DOCUMENTO")
    print("="*80)
    for dt, data in by_type_stats.items():
        arr_tot = np.array(data["total_ms"])
        med_tot = float(np.median(arr_tot))
        p95_tot = float(np.percentile(arr_tot, 95))
        avg_fields = float(np.mean(data["fields"]))

        med_prep = float(np.median(data["stages"]["prep"]))
        med_ocr = float(np.median(data["stages"]["ocr"]))
        med_classif = float(np.median(data["stages"]["classif"]))
        med_ext = float(np.median(data["stages"]["ext"]))

        summary[dt] = {
            "median_total_ms": round(med_tot, 1),
            "p95_total_ms": round(p95_tot, 1),
            "median_prep_ms": round(med_prep, 1),
            "median_ocr_ms": round(med_ocr, 1),
            "median_classif_ms": round(med_classif, 1),
            "median_ext_ms": round(med_ext, 1),
            "avg_fields_extracted": round(avg_fields, 1),
        }
        print(f"Tipo: {dt:20s} | Mediana: {med_tot:6.1f} ms | p95: {p95_tot:6.1f} ms | OCR: {med_ocr:6.1f} ms | Campos Promedio: {avg_fields:.1f}")

    output_payload = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "summary_by_type": summary,
        "cases": results,
    }

    os.makedirs(os.path.dirname(output_json), exist_ok=True)
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(output_payload, f, indent=2, ensure_ascii=False)

    print(f"\nResultados guardados exitosamente en: {output_json}")
    return output_payload


if __name__ == "__main__":
    run_benchmark()

