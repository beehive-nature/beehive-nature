"""Trace the supplied original raster cells, without reconstructing regular hexagons.

Requires Pillow and NumPy only. Run with the bundled Python runtime. Writes only
source/cells.json and source/trace-overlay.png beside this script. Pixel edges
come from four-connected foreground components. Reference contours retain at
least 99% per-cell mask overlap; separate model_contour geometry has a one-pixel
RDP deviation budget and independently reported overlap, with no side-count rule.
"""
import argparse
from collections import defaultdict
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
DEFAULT_SOURCE = HERE / 'source' / 'originals' / 'teal_BN_logo_transparent.png'


def foreground(rgba, threshold):
    rgb = rgba[:, :, :3].astype(np.float64)
    # Dominant authored teal, sampled from this original. Projection estimates
    # coverage against its black gutters; the supplied alpha is binary and also
    # includes dark antialias/JPEG-edge pixels, so alpha alone overfills cells.
    teal = np.array([37., 170., 227.])
    coverage = rgb @ teal / (teal @ teal)
    return ((coverage >= threshold) & (rgba[:, :, 3] > 0) &
            (rgb[:, :, 2] - rgb[:, :, 0] > 40) &
            (rgb[:, :, 1] - rgb[:, :, 0] > 30))


def components(mask):
    padded = np.pad(mask, 1)
    stride = padded.shape[1]
    remaining = bytearray(padded.ravel())
    found = []
    for start in range(len(remaining)):
        if not remaining[start]:
            continue
        remaining[start] = 0
        stack, pixels = [start], []
        while stack:
            p = stack.pop()
            pixels.append((p % stride - 1, p // stride - 1))
            for q in (p - 1, p + 1, p - stride, p + stride):
                if remaining[q]:
                    remaining[q] = 0
                    stack.append(q)
        found.append(pixels)
    return found


def signed_area(poly):
    return sum(a[0] * b[1] - b[0] * a[1]
               for a, b in zip(poly, poly[1:] + poly[:1])) / 2


def pixel_loops(pixels):
    occupied = set(pixels)
    edges = defaultdict(list)
    for x, y in pixels:
        if (x, y - 1) not in occupied:
            edges[(x, y)].append((x + 1, y))
        if (x + 1, y) not in occupied:
            edges[(x + 1, y)].append((x + 1, y + 1))
        if (x, y + 1) not in occupied:
            edges[(x + 1, y + 1)].append((x, y + 1))
        if (x - 1, y) not in occupied:
            edges[(x, y + 1)].append((x, y))
    directions = {(1, 0): 0, (0, 1): 1, (-1, 0): 2, (0, -1): 3}
    turn_priority = {1: 0, 0: 1, 3: 2, 2: 3}
    loops = []
    while edges:
        start = min(edges)
        current, previous_dir, loop = start, None, []
        while True:
            loop.append(current)
            choices = edges[current]
            if previous_dir is None:
                nxt = min(choices)
            else:
                def priority(point):
                    d = directions[(point[0] - current[0], point[1] - current[1])]
                    return turn_priority[(d - previous_dir) % 4]
                nxt = min(choices, key=priority)
            choices.remove(nxt)
            if not choices:
                del edges[current]
            previous_dir = directions[(nxt[0] - current[0], nxt[1] - current[1])]
            current = nxt
            if current == start:
                break
        loops.append(loop)
    return sorted(loops, key=lambda p: abs(signed_area(p)), reverse=True)


def remove_collinear(poly):
    return [b for a, b, c in zip(poly[-1:] + poly[:-1], poly, poly[1:] + poly[:1])
            if (b[0] - a[0]) * (c[1] - b[1]) != (b[1] - a[1]) * (c[0] - b[0])]


def rdp(points, epsilon):
    if len(points) < 3:
        return points
    a, b = np.asarray(points[0], float), np.asarray(points[-1], float)
    middle = np.asarray(points[1:-1], float)
    vector = b - a
    if not np.any(vector):
        distances = np.linalg.norm(middle - a, axis=1)
    else:
        t = np.clip(((middle - a) @ vector) / (vector @ vector), 0, 1)
        distances = np.linalg.norm(middle - (a + t[:, None] * vector), axis=1)
    index = int(np.argmax(distances)) + 1
    if distances[index - 1] <= epsilon:
        return [points[0], points[-1]]
    return rdp(points[:index + 1], epsilon)[:-1] + rdp(points[index:], epsilon)


def simplify_closed(poly, epsilon):
    if epsilon == 0:
        return remove_collinear(poly)
    # Split at measured farthest vertices, not idealized polygon corners.
    a = min(range(len(poly)), key=lambda i: poly[i])
    ordered = poly[a:] + poly[:a]
    b = max(range(1, len(ordered)), key=lambda i:
            (ordered[i][0] - ordered[0][0]) ** 2 + (ordered[i][1] - ordered[0][1]) ** 2)
    out = rdp(ordered[:b + 1], epsilon)[:-1] + rdp(ordered[b:] + ordered[:1], epsilon)[:-1]
    return out if signed_area(out) > 0 else list(reversed(out))


def rasterize(poly, bbox):
    x0, y0, x1, y1 = bbox
    xx, yy = np.meshgrid(np.arange(x0, x1) + .5, np.arange(y0, y1) + .5)
    inside = np.zeros(xx.shape, dtype=bool)
    # Pixel-center even/odd fill avoids ImageDraw's inclusive-edge expansion.
    for a, b in zip(poly, poly[1:] + poly[:1]):
        if a[1] == b[1]:
            continue
        crosses = ((a[1] > yy) != (b[1] > yy))
        x_at_y = (b[0] - a[0]) * (yy - a[1]) / (b[1] - a[1]) + a[0]
        inside ^= crosses & (xx < x_at_y)
    return inside


def centroid(poly):
    terms = [(a[0] * b[1] - b[0] * a[1], a, b)
             for a, b in zip(poly, poly[1:] + poly[:1])]
    total = sum(t[0] for t in terms)
    return [sum((a[i] + b[i]) * cross for cross, a, b in terms) / (3 * total)
            for i in (0, 1)]


def boundary_deviation(boundary, poly):
    points = np.asarray(boundary, float)
    distances = []
    for a, b in zip(poly, poly[1:] + poly[:1]):
        a, b = np.asarray(a, float), np.asarray(b, float)
        vector = b - a
        t = np.clip(((points - a) @ vector) / (vector @ vector), 0, 1)
        distances.append(np.linalg.norm(points - (a + t[:, None] * vector), axis=1))
    return float(np.min(distances, axis=0).max())


def trace_cell(pixels):
    loops = pixel_loops(pixels)
    outer = loops[0]
    if signed_area(outer) < 0:
        outer.reverse()
    x0 = min(x for x, y in pixels)
    y0 = min(y for x, y in pixels)
    x1 = max(x for x, y in pixels) + 1
    y1 = max(y for x, y in pixels) + 1
    bbox = [x0, y0, x1, y1]
    target = np.zeros((y1 - y0, x1 - x0), dtype=bool)
    for x, y in pixels:
        target[y - y0, x - x0] = True
    chosen = None
    for epsilon in (.8, .4, .2, 0):
        contour = simplify_closed(outer, epsilon)
        prediction = rasterize(contour, bbox)
        # Preserve any measured holes explicitly; none are invented/filled.
        for hole in loops[1:]:
            prediction &= ~rasterize(hole, bbox)
        intersection = int((prediction & target).sum())
        union = int((prediction | target).sum())
        iou = intersection / union
        chosen = contour, prediction, epsilon, iou
        if iou >= .99:
            break
    contour, prediction, epsilon, iou = chosen
    assert len(contour) >= 3 and signed_area(contour) > 0
    # Editable/renderable geometry has a separate one-pixel error budget. Its
    # lower relative fidelity on tiny cells must not be hidden by a global score.
    model = simplify_closed(outer, 1.0)
    if len(model) < 3 or signed_area(model) <= 0:
        model = simplify_closed(outer, .8)
    assert len(model) >= 3 and signed_area(model) > 0
    model_prediction = rasterize(model, bbox)
    for hole in loops[1:]:
        model_prediction &= ~rasterize(hole, bbox)
    model_iou = int((model_prediction & target).sum()) / int((model_prediction | target).sum())
    deviation = boundary_deviation(outer, model)
    assert deviation <= 1.0 + 1e-9
    return {'contour_px': contour, 'holes_px': loops[1:], 'centroid_px': centroid(contour),
            'mask_centroid_px': [sum(p[i] + .5 for p in pixels) / len(pixels) for i in (0, 1)],
            'area_px': len(pixels), 'bbox_px': bbox, 'epsilon_px': epsilon,
            'mask_iou': iou, 'prediction': prediction, 'pixel_boundary_vertices': len(outer),
            'model_contour_px': model, 'model_prediction': model_prediction,
            'model_mask_iou': model_iou, 'model_boundary_max_deviation_px': deviation}


def assign_order(cells, center):
    for c in cells:
        x, y = c['centroid_px']
        c['radius_px'] = math.hypot(x - center[0], y - center[1])
        c['angle_rad'] = (math.atan2(y - center[1], x - center[0]) + math.pi / 2) % (2 * math.pi)
    # Ring labels organize measured cells only. Geometry is never regenerated
    # from these groups, their angles, or an assumed number of sides/cells.
    groups = [[]]
    previous = None
    for c in sorted(cells, key=lambda c: c['radius_px']):
        if previous and c['radius_px'] / previous > 1.12:
            groups.append([])
        groups[-1].append(c)
        previous = c['radius_px']
    ordered = []
    for ring, group in enumerate(reversed(groups)):
        for position, c in enumerate(sorted(group, key=lambda c: c['angle_rad'])):
            c['ring'] = ring
            c['position_in_ring'] = position
            ordered.append(c)
    return ordered


def font(size):
    try:
        return ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', size)
    except OSError:
        return ImageFont.load_default()


def overlay(source, cells, mask, prediction, destination, iou):
    width, height = source.size
    backdrop = Image.new('RGBA', source.size, '#10151b')
    backdrop.alpha_composite(source)
    full = backdrop.convert('RGB')
    draw = ImageDraw.Draw(full)
    for c in cells:
        p = c['contour_px']
        draw.line(p + p[:1], fill='#ffffff', width=1)
        if c['area_px'] >= 250:
            x, y = c['centroid_px']
            draw.text((x, y), str(c['index'] + 1), anchor='mm', font=font(10),
                      fill='white', stroke_width=1, stroke_fill='#18333e')
    difference = np.asarray(full).copy()
    difference[mask ^ prediction] = [255, 154, 63]
    full = Image.fromarray(difference)
    crop_width = 164
    x0 = round(width / 2 - crop_width / 2)
    y0 = round(height / 2 - crop_width / 2)
    detail = backdrop.convert('RGB').crop((x0, y0, x0 + crop_width, y0 + crop_width)).resize((820, 820), Image.Resampling.NEAREST)
    dd = ImageDraw.Draw(detail)
    for c in cells:
        pts = [((x - x0) * 5, (y - y0) * 5) for x, y in c['model_contour_px']]
        dd.line(pts + pts[:1], fill='#ffe082', width=1)
        x, y = c['centroid_px']
        if x0 <= x < x0 + crop_width and y0 <= y < y0 + crop_width and c['area_px'] >= 20:
            dd.text(((x - x0) * 5, (y - y0) * 5), str(c['index'] + 1),
                    anchor='mm', font=font(12), fill='white', stroke_width=1, stroke_fill='#18333e')
    canvas = Image.new('RGB', (1692, 928), '#e9eeec')
    d = ImageDraw.Draw(canvas)
    d.text((18, 12), 'SUPPLIED ORIGINAL + MEASURED OUTLINES', fill='#19332f', font=font(18))
    d.text((854, 12), 'CENTER AT 5x — MODEL EDGES WITHIN ONE SOURCE PIXEL', fill='#19332f', font=font(17))
    canvas.paste(full, (18, 45))
    canvas.paste(detail, (854, 45))
    d.text((18, 880), f'{len(cells)} cells | source {width} x {height} | reference IoU {iou:.5%} | white = reference; gold = model; orange = reference mask difference',
           fill='#19332f', font=font(16))
    d.text((18, 904), 'Original teal is unchanged. Diagnostic outlines are not a new palette. Innermost cells have only 8–14 source pixels; no forced polygon side count.',
           fill='#19332f', font=font(14))
    canvas.save(destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=DEFAULT_SOURCE)
    args = parser.parse_args()
    original_bytes = args.source.read_bytes()
    source = Image.open(args.source).convert('RGBA')
    rgba = np.asarray(source)
    width, height = source.size
    mask = foreground(rgba, .5)
    raw_cells = components(mask)
    cells = assign_order([trace_cell(p) for p in raw_cells], [width / 2, height / 2])
    prediction = np.zeros(mask.shape, dtype=bool)
    model_prediction = np.zeros(mask.shape, dtype=bool)
    records = []
    for index, c in enumerate(cells):
        c['index'] = index
        x0, y0, x1, y1 = c['bbox_px']
        prediction[y0:y1, x0:x1] |= c['prediction']
        model_prediction[y0:y1, x0:x1] |= c['model_prediction']
        center = [round(c['centroid_px'][0] / width, 9), round(c['centroid_px'][1] / height, 9)]
        tiny = c['area_px'] < 25
        records.append({
            'id': f'cell-{index + 1:03d}', 'index': index, 'ring': c['ring'],
            'position_in_ring': c['position_in_ring'], 'center': center, 'centroid': center,
            'contour': [[round(x / width, 9), round(y / height, 9)] for x, y in c['contour_px']],
            'model_contour': [[round(x / width, 9), round(y / height, 9)] for x, y in c['model_contour_px']],
            'model_vertex_count': len(c['model_contour_px']),
            'model_simplification_epsilon_px': 1.0,
            'model_boundary_max_deviation_px': round(c['model_boundary_max_deviation_px'], 9),
            'model_mask_iou': round(c['model_mask_iou'], 9),
            'holes': [[[round(x / width, 9), round(y / height, 9)] for x, y in hole] for hole in c['holes_px']],
            'area_px': c['area_px'], 'bbox_px': c['bbox_px'],
            'radius_px': round(c['radius_px'], 6), 'angle_rad': round(c['angle_rad'], 9),
            'vertex_count': len(c['contour_px']), 'pixel_boundary_vertices': c['pixel_boundary_vertices'],
            'simplification_epsilon_px': c['epsilon_px'], 'mask_iou': round(c['mask_iou'], 9),
            'resolution_note': ('Tiny raster-resolved cell; exact authored subpixel corners are unresolved. Pixel boundary retained.' if tiny
                                else 'Measured raster boundary, simplified only within the per-cell mask fidelity limit.')
        })
    intersection = int((mask & prediction).sum())
    union = int((mask | prediction).sum())
    iou = intersection / union
    threshold_study = [{'coverage_threshold': t, 'foreground_pixels': int(foreground(rgba, t).sum()),
                        'component_count': len(components(foreground(rgba, t)))} for t in (.35, .5, .65)]
    tiny_ids = [c['id'] for c in records if c['area_px'] < 25]
    result = {
        'schema_version': 1,
        'source': {'filename': args.source.name, 'relative_path': 'originals/' + args.source.name,
                   'width': width, 'height': height, 'mode': 'RGBA',
                   'sha256': hashlib.sha256(original_bytes).hexdigest(),
                   'hash_note': 'PUBLIC-CONSTANT: checksum of the supplied original artwork file',
                   'authorship': 'Original artwork coauthored by the user and their mother.'},
        'coordinate_system': {'origin': 'top-left', 'x': 'right', 'y': 'down',
                              'normalization': 'x/width,y/height; pixel boundaries span [0,width] x [0,height]',
                              'contour_winding': 'positive signed area in image coordinates (clockwise on screen)',
                              'contour_closure': 'implicit; final point is not repeated',
                              'ordering': 'measured rings outer to inner, then clockwise starting at the top; groups do not generate geometry'},
        'color_canon': {'purple': 'humans', 'teal': 'AI', 'green': 'biomass',
                        'trace_note': 'Geometry only. No organizational or three-view recoloring has been applied.'},
        'method': {'connectivity': 4, 'coverage_threshold': .5, 'reference_teal_rgb': [37, 170, 227],
                   'foreground_rule': 'alpha>0; RGB projection on reference teal >=0.5; B-R>40; G-R>30',
                   'contours': 'Exact component pixel edges followed by measured-boundary RDP; never regular hexagons or radial reconstruction.',
                   'per_cell_minimum_mask_iou': .99,
                   'pixel_trace_limits': ['Source resolution is 820 x 821, not vector artwork.',
                                          'JPEG/color-edge artifacts survive in supplied PNG; a documented 50% color coverage contour is used.',
                                          'A 3D bevel or UV sampling may change apparent edge coverage; these measurements evaluate the flat trace only.']},
        'cell_count': len(records), 'ring_counts': {str(r): sum(c['ring'] == r for c in records) for r in sorted(set(c['ring'] for c in records))},
        'cells': records,
        'fidelity': {'reference_foreground_pixels': int(mask.sum()), 'traced_foreground_pixels': int(prediction.sum()),
                     'intersection_pixels': intersection, 'union_pixels': union,
                     'symmetric_difference_pixels': int((mask ^ prediction).sum()),
                     'mask_iou': iou, 'mask_precision': intersection / int(prediction.sum()),
                     'mask_recall': intersection / int(mask.sum()),
                     'minimum_cell_iou': min(c['mask_iou'] for c in records),
                     'threshold_stability': threshold_study, 'omitted_components': 0,
                     'hole_count': sum(len(c['holes']) for c in records)},
        'modeling_fidelity': {
            'method': 'RDP of the same measured pixel boundary with at most one original pixel deviation; no fixed side count and no per-cell IoU gate.',
            'recommended_geometry_field': 'model_contour',
            'reference_geometry_field': 'contour',
            'source_pixel_tolerance': 1.0,
            'maximum_boundary_to_model_deviation_px': max(c['model_boundary_max_deviation_px'] for c in records),
            'total_vertices': sum(c['model_vertex_count'] for c in records),
            'reference_total_vertices': sum(c['vertex_count'] for c in records),
            'vertex_count_min_max': [min(c['model_vertex_count'] for c in records), max(c['model_vertex_count'] for c in records)],
            'mask_iou': int((mask & model_prediction).sum()) / int((mask | model_prediction).sum()),
            'mask_precision': int((mask & model_prediction).sum()) / int(model_prediction.sum()),
            'mask_recall': int((mask & model_prediction).sum()) / int(mask.sum()),
            'symmetric_difference_pixels': int((mask ^ model_prediction).sum()),
            'minimum_cell_iou': min(c['model_mask_iou'] for c in records),
            'tiny_cells_minimum_iou': min(c['model_mask_iou'] for c in records if c['area_px'] < 25),
            'resolution_limit': 'One pixel is a substantial fraction of each 8–14 pixel innermost cell. All cells remain present, but their modeled edges are approximations; consult per-cell overlaps and the unchanged reference contour.'},
        'unresolved': [{'kind': 'subpixel_corner_uncertainty', 'cell_ids': tiny_ids,
                        'note': 'These innermost cells are separately resolved, but have only 8–14 foreground pixels each. Their original subpixel polygon corners cannot be inferred. All measured cells are retained; none are replaced with regular hexagons.'}]
    }
    output = HERE / 'source'
    output.mkdir(exist_ok=True)
    serialized = json.dumps(result, indent=2)
    # Keep the public artifact-digest marker on the same line as its hex value,
    # as required by this repository's pre-commit convention. JSON remains valid.
    serialized = serialized.replace('\n    "hash_note":', ' "hash_note":')
    (output / 'cells.json').write_text(serialized + '\n', encoding='utf-8')
    overlay(source, cells, mask, prediction, output / 'trace-overlay.png', iou)
    print(json.dumps({'cell_count': len(records), 'ring_counts': result['ring_counts'],
                      'fidelity': result['fidelity'], 'tiny_cell_count': len(tiny_ids),
                      'modeling_fidelity': result['modeling_fidelity'],
                      'vertices_min_max': [min(c['vertex_count'] for c in records), max(c['vertex_count'] for c in records)],
                      'json': str(output / 'cells.json'), 'overlay': str(output / 'trace-overlay.png')}, indent=2))


if __name__ == '__main__':
    main()
