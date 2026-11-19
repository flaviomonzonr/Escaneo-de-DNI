import re
import cv2
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from backend.ocr.base import BaseOCREngine, OCRResult, OCRLine, OCRWord
from backend.image_processing.multi_variant_pipeline import MultiVariantResult, ImageVariant


@dataclass
class VariantOCRPass:
    variant_name: str
    description: str
    ocr_result: OCRResult
    mrz_text: str = ""
    quality_score: float = 0.0
    line_count: int = 0
    word_count: int = 0
    avg_confidence: float = 0.0


@dataclass
class MultiVariantConsensusResult:
    primary_ocr: OCRResult
    combined_mrz: str
    passes: List[VariantOCRPass] = field(default_factory=list)
    consensus_agreements: Dict[str, float] = field(default_factory=dict)
    candidate_pools: Dict[str, List[Tuple[str, float, str]]] = field(default_factory=dict)  # field -> [(value, weight, variant_name)]
    total_variants_run: int = 0
    best_variant_name: str = "clahe_enhanced"
    consensus_summary: str = ""


# Common OCR character confusion maps
DIGIT_FROM_CHAR_MAP = {
    "O": "0", "o": "0", "D": "0", "Q": "0",
    "I": "1", "i": "1", "l": "1", "L": "1", "|": "1", "!": "1",
    "Z": "2", "z": "2",
    "E": "3",
    "A": "4",
    "S": "5", "s": "5",
    "G": "6", "b": "6",
    "T": "7",
    "B": "8",
    "g": "9", "q": "9",
}

CHAR_FROM_DIGIT_MAP = {
    "0": "O",
    "1": "I",
    "2": "Z",
    "3": "E",
    "4": "A",
    "5": "S",
    "6": "G",
    "7": "T",
    "8": "B",
    "9": "G",
}


def normalize_numeric_ocr(text: str) -> str:
    """Normalizes OCR misreads in strictly numeric strings (e.g. DNI, dates, ubigeo)."""
    res = []
    for ch in text.strip():
        if ch.isdigit():
            res.append(ch)
        elif ch in DIGIT_FROM_CHAR_MAP:
            res.append(DIGIT_FROM_CHAR_MAP[ch])
    return "".join(res)


def normalize_alpha_ocr(text: str) -> str:
    """Normalizes OCR digit misreads in strictly alphabetic name strings."""
    res = []
    for ch in text.strip().upper():
        if ch.isalpha() or ch in " -'":
            res.append(ch)
        elif ch in CHAR_FROM_DIGIT_MAP:
            res.append(CHAR_FROM_DIGIT_MAP[ch])
    return "".join(res)


