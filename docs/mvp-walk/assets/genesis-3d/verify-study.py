"""Inspect source copies and the generated Blender/glTF study artifacts."""
import hashlib
import json
import struct
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
FILES = {
    'teal-original': 'teal_BN_logo_transparent.png',
    'green-original': 'green BN logo.jpg',
    'purple-original': 'purple BN logo.jpg',
    'green-teal-original': 'green-teal BN logo.jpg',
}

def digest(data):
    return hashlib.sha256(data).hexdigest()

originals = []
for path in sorted((HERE / 'source' / 'originals').iterdir()):
    data = path.read_bytes()
    with Image.open(path) as image:
        originals.append({'file': path.name, 'bytes': len(data), 'width': image.width,
                          'height': image.height, 'mode': image.mode, 'sha256': digest(data)})
assert len(originals) == 6
lines = ['# Original artwork file receipt', '',
         'Supplied 2026-09-07; credited by the founder to himself and his mother.', '',
         '| Original supplied filename | Pixels | Mode | Bytes | SHA-256 | Classification |',
         '|---|---|---|---:|---|---|']
for item in originals:
    lines.append(f'| {item["file"]} | {item["width"]} × {item["height"]} | {item["mode"]} | {item["bytes"]} | `{item["sha256"]}` | PUBLIC-CONSTANT artwork digest |')
(HERE / 'source' / 'originals-receipt.md').write_text('\n'.join(lines)+'\n', encoding='utf8')

trace = json.loads((HERE / 'source' / 'cells.json').read_text(encoding='utf8'))
expected_cells = {cell['id'] for cell in trace['cells']}
assert len(expected_cells) == 180
results = {}
for slug, filename in FILES.items():
    path = HERE / 'models' / (slug + '.glb')
    data = path.read_bytes()
    magic, version, size = struct.unpack_from('<III', data)
    assert magic == 0x46546C67 and version == 2 and size == len(data), slug
    json_size, json_type = struct.unpack_from('<II', data, 12)
    assert json_type == 0x4E4F534A
    doc = json.loads(data[20:20+json_size])
    binary_start = 20 + json_size
    binary_size, binary_type = struct.unpack_from('<II', data, binary_start)
    assert binary_type == 0x004E4942
    binary = data[binary_start+8:binary_start+8+binary_size]
    ids = [node.get('extras', {}).get('traced_cell') for node in doc['nodes'] if 'mesh' in node]
    assert len(ids) == 180 and set(ids) == expected_cells, (slug, len(ids))
    assert all('children' in node and 'camera' not in node and not node.get('extensions')
               for node in doc['nodes'] if 'mesh' not in node)
    assert all('uri' not in buffer for buffer in doc['buffers'])
    assert all('uri' not in image and 'bufferView' in image for image in doc['images'])
    original_bytes = (HERE / 'source' / 'originals' / filename).read_bytes()
    embedded_equal = False
    for image in doc['images']:
        view = doc['bufferViews'][image['bufferView']]
        start = view.get('byteOffset', 0)
        embedded = binary[start:start+view['byteLength']]
        if embedded == original_bytes:
            embedded_equal = True
    assert embedded_equal, 'Export re-encoded the source texture; inspect before claiming byte preservation: ' + slug
    triangles = sum(doc['accessors'][primitive['indices']]['count']//3
                    for mesh in doc['meshes'] for primitive in mesh['primitives'])
    with Image.open(HERE / 'renders' / (slug + '.png')) as image:
        assert image.size == (1000, 1000)
        assert len(image.convert('RGB').getcolors(1_000_001)) > 1000
    results[slug] = {'bytes': len(data), 'cells': len(ids), 'triangles': triangles,
                     'original_texture_bytes_embedded': embedded_equal, 'external_dependencies': 0}

blend = HERE / 'models' / 'original-genesis-study.blend'
assert blend.read_bytes().startswith(b'BLENDER'), 'Missing or unexpectedly compressed Blender scene'
with Image.open(HERE / 'renders' / 'original-blooms.png') as image:
    assert image.size == (1800, 820)
report = {'blender_file_bytes': blend.stat().st_size, 'source_files': len(originals),
          'renders': 5, 'models': results}
(HERE / 'verification.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf8')
print(json.dumps(report, indent=2))
