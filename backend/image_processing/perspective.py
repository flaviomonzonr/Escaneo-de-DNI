import cv2
import numpy as np
from typing import Tuple, Optional, List


def order_points(pts: np.ndarray) -> np.ndarray:
    """
    Orders 4 coordinate points in standard clockwise order:
    0: top-left, 1: top-right, 2: bottom-right, 3: bottom-left.
    """
    rect = np.zeros((4, 2), dtype="float32")
    pts = np.asarray(pts, dtype="float32").reshape((4, 2))

    # Sum of coordinates: top-left has smallest sum, bottom-right has largest sum
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]

    # Difference of coordinates: top-right has smallest diff (x - y), bottom-left has largest diff
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]

    return rect


def score_quadrilateral(pts: np.ndarray, total_area: float, img_w: int, img_h: int) -> float:
    """
    Calculates a quality score (0 to 1000+) for a candidate 4-point card quadrilateral.
    Evaluates:
    - Closeness to standard ID-1 aspect ratio (~1.586 landscape or ~0.63 portrait)
    - Total area relative to image (cards usually take 10% to 90% of frame)
    - Convexity and angle normality (near 90 degree corners)
    - Central positioning prior
    """
    ordered = order_points(pts)
    (tl, tr, br, bl) = ordered

    width_top = float(np.linalg.norm(tr - tl))
    width_bot = float(np.linalg.norm(br - bl))
    height_left = float(np.linalg.norm(bl - tl))
    height_right = float(np.linalg.norm(br - tr))

    max_w = max(width_top, width_bot)
    min_w = min(width_top, width_bot)
    max_h = max(height_left, height_right)
    min_h = min(height_left, height_right)

    if max_w < 20 or max_h < 20 or min_w < 10 or min_h < 10:
        return -1.0

    # Trapezoid distortion penalty (parallel sides should be somewhat similar)
    w_ratio = min_w / max(1.0, max_w)
    h_ratio = min_h / max(1.0, max_h)
    if w_ratio < 0.55 or h_ratio < 0.55:
        return -1.0

    avg_w = (width_top + width_bot) / 2.0
    avg_h = (height_left + height_right) / 2.0
    aspect = max(avg_w, avg_h) / max(1.0, min(avg_w, avg_h))

    # ID-1 standard ratio is 85.60 / 53.98 = 1.5858
    ideal_ratio = 1.5858
    if not (1.15 <= aspect <= 2.20):
        return -1.0

    ratio_diff = abs(aspect - ideal_ratio)
    ratio_score = 1.0 / (1.0 + (ratio_diff * 2.5))

    # Area score
    card_area = cv2.contourArea(ordered.astype(np.int32))
    area_fraction = card_area / max(1.0, total_area)
    if area_fraction < 0.05 or area_fraction > 0.98:
        return -1.0

    # Prefer cards that take a reasonable fraction of the view (30% to 85%)
    if 0.20 <= area_fraction <= 0.90:
        area_score = 1.2
    else:
        area_score = 0.8

    # Central proximity bonus
    center_card = np.mean(ordered, axis=0)
    center_img = np.array([img_w / 2.0, img_h / 2.0])
    dist_to_center = float(np.linalg.norm(center_card - center_img))
    diag = float(np.hypot(img_w, img_h))
    center_score = 1.0 - (dist_to_center / max(1.0, diag))

    final_score = (card_area ** 0.5) * ratio_score * area_score * (1.0 + 0.5 * center_score) * (w_ratio * h_ratio)
    return float(final_score)