class ConsensusEngine:
    """
    Executes multi-attempt OCR across up to 6 specialized OpenCV preprocessed variants.
    Performs field-by-field candidate pool collection, voting, and consensus validation.
    """

    def __init__(self, ocr_engine: BaseOCREngine):
        self.ocr_engine = ocr_engine

    def run_multi_attempt_ocr(
        self,
        variant_result: MultiVariantResult,
        max_variants_to_run: int = 6,
    ) -> MultiVariantConsensusResult:
        """
        Executes OCR on all generated image variants and merges results with consensus scoring.
        """
        passes: List[VariantOCRPass] = []
        mrz_fragments: List[str] = []
        seen_mrz_lines = set()
        found_mrz = False

        # Fast Adaptive Tiered Strategy:
        # Tier 1: Process the natural perspective-corrected card (warped_bgr)
        # Neural OCR models (RapidOCR/Paddle) perform best on natural color & contrast without CLAHE noise.
        if variant_result.warped_bgr is not None:
            primary_variant = ImageVariant(
                name="warped_bgr",
                description="Imagen Enderezada Original",
                image=variant_result.warped_bgr,
                quality_score=variant_result.laplacian_variance,
            )
        else:
            primary_variant = variant_result.variants.get("clahe_enhanced")
            if not primary_variant:
                all_vars = list(variant_result.variants.values())
                primary_variant = all_vars[0]

        try:
            ocr_res1 = self.ocr_engine.extract(primary_variant.image)
        except Exception:
            ocr_res1 = None

        if ocr_res1:
            # Check for authentic MRZ lines (must have real TD1 signature or multiple '<' delimiters)
            for line in ocr_res1.lines:
                t_raw = line.text.strip().upper()
                t_clean = t_raw.replace(" ", "")
                is_mrz_line = (
                    bool(re.search(r"(?:[I1]<PER|[I1]DPER|<PER|PER[0-9A-Z]{8}|[I1]<[0-9A-Z]{8})", t_clean))
                    or bool(re.search(r"[0-9A-Z]{6}<*[0-9A-Z<]?[MF<].*PER", t_clean))
                    or ("<<" in t_clean and len(t_clean) >= 10 and not any(kw in t_clean for kw in ["REPUBLICA", "NACIONAL"]))
                    or (t_clean.count("<") >= 2 and len(t_clean) >= 12 and any(c.isdigit() for c in t_clean))
                )
                if is_mrz_line:
                    if t_clean not in seen_mrz_lines:
                        mrz_fragments.append(t_raw)
                        seen_mrz_lines.add(t_clean)
                        found_mrz = True

            # If document appears to have genuine MRZ but we have < 3 lines, perform a targeted bottom-strip pass
            if found_mrz and len(mrz_fragments) < 3:
                try:
                    img_h, img_w = primary_variant.image.shape[:2]
                    if img_h > 120 and img_w > 180:
                        mrz_crop = primary_variant.image[int(img_h * 0.64):img_h, 0:img_w]
                        crop_ocr = self.ocr_engine.extract(mrz_crop)
                        for c_line in crop_ocr.lines:
                            c_raw = c_line.text.strip().upper()
                            c_clean = c_raw.replace(" ", "")
                            if (c_clean.count("<") >= 1 or "PER" in c_clean or "<<" in c_clean) and len(c_clean) >= 8:
                                if c_clean not in seen_mrz_lines:
                                    mrz_fragments.append(c_raw)
                                    seen_mrz_lines.add(c_clean)
                except Exception:
                    pass

            passes.append(VariantOCRPass(
                variant_name=primary_variant.name,
                description=primary_variant.description,
                ocr_result=ocr_res1,
                mrz_text="\n".join(mrz_fragments),
                quality_score=primary_variant.quality_score,
                line_count=len(ocr_res1.lines),
                word_count=len(ocr_res1.words),
                avg_confidence=ocr_res1.average_confidence,
            ))

        # Check if Tier 1 gave us high-confidence complete readings
        has_dni_candidate = False
        has_ce_candidate = False
        if ocr_res1:
            has_dni_candidate = any(re.search(r"\b[0-9OIlLSZB]{8}\b", l.text.upper()) for l in ocr_res1.lines)
            has_ce_candidate = (
                any(re.search(r"\b[0-9]{9}\b", l.text) for l in ocr_res1.lines)
                or any("EXTRANJER" in l.text.upper() or "MIGRAC" in l.text.upper() for l in ocr_res1.lines)
            )

        tier1_satisfactory = (
            ocr_res1 is not None
            and (has_dni_candidate or has_ce_candidate or found_mrz)
            and (ocr_res1.average_confidence >= 65.0 or len(ocr_res1.words) >= 6)
        )

        # Tier 2: Targeted Retry ONLY IF Tier 1 was inconclusive and image defect justifies it
        if not tier1_satisfactory and max_variants_to_run > 1:
            # Pick the best specialized secondary variant for the defect
            secondary_name = "shadow_free" if variant_result.has_shadows else "adaptive_thresh"
            secondary_variant = variant_result.variants.get(secondary_name)
            if not secondary_variant and secondary_name == "shadow_free":
                secondary_variant = variant_result.variants.get("adaptive_thresh")

            if secondary_variant and secondary_variant.name != primary_variant.name:
                try:
                    ocr_res2 = self.ocr_engine.extract(secondary_variant.image)
                    if ocr_res2 and (len(ocr_res2.lines) > 0 or ocr_res2.average_confidence > 0):
                        passes.append(VariantOCRPass(
                            variant_name=secondary_variant.name,
                            description=secondary_variant.description,
                            ocr_result=ocr_res2,
                            mrz_text="",
                            quality_score=secondary_variant.quality_score,
                            line_count=len(ocr_res2.lines),
                            word_count=len(ocr_res2.words),
                            avg_confidence=ocr_res2.average_confidence,
                        ))
                except Exception:
                    pass


        if not passes:
            # Fallback if all attempts failed
            empty_ocr = OCRResult(full_text="", lines=[], words=[], average_confidence=0.0)
            return MultiVariantConsensusResult(
                primary_ocr=empty_ocr,
                combined_mrz="",
                passes=[],
                total_variants_run=0,
                best_variant_name="none",
                consensus_summary="No se obtuvieron resultados en ninguna variante."
            )

        # Select primary OCR pass: highest composite of word count and confidence
        def score_pass(p: VariantOCRPass) -> float:
            base_score = (p.word_count * 2.0) + (p.avg_confidence * 1.5)
            if p.variant_name == "clahe_enhanced":
                base_score += 15.0  # Prefer CLAHE if results are comparable
            return base_score

        best_pass = max(passes, key=score_pass)

        # Synthesize combined MRZ text prioritizing TD1 format
        combined_mrz_str = "\n".join(mrz_fragments)

        # Aggregate candidate pools for cross-pass voting
        candidate_pools: Dict[str, List[Tuple[str, float, str]]] = {
            "dni_candidates": [],
            "names_candidates": [],
            "surnames_candidates": [],
            "dates_candidates": [],
            "ubigeo_candidates": [],
        }

        for p in passes:
            pass_weight = max(1.0, p.avg_confidence / 20.0)
            # Find DNI candidates (8 digits)
            for line in p.ocr_result.lines:
                t = line.text.upper()
                # Skip lines clearly labeled as dates or voting groups
                if any(sk in t for sk in ["FECHA", "EMISION", "EMISIÓN", "CADUCIDAD", "VENCIMIENTO", "NACIMIENTO", "INSCRIPCION", "INSCRIPCIÓN", "VOTACION", "GRUPO", "MESA"]):
                    continue
                # 8 digit candidates (including with check digit like 70682625-0)
                matches = re.finditer(r"\b([0-9OIlLSZB]{8})(?:[.\-]\d)?\b", t)
                for m in matches:
                    raw_val = m.group(1)
                    norm_val = normalize_numeric_ocr(raw_val)
                    if len(norm_val) == 8 and norm_val.isdigit():
                        # Exclude obvious calendar dates DDMMYYYY
                        d_val, m_val, y_val = int(norm_val[:2]), int(norm_val[2:4]), int(norm_val[4:])
                        if 1 <= d_val <= 31 and 1 <= m_val <= 12 and (1930 <= y_val <= 2040):
                            continue
                        weight = pass_weight * line.confidence
                        if any(kw in t for kw in ["DNI", "CUI", "DOCUMENTO", "TARJETA", "NRO", "N°", "Nº"]):
                            weight += 35.0
                        candidate_pools["dni_candidates"].append((norm_val, weight, p.variant_name))

        # Consensus summary
        total_runs = len(passes)
        consensus_summary = f"{total_runs} variantes procesadas con éxito. Variante primaria seleccionada: '{best_pass.description}'."

        return MultiVariantConsensusResult(
            primary_ocr=best_pass.ocr_result,
            combined_mrz=combined_mrz_str,
            passes=passes,
            candidate_pools=candidate_pools,
            total_variants_run=total_runs,
            best_variant_name=best_pass.variant_name,
            consensus_summary=consensus_summary,
        )


