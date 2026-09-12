"""Build a self-contained, original-art breathing SVG using standard Python only.

Writes motion/green-teal-breathing.svg and motion/svg-receipt.json. Each of the
180 traced cells keeps its source image UV coordinates, using one shared JPEG
image/pattern. No solid-color resampling, regular-hex reconstruction or JavaScript.

Inline preview controls (on the SVG root):
  classList.toggle('is-paused', paused)       pause/resume at the current phase
  style.setProperty('--bloom-duration','6s')  clamped to 3–24 seconds
  style.setProperty('--bloom-strength','1')   clamped to 0–2
  style.setProperty('--bloom-ring-delay','-.14s')  delay per measured ring
Reduced-motion preferences override every preset and show the resting artwork.
"""
import base64
import gzip
import hashlib
import json
import math
from pathlib import Path
import re
import struct
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
CELLS = HERE / 'source' / 'cells.json'
ARTWORK = HERE / 'source' / 'originals' / 'green-teal BN logo.jpg'
OUTPUT = HERE / 'motion'
PREFIX = 'bnr-green-teal-bloom'
RADIAL_FRACTION = .018
MAX_STRENGTH = 2
PADDING = 20
SVG_NS = 'http://www.w3.org/2000/svg'


def jpeg_dimensions(data):
    """Read JPEG dimensions without decoding/recompressing the supplied bytes."""
    if not data.startswith(b'\xff\xd8'):
        raise ValueError('The supplied artwork must be the original JPEG.')
    pos = 2
    starts_of_frame = {0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
                       0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf}
    while pos < len(data):
        if data[pos] != 0xff:
            raise ValueError('Unexpected JPEG marker structure.')
        while data[pos] == 0xff:
            pos += 1
        marker = data[pos]
        pos += 1
        if marker in (0xd8, 0xd9, 0x01) or 0xd0 <= marker <= 0xd7:
            continue
        length = struct.unpack('>H', data[pos:pos + 2])[0]
        if marker in starts_of_frame:
            height, width = struct.unpack('>HH', data[pos + 3:pos + 7])
            return width, height
        if marker == 0xda:
            break
        pos += length
    raise ValueError('JPEG dimensions were not found.')


def number(value):
    if not math.isfinite(value):
        raise ValueError('Nonfinite geometry value.')
    value = round(value, 4)
    return '0' if value == 0 else f'{value:.4f}'.rstrip('0').rstrip('.')


def path_data(points, width, height):
    if len(points) < 3 or any(not (0 <= x <= 1 and 0 <= y <= 1) for x, y in points):
        raise ValueError('A cell contour is missing or out of bounds.')
    pixels = [(x * width, y * height) for x, y in points]
    return 'M' + 'L'.join(f'{number(x)} {number(y)}' for x, y in pixels) + 'Z', pixels


def stylesheet():
    return '''svg.bnr-breathing-bloom {
  --bloom-duration: 6s;
  --bloom-strength: 1;
  --bloom-ring-delay: -.14s;
  display: block;
  width: 100%;
  height: auto;
}
.bnr-breathing-bloom .bnr-bloom-cell {
  transform: translate(0px, 0px);
  animation-name: bnr-green-teal-breathe;
  animation-duration: clamp(3s, var(--bloom-duration), 24s);
  animation-timing-function: cubic-bezier(.45, 0, .55, 1);
  animation-delay: calc(var(--bnr-ring) * var(--bloom-ring-delay));
  animation-iteration-count: infinite;
}
@keyframes bnr-green-teal-breathe {
  0%, 100% { transform: translate(0px, 0px); }
  50% {
    transform: translate(
      calc(var(--bnr-dx) * clamp(0, var(--bloom-strength), 2)),
      calc(var(--bnr-dy) * clamp(0, var(--bloom-strength), 2))
    );
  }
}
svg.bnr-breathing-bloom.is-paused,
svg.bnr-breathing-bloom.is-paused * {
  animation-play-state: paused !important;
}
@media (prefers-reduced-motion: reduce) {
  .bnr-breathing-bloom .bnr-bloom-cell {
    animation: none !important;
    transform: none !important;
  }
}'''