def find_document_contour(image: np.ndarray) -> Optional[np.ndarray]:
    """
    Advanced Multi-Strategy Peruvian ID Document & Card Contour Detector.
    Robust against:
    - Fingers/hands holding the edges (uses Convex Hull & Corner Quadrilateral Recovery)
    - Complex background clutter (rooms, ceilings, desks, clothes)
    - Tilted angles and variable illumination
    - DNI Azul, DNI Electrónico (white/cyan) and Carnet de Extranjería
    """
    if image is None or image.size == 0:
        return None

    h_orig, w_orig = image.shape[:2]
    
    # Work on an optimal resolution for fast & accurate edge/contour analysis (max 960px)
    max_dim = max(h_orig, w_orig)
    scale = 1.0
    if max_dim > 960:
        scale = 960.0 / max_dim
        small_img = cv2.resize(image, (int(w_orig * scale), int(h_orig * scale)), interpolation=cv2.INTER_AREA)
    else:
        small_img = image.copy()

    h, w = small_img.shape[:2]
    total_area = float(h * w)
    min_card_area = total_area * 0.05
    max_card_area = total_area * 0.98

    candidates: List[Tuple[float, np.ndarray]] = []

    gray = cv2.cvtColor(small_img, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(small_img, cv2.COLOR_BGR2HSV)
    lab = cv2.cvtColor(small_img, cv2.COLOR_BGR2LAB)

    # -------------------------------------------------------------
    # STRATEGY A: Multi-Threshold Edge Detection with Morphological Hull
    # -------------------------------------------------------------
    edge_maps = []
    
    # 1. Bilateral filter + Canny (sharp edges, suppressed texture)
    bilateral = cv2.bilateralFilter(gray, 7, 60, 60)
    edge_maps.append(cv2.Canny(bilateral, 35, 120))
    edge_maps.append(cv2.Canny(bilateral, 50, 180))

    # 2. Gaussian Blur + Otsu Threshold edges
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, otsu = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    edge_maps.append(cv2.Canny(otsu, 50, 150))

    # 3. Morphological Gradient (strong boundary contrast)
    kernel_grad = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    morph_grad = cv2.morphologyEx(gray, cv2.MORPH_GRADIENT, kernel_grad)
    _, grad_thresh = cv2.threshold(morph_grad, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    edge_maps.append(grad_thresh)

    # -------------------------------------------------------------
    # STRATEGY B: Color / Saturation Card Masking (DNI Azul & DNIe & CE)
    # -------------------------------------------------------------
    # DNI Azul has cyan/blue background and white body; DNIe has high L in LAB / low saturation in HSV
    # Mask non-skin / document body
    # Skin tone mask in HSV: H: 0-25 or 160-180, S: 30-200
    skin_mask1 = cv2.inRange(hsv, np.array([0, 28, 50]), np.array([25, 255, 255]))
    skin_mask2 = cv2.inRange(hsv, np.array([160, 28, 50]), np.array([180, 255, 255]))
    skin_mask = skin_mask1 | skin_mask2

    # High brightness card body (DNIe / DNI background)
    card_bright = cv2.inRange(lab, np.array([110, 110, 110]), np.array([255, 145, 150]))
    # Card blue/cyan tone (DNI Azul / CE)
    card_blue = cv2.inRange(hsv, np.array([80, 30, 60]), np.array([140, 255, 255]))

    color_card_mask = (card_bright | card_blue) & (~skin_mask)
    edge_maps.append(color_card_mask)

    # -------------------------------------------------------------
    # CONTOUR EVALUATION LOOP
    # -------------------------------------------------------------
    morph_kernels = [
        cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)),
        cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7)),
        cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9)),
    ]

    for edge in edge_maps:
        for k in morph_kernels:
            closed = cv2.morphologyEx(edge, cv2.MORPH_CLOSE, k, iterations=2)
            dilated = cv2.dilate(closed, k, iterations=1)

            contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not contours:
                contours, _ = cv2.findContours(dilated, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

            for cnt in contours:
                area = cv2.contourArea(cnt)
                if area < min_card_area or area > max_card_area:
                    continue

                # Technique 1: Direct Polygon Approx
                peri = cv2.arcLength(cnt, True)
                approx = cv2.approxPolyDP(cnt, 0.025 * peri, True)
                if len(approx) == 4 and cv2.isContourConvex(approx):
                    pts = approx.reshape(4, 2).astype("float32")
                    sc = score_quadrilateral(pts, total_area, w, h)
                    if sc > 0:
                        candidates.append((sc, pts))

                # Technique 2: Convex Hull + Polygon Approx (vital when fingers break the edges)
                hull = cv2.convexHull(cnt)
                hull_area = cv2.contourArea(hull)
                if min_card_area <= hull_area <= max_card_area:
                    hull_peri = cv2.arcLength(hull, True)
                    hull_approx = cv2.approxPolyDP(hull, 0.028 * hull_peri, True)
                    if len(hull_approx) == 4 and cv2.isContourConvex(hull_approx):
                        pts = hull_approx.reshape(4, 2).astype("float32")
                        sc = score_quadrilateral(pts, total_area, w, h)
                        if sc > 0:
                            candidates.append((sc * 1.1, pts))

                # Technique 3: Minimum Area Rotated Bounding Box
                rect = cv2.minAreaRect(cnt)
                box = cv2.boxPoints(rect).astype("float32")
                box_area = cv2.contourArea(box)
                if abs(area - box_area) / max(1.0, box_area) < 0.40:
                    sc = score_quadrilateral(box, total_area, w, h)
                    if sc > 0:
                        candidates.append((sc * 0.95, box))

    # -------------------------------------------------------------
    # STRATEGY C: Saliency / Text & Feature Density Region of Interest
    # -------------------------------------------------------------
    # When all edge loops fail to find a 4-point polygon, extract central high-contrast feature bounding box
    if not candidates:
        sobel_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
        sobel_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
        grad_mag = cv2.magnitude(sobel_x, sobel_y)
        grad_norm = cv2.normalize(grad_mag, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)

        # Focus on text/photo density by large morphological blur
        k_dense = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 25))
        dense_mask = cv2.morphologyEx(grad_norm, cv2.MORPH_CLOSE, k_dense)
        _, dense_thresh = cv2.threshold(dense_mask, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        contours_dense, _ = cv2.findContours(dense_thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in contours_dense:
            area = cv2.contourArea(cnt)
            if area >= min_card_area:
                hull = cv2.convexHull(cnt)
                rect = cv2.minAreaRect(hull)
                box = cv2.boxPoints(rect).astype("float32")
                sc = score_quadrilateral(box, total_area, w, h)
                if sc > 0:
                    candidates.append((sc * 0.8, box))

    # If no candidate passed strict criteria, try central card prior
    if not candidates:
        # Check if center region has card-like presence
        cx, cy = w // 2, h // 2
        crop_w = int(w * 0.82)
        crop_h = int(crop_w / 1.5858)
        if crop_h > int(h * 0.90):
            crop_h = int(h * 0.82)
            crop_w = int(crop_h * 1.5858)

        x1 = max(0, cx - crop_w // 2)
        y1 = max(0, cy - crop_h // 2)
        x2 = min(w, x1 + crop_w)
        y2 = min(h, y1 + crop_h)

        fallback_box = np.array([
            [x1, y1],
            [x2, y1],
            [x2, y2],
            [x1, y2]
        ], dtype="float32")
        candidates.append((10.0, fallback_box))

    # Pick the candidate with the highest quality score
    candidates.sort(key=lambda x: x[0], reverse=True)
    best_pts = candidates[0][1]

    # Rescale points back to original image coordinates
    if scale != 1.0:
        best_pts = (best_pts / scale).astype("float32")

    return best_pts


def auto_crop_margins(image: np.ndarray, tolerance: int = 25) -> np.ndarray:
    """
    Fallback margin cropper: removes uniform outer borders (scanner glass white/black margins)
    if no perspective polygon could be identified.
    """
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Check border pixels
    top_edge = np.median(gray[0:max(3, int(h * 0.02)), :])
    bottom_edge = np.median(gray[min(h - 1, int(h * 0.98)):h, :])
    left_edge = np.median(gray[:, 0:max(3, int(w * 0.02))])
    right_edge = np.median(gray[:, min(w - 1, int(w * 0.98)):w])

    avg_border = (top_edge + bottom_edge + left_edge + right_edge) / 4.0
    
    diff = np.abs(gray.astype("float32") - avg_border)
    mask = (diff > tolerance).astype(np.uint8) * 255
    
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
    mask_closed = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=3)
    
    contours, _ = cv2.findContours(mask_closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        largest = max(contours, key=cv2.contourArea)
        if cv2.contourArea(largest) > (h * w * 0.15):
            x, y, cw, ch = cv2.boundingRect(largest)
            pad_x = int(cw * 0.01)
            pad_y = int(ch * 0.01)
            x1 = max(0, x + pad_x)
            y1 = max(0, y + pad_y)
            x2 = min(w, x + cw - pad_x)
            y2 = min(h, y + ch - pad_y)
            if (x2 - x1) > 100 and (y2 - y1) > 60:
                return image[y1:y2, x1:x2]

    return image


def detect_and_warp_card(
    image: np.ndarray,
    target_width: int = 1200,
    target_height: int = 760
) -> Tuple[np.ndarray, bool]:
    """
    Locates the DNI card's 4 corners, completely crops out any surrounding background/hands,
    and warps to a canonical ID-1 card size (1200x760 px, aspect ratio 1.5858).
    Returns: (warped_clean_card_image, perspective_corrected_bool)
    """
    if image is None or image.size == 0:
        raise ValueError("Imagen vacía recibida en detect_and_warp_card.")

    card_pts = find_document_contour(image)

    if card_pts is None:
        cropped = auto_crop_margins(image)
        h, w = cropped.shape[:2]
        if w < 900 or h < 550:
            scale = max(target_width / max(1, w), target_height / max(1, h))
            cropped = cv2.resize(cropped, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)
        return cropped, False

    ordered_pts = order_points(card_pts)
    (tl, tr, br, bl) = ordered_pts

    # Determine whether document is oriented landscape or portrait
    width_top = np.linalg.norm(tr - tl)
    width_bot = np.linalg.norm(br - bl)
    max_w = max(float(width_top), float(width_bot))

    height_left = np.linalg.norm(bl - tl)
    height_right = np.linalg.norm(br - tr)
    max_h = max(float(height_left), float(height_right))

    # Apply a 1.2% safety inset on corners to eliminate any outside edge borders, shadows or finger edges
    center = np.mean(ordered_pts, axis=0)
    ordered_pts_inset = ordered_pts + 0.012 * (center - ordered_pts)

    # Ensure points stay within image boundaries
    h_img, w_img = image.shape[:2]
    ordered_pts_inset[:, 0] = np.clip(ordered_pts_inset[:, 0], 0, w_img - 1)
    ordered_pts_inset[:, 1] = np.clip(ordered_pts_inset[:, 1], 0, h_img - 1)

    # If oriented vertically in image, adjust target dimensions accordingly then rotate to landscape
    if max_h > max_w:
        dst_pts = np.array([
            [0, 0],
            [target_height - 1, 0],
            [target_height - 1, target_width - 1],
            [0, target_width - 1]
        ], dtype="float32")
        matrix = cv2.getPerspectiveTransform(ordered_pts_inset.astype("float32"), dst_pts)
        warped = cv2.warpPerspective(image, matrix, (target_height, target_width), flags=cv2.INTER_CUBIC)
        # Rotate 90 degrees clockwise to standard landscape orientation
        warped = cv2.rotate(warped, cv2.ROTATE_90_CLOCKWISE)
    else:
        dst_pts = np.array([
            [0, 0],
            [target_width - 1, 0],
            [target_width - 1, target_height - 1],
            [0, target_height - 1]
        ], dtype="float32")
        matrix = cv2.getPerspectiveTransform(ordered_pts_inset.astype("float32"), dst_pts)
        warped = cv2.warpPerspective(image, matrix, (target_width, target_height), flags=cv2.INTER_CUBIC)

    return warped, True
