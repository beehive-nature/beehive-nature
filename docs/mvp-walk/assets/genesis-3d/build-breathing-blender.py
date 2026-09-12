"""Animate the supplied green-teal original in Blender 4.5; never overwrite the master.

blender --background --threads 4 --python-exit-code 1 --python build-breathing-blender.py -- --frames-dir /absolute/scratch/frames
Use --preview to render only frames 1, 37, 73 and 109 before the full render.
"""
import argparse
import bpy
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--frames-dir', required=True)
parser.add_argument('--preview', action='store_true')
parser.add_argument('--engine', choices=['cycles', 'eevee'], default='eevee')
parser.add_argument('--samples', type=int, default=4)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
frames_dir = Path(args.frames_dir).resolve()
frames_dir.mkdir(parents=True, exist_ok=True)
motion = HERE / 'motion'
motion.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(HERE / 'models' / 'original-genesis-study.blend'))
scene = bpy.data.scenes['green-teal-original | enamel study']
bpy.context.window.scene = scene
for other in list(bpy.data.scenes):
    if other != scene:
        bpy.data.scenes.remove(other)
bpy.data.orphans_purge(do_recursive=True)
scene.name = 'Green-teal | Breathing bloom'
scene['authors'] = 'Original artwork: LoVis and his mother. 3D motion study: Astra.'
scene['color_meaning'] = 'Purple: humans; teal: AI; green: biomass. Original mixed gradient retained.'
scene['context'] = 'Artist-first study for skaists and LOVErnment DAO. Local animation, no network synchronization.'
scene.render.engine = 'CYCLES' if args.engine == 'cycles' else 'BLENDER_EEVEE_NEXT'
scene.cycles.device = 'CPU'
scene.cycles.samples = args.samples
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 4
scene.eevee.taa_render_samples = args.samples
scene.eevee.use_gtao = True
scene.eevee.gtao_distance = .3
scene.render.threads_mode = 'FIXED'
scene.render.threads = 4
scene.render.use_persistent_data = True
scene.render.resolution_x = 720
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.render.image_settings.compression = 15
scene.render.fps = 24
scene.frame_start = 1
scene.frame_end = 144
scene.camera.data.ortho_scale = 4.9
cells = {cell['id']: cell for cell in json.loads((HERE / 'source' / 'cells.json').read_text())['cells']}
objects = [obj for obj in scene.objects if 'traced_cell' in obj]
assert len(objects) == len(cells) == 180
# The final keyframe (145) equals the first; encoded frames 1..144 omit that
# duplicate endpoint. Movement is a periodic function, not a video crossfade.
bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'
max_endpoint_error = 0.0
for obj in objects:
    cell = cells[obj['traced_cell']]
    cx, cy = cell['center']
    x, y = (cx - .5) * 3.8, (.5 - cy) * 3.8
    phase = (8 - cell['ring']) * .32
    first = None
    for frame in range(1, 146, 4):
        angle = 2 * math.pi * (frame - 1) / 144 - phase
        breath = .5 - .5 * math.cos(angle)
        location = (x * .03 * breath, y * .03 * breath, .065 * breath)
        if first is None:
            first = location
        if frame == 145:
            max_endpoint_error = max(max_endpoint_error, *(abs(a - b) for a, b in zip(first, location)))
        obj.location = location
        obj.keyframe_insert(data_path='location', frame=frame)
assert max_endpoint_error < 1e-12
scene.frame_set(1)
bpy.ops.file.pack_all()
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(motion / 'green-teal-breathing.blend'), compress=True)
report = {'blender': bpy.app.version_string, 'cells': len(objects), 'fps': 24,
          'frames': 144, 'seconds': 6, 'dimensions': [720, 720], 'samples': args.samples,
          'engine': scene.render.engine,
          'cpu_threads': 4, 'endpoint_max_error': max_endpoint_error,
          'source': 'green-teal BN logo.jpg', 'motion': 'Periodic radial expansion and vertical rise with ring phases',
          'color_meaning': {'purple': 'humans', 'teal': 'AI', 'green': 'biomass'}}
(motion / 'blender-motion-receipt.json').write_text(json.dumps(report, indent=2) + '\n')
frames = [1, 37, 73, 109] if args.preview else range(1, 145)
for frame in frames:
    scene.frame_set(frame)
    scene.render.filepath = str(frames_dir / f'{frame:04d}.png')
    bpy.ops.render.render(write_still=True)
    print(f'BNR FRAME {frame}/144', flush=True)
print('BNR BREATHING PREVIEW COMPLETE' if args.preview else 'BNR BREATHING RENDER COMPLETE', flush=True)