def verify(svg_bytes, cells, artwork_bytes, bounds, width, height):
    root = ET.fromstring(svg_bytes)
    ns = {'s': SVG_NS}
    groups = root.findall('.//s:g[@class="bnr-bloom-cell"]', ns)
    paths = root.findall('.//s:path', ns)
    images = root.findall('.//s:image', ns)
    patterns = root.findall('.//s:pattern', ns)
    assert len(groups) == len(paths) == len(cells) == 180
    assert [g.attrib['data-cell-id'] for g in groups] == [c['id'] for c in cells]
    ids = [node.attrib['id'] for node in root.iter() if 'id' in node.attrib]
    assert len(ids) == len(set(ids))
    assert len(images) == len(patterns) == 1
    embedded = images[0].attrib['href']
    assert embedded.startswith('data:image/jpeg;base64,')
    assert base64.b64decode(embedded.split(',', 1)[1], validate=True) == artwork_bytes
    assert all(p.attrib['fill'] == f'url(#{PREFIX}-paint)' for p in paths)
    assert all(p.attrib['d'].endswith('Z') for p in paths)
    assert root.attrib['role'] == 'img' and root.attrib['focusable'] == 'false'
    assert root.attrib['aria-labelledby'].split() == [f'{PREFIX}-title', f'{PREFIX}-desc']
    description = root.find('s:desc', ns).text
    assert all(word in description for word in ('LoVis', 'mother', 'humans', 'AI', 'biomass'))
    external = []
    for node in root.iter():
        tag = node.tag.rsplit('}', 1)[-1]
        assert tag not in {'script', 'foreignObject', 'filter', 'animate', 'animateTransform'}
        for key, value in node.attrib.items():
            assert not key.lower().startswith('on')
            if key.rsplit('}', 1)[-1] in {'href', 'src'} and not value.startswith(('#', 'data:image/jpeg;base64,')):
                external.append(value)
    assert not external
    css = root.find('s:style', ns).text
    assert 'prefers-reduced-motion: reduce' in css and 'animation: none !important' in css
    assert 'svg.bnr-breathing-bloom.is-paused *' in css and 'animation-play-state: paused !important' in css
    assert '0%, 100% { transform: translate(0px, 0px); }' in css
    assert not re.search(r'\b(?:opacity|filter|fill|stroke|color)\s*:', css)
    for reference in re.findall(r'url\(#([^)]+)\)', svg_bytes.decode()):
        assert reference in ids
    x0, y0, x1, y1 = bounds
    assert -PADDING <= x0 <= x1 <= width + PADDING
    assert -PADDING <= y0 <= y1 <= height + PADDING
    compressed = gzip.compress(svg_bytes, compresslevel=9, mtime=0)
    assert gzip.decompress(compressed) == svg_bytes
    return {
        'xml_parses': True, 'cell_groups': len(groups), 'cell_paths': len(paths),
        'cell_order_and_ids_match_source': True, 'unique_dom_ids': True,
        'shared_images': len(images), 'shared_patterns': len(patterns),
        'embedded_jpeg_bytes_identical': True, 'all_cells_use_shared_image_pattern': True,
        'all_paths_closed': True, 'external_asset_references': external,
        'no_script_foreign_object_filters_or_smil': True,
        'accessible_static_title_description': True,
        'root_pause_rule_present': True, 'reduced_motion_override_present': True,
        'seam_endpoints_identical': True, 'no_color_opacity_or_filter_animation': True,
        'motion_fits_viewbox_at_maximum_strength': True, 'gzip_roundtrip': True
    }, compressed