def evaluate_field_consensus(
    extracted_val: str,
    candidates: List[Tuple[str, float, str]],
    is_numeric: bool = False,
) -> Tuple[str, float, int, int]:
    """
    Evaluates candidate consensus across multiple passes:
    Returns (winner_value, confidence_boosted, votes_won, total_votes).
    """
    if not candidates:
        return extracted_val, 75.0, 1, 1

    # Group and accumulate weights
    vote_weights: Dict[str, float] = {}
    vote_counts: Dict[str, int] = {}
    total_votes = len(candidates)

    for val, weight, _ in candidates:
        norm_val = normalize_numeric_ocr(val) if is_numeric else val.strip().upper()
        if not norm_val:
            continue
        vote_weights[norm_val] = vote_weights.get(norm_val, 0.0) + weight
        vote_counts[norm_val] = vote_counts.get(norm_val, 0) + 1

    if not vote_weights:
        return extracted_val, 70.0, 1, 1

    winner_val = max(vote_weights, key=vote_weights.get)
    winner_votes = vote_counts[winner_val]
    agreement_ratio = winner_votes / total_votes

    # Confidence calculation based on multi-attempt agreement
    base_conf = min(99.0, 60.0 + (agreement_ratio * 35.0) + (winner_votes * 3.0))

    return winner_val, round(base_conf, 1), winner_votes, total_votes
