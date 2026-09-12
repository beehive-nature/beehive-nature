"""Inspect the local encoded motion deliverables; requires FFprobe on PATH."""
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent / 'motion'
film = HERE / 'green-teal-breathing.mp4'
result = subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-show_entries',
                         'stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,nb_read_frames,duration',
                         '-of', 'json', str(film)], check=True, capture_output=True, text=True)
streams = json.loads(result.stdout)['streams']
assert len(streams) == 1 and streams[0]['codec_type'] == 'video'
stream = streams[0]
assert stream['codec_name'] == 'h264' and stream['pix_fmt'] == 'yuv420p'
assert (stream['width'], stream['height']) == (720, 720)
assert stream['r_frame_rate'] == '24/1' and int(stream['nb_read_frames']) == 144
assert abs(float(stream['duration']) - 6) < .001
data = film.read_bytes()
offset = 0
boxes = []
while offset < len(data):
    size = int.from_bytes(data[offset:offset+4], 'big')
    kind = data[offset+4:offset+8].decode('ascii')
    if size == 1:
        size = int.from_bytes(data[offset+8:offset+16], 'big')
    if size == 0:
        size = len(data) - offset
    assert size >= 8 and offset + size <= len(data)
    boxes.append(kind)
    offset += size
assert offset == len(data) and boxes.index('moov') < boxes.index('mdat')
report = {'file': film.name, 'bytes': len(data), 'streams': streams,
          'fast_start': True, 'audio_streams': 0,
          'blender_file_bytes': (HERE / 'green-teal-breathing.blend').stat().st_size,
          'poster_bytes': (HERE / 'green-teal-breathing-poster.jpg').stat().st_size}
(HERE / 'video-receipt.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