def main():
    cell_bytes = CELLS.read_text(encoding='utf-8').encode('utf-8')
    document = json.loads(cell_bytes)
    cells = document['cells']
    assert len(cells) == 180
    width, height = document['source']['width'], document['source']['height']
    artwork_bytes = ARTWORK.read_bytes()
    artwork_size = jpeg_dimensions(artwork_bytes)
    encoded = base64.b64encode(artwork_bytes).decode('ascii')
    center = width / 2, height / 2
    body = []
    bounds = [float('inf'), float('inf'), -float('inf'), -float('inf')]
    counts = {'reference': 0, 'model': 0}
    vertices = 0
    max_displacement = 0
    for cell in cells:
        use_reference = cell['area_px'] < 40
        contour = cell['contour'] if use_reference else cell['model_contour']
        kind = 'reference' if use_reference else 'model'
        counts[kind] += 1
        d, pixels = path_data(contour, width, height)
        for hole in cell.get('holes', []):
            hole_d, _ = path_data(hole, width, height)
            d += hole_d
        vertices += len(contour)
        dx = float(number((cell['centroid'][0] * width - center[0]) * RADIAL_FRACTION))
        dy = float(number((cell['centroid'][1] * height - center[1]) * RADIAL_FRACTION))
        max_displacement = max(max_displacement, math.hypot(dx, dy))
        for x, y in pixels:
            for strength in (0, MAX_STRENGTH):
                bx, by = x + strength * dx, y + strength * dy
                bounds = [min(bounds[0], bx), min(bounds[1], by), max(bounds[2], bx), max(bounds[3], by)]
        body.append(f'<g class="bnr-bloom-cell" data-cell-id="{cell["id"]}" data-ring="{cell["ring"]}" '
                    f'data-contour="{kind}" style="--bnr-ring:{cell["ring"]};--bnr-dx:{number(dx)}px;--bnr-dy:{number(dy)}px">'
                    f'<path fill="url(#{PREFIX}-paint)" fill-rule="evenodd" d="{d}"/></g>')
    svg = f'''<svg xmlns="{SVG_NS}" class="bnr-breathing-bloom" width="{width + PADDING * 2}" height="{height + PADDING * 2}" viewBox="{-PADDING} {-PADDING} {width + PADDING * 2} {height + PADDING * 2}" role="img" focusable="false" aria-labelledby="{PREFIX}-title {PREFIX}-desc">
<title id="{PREFIX}-title">Green–teal breathing bloom — original artwork by LoVis and his mother</title>
<desc id="{PREFIX}-desc">Original artwork coauthored by LoVis and his mother. Purple represents humans, teal represents AI, and green represents biomass. All 180 original cells keep the supplied green–teal image and its gradients. A gentle local breathing wave defaults to six seconds. Ring rhythm is within this artwork and does not indicate a live connection to other people. Reduced-motion preferences show the resting artwork.</desc>
<style><![CDATA[{stylesheet()}]]></style>
<defs>
<image id="{PREFIX}-original" width="{width}" height="{height}" preserveAspectRatio="none" href="data:image/jpeg;base64,{encoded}"/>
<pattern id="{PREFIX}-paint" patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse" x="0" y="0" width="{width}" height="{height}"><use href="#{PREFIX}-original"/></pattern>
</defs>
<g aria-hidden="true">
{chr(10).join(body)}
</g>
</svg>
'''
    svg_bytes = svg.encode('utf-8')
    checks, compressed = verify(svg_bytes, cells, artwork_bytes, bounds, width, height)
    receipt = {
        'schema_version': 1,
        'asset': 'motion/green-teal-breathing.svg',
        'builder': 'build-breathing-svg.py',
        'authorship': 'Original artwork coauthored by LoVis and his mother; breathing is a new motion interpretation.',
        'source_artwork': {'path': 'source/originals/green-teal BN logo.jpg',
                           'bytes': len(artwork_bytes), 'width': artwork_size[0], 'height': artwork_size[1],
                           'sha256_PUBLIC-CONSTANT': hashlib.sha256(artwork_bytes).hexdigest(),
                           'embedding': 'Exact JPEG bytes embedded once as data URI; one shared user-space image pattern. No image resampling or recompression in this asset.'},
        'source_geometry': {'path': 'source/cells.json', 'sha256_PUBLIC-CONSTANT': hashlib.sha256(cell_bytes).hexdigest(),
                            'digest_encoding': 'UTF-8 with LF line endings',
                            'selection_rule': 'area_px < 40: contour; otherwise: model_contour',
                            'cell_count': len(cells), 'selection_counts': counts, 'vertices': vertices,
                            'normalized_uv_mapping': f'Original image mapped to the common {width} × {height} source coordinate system. Each group translates its face and pattern together.',
                            'limitations': 'Raster-traced polygons; original tiny-cell subpixel corners remain uncertain. This is not the original vector master.'},
        'colors': {'purple': 'humans', 'teal': 'AI', 'green': 'biomass',
                   'handling': 'Exact embedded continuous source gradients; no sampled solid fills, organizational mapping or three-view recoloring.'},
        'motion': {'default_duration_seconds': 6, 'duration_limits_seconds': [3, 24],
                   'radial_fraction_at_crest': RADIAL_FRACTION, 'strength_limits': [0, MAX_STRENGTH],
                   'maximum_default_centroid_displacement_source_px': round(max_displacement, 6),
                   'default_ring_delay_seconds': -.14, 'phase_formula': 'animation-delay = ring index × --bloom-ring-delay',
                   'translation_formula': 'crest translation = 0.018 × (source centroid − artwork center) × clamp(--bloom-strength,0,2)',
                   'wave': '0%/100% resting position; 50% radial crest; cubic-bezier(.45,0,.55,1) on each half; infinite seamless cycle.',
                   'viewbox': [-PADDING, -PADDING, width + 2 * PADDING, height + 2 * PADDING],
                   'maximum_motion_bounds_source_px': [round(v, 6) for v in bounds],
                   'ring_rhythm_scope': 'Local rings within this artwork, not cross-user synchronization.'},
        'inline_preview_contract': {
            'root_selector': 'svg.bnr-breathing-bloom', 'pause_class': 'is-paused',
            'pause_behavior': 'Toggle the class on the SVG root to freeze/resume all CSS animation at the current phase.',
            'variables': {'--bloom-duration': 'CSS time; default 6s, clamped to 3s–24s',
                          '--bloom-strength': 'Unitless; default 1, clamped to 0–2',
                          '--bloom-ring-delay': 'CSS time per ring; default -.14s; zero synchronizes all local rings'},
            'reduced_motion': 'Authoritative: animation:none and transform:none !important; static original rest pose even when presets change.',
            'preset_examples': {
                'breathing': {'duration': '6s', 'strength': 1, 'ring_delay': '-.14s'},
                'shared_rhythm': {'duration': '6s', 'strength': .85, 'ring_delay': '-.28s'},
                'celebration': {'duration': '3.6s', 'strength': 1.35, 'ring_delay': '-.10s'}},
            'color_note': 'Timing presets do not brighten, filter or recolor the embedded artwork.',
            'instance_note': 'One inline instance per document; prefix IDs if duplicating inline. An img embedding is self-contained but its internal pause class cannot be reached from the parent DOM.'},
        'output': {'bytes': len(svg_bytes), 'gzip_bytes_level_9_mtime_0': len(compressed),
                   'sha256_PUBLIC-CONSTANT': hashlib.sha256(svg_bytes).hexdigest(),
                   'gzip_sha256_PUBLIC-CONSTANT': hashlib.sha256(compressed).hexdigest()},
        'verification': checks,
        'visual_qa': {'performed': False,
                      'scope': 'Structural XML, source-byte, geometry-bound and CSS contract checks only. No browser rendering, playback inspection or visual QA was performed.'}
    }
    OUTPUT.mkdir(exist_ok=True)
    (OUTPUT / 'green-teal-breathing.svg').write_bytes(svg_bytes)
    (OUTPUT / 'svg-receipt.json').write_text(json.dumps(receipt, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(json.dumps({'asset': str(OUTPUT / 'green-teal-breathing.svg'), 'receipt': str(OUTPUT / 'svg-receipt.json'),
                      'cells': len(cells), 'selection_counts': counts, 'vertices': vertices,
                      'bytes': len(svg_bytes), 'gzip_bytes': len(compressed),
                      'maximum_default_displacement_px': round(max_displacement, 6),
                      'motion_bounds': bounds, 'structural_verification': 'passed', 'visual_qa': 'not performed'}, indent=2))


if __name__ == '__main__':
    main()
