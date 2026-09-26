"""Blender 4.5 LTS: extrude traced original artwork into editable enamel reliefs.

Run blender --background --factory-startup --threads 4 --python-exit-code 1 --python build-study.py
Uses the supplied original textures; no add-ons, network requests, or third-party Python packages.
"""
import bpy
import json
import math
from pathlib import Path
from mathutils import Vector

HERE = Path(__file__).resolve().parent
DIAMETER = 3.8  # Artistic dimensions, not fabrication units.
MARKS = [
    ('teal-original', 'teal_BN_logo_transparent.png', 'Teal original | AI'),
    ('green-original', 'green BN logo.jpg', 'Green original | biomass'),
    ('purple-original', 'purple BN logo.jpg', 'Purple-led original | human, AI and biomass gradient'),
    ('green-teal-original', 'green-teal BN logo.jpg', 'Green-teal original | mixed color flow'),
]
for folder in ('models', 'renders'):
    (HERE / folder).mkdir(exist_ok=True)

def rgba(color):
    channels = [int(color[i:i+2], 16) / 255 for i in (1, 3, 5)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels) + (1,)

def material(name, color, roughness=.4, coat=.06):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = rgba(color)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = rgba(color)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Coat Weight'].default_value = coat
    bsdf.inputs['Coat Roughness'].default_value = .2
    bsdf.inputs['Specular IOR Level'].default_value = .23
    mat['source_srgb'] = color
    return mat

porcelain = material('Porcelain | neutral study sidewalls', '#f8f7f3', .3, .18)
floor_mat = material('Studio | warm white', '#eeeee9', .72, 0)

def new_scene(name):
    scene = bpy.data.scenes.new(name)
    bpy.context.window.scene = scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 5
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 4
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.film_transparent = False
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    world = bpy.data.worlds.new(name + ' | studio world')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.8, .83, .88, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = .3
    scene.world = world
    return scene

def aim(obj, target=(0, 0, 0)):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()

def studio(scene, overview=False):
    bpy.context.window.scene = scene
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.035))
    floor = bpy.context.object
    floor.name = 'STUDIO | floor (not exported)'
    floor.data.materials.append(floor_mat)
    lights = [
        ('Key softbox', (-3, -4, 7), 350, 5),
        ('Fill softbox', (4, 1, 5), 180, 4),
        ('Top ribbon', (-1, 4, 6), 250, 3),
    ]
    for name, position, power, size in lights:
        data = bpy.data.lights.new(name, 'AREA')
        data.energy = power * (2 if overview else 1)
        data.shape = 'DISK'
        data.size = size * (1.5 if overview else 1)
        obj = bpy.data.objects.new(name, data)
        scene.collection.objects.link(obj)
        obj.location = tuple(v * (1.5 if overview else 1) for v in position)
        aim(obj)
    data = bpy.data.cameras.new('Study camera')
    camera = bpy.data.objects.new('Study camera', data)
    scene.collection.objects.link(camera)
    camera.location = (0, -10, 18) if overview else (3.2, -4.8, 8.8)
    aim(camera, (0, 0, .08))
    data.type = 'ORTHO'
    data.ortho_scale = 13.2 if overview else 4.7
    scene.camera = camera
    scene.render.resolution_x = 1800 if overview else 1000
    scene.render.resolution_y = 820 if overview else 1000
    return camera

def original_material(label, source):
    mat = material(label + ' | original image colors', '#ffffff')
    image = bpy.data.images.load(str(HERE / 'source' / 'originals' / source), check_existing=True)
    tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = image
    tex.interpolation = 'Linear'
    tex.extension = 'CLIP'
    mat.node_tree.links.new(tex.outputs['Color'], mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    mat['original_file'] = source
    mat['authors'] = 'LoVis and his mother; user supplied originals, 2026-09-07'
    mat['color_meaning'] = 'Purples: humans; teal: AI; greens: biomass. Preserve mixed gradients.'
    return mat

def build_mark(slug, source, label):
    scene = new_scene(slug + ' | enamel study')
    scene['title'] = label
    tracing = json.loads((HERE / 'source' / 'cells.json').read_text(encoding='utf8'))
    cells = tracing['cells']
    collection = bpy.data.collections.new(label + ' | traced original cells')
    scene.collection.children.link(collection)
    face_material = original_material(label, source)
    records = []
    for index, cell in enumerate(cells):
        # Keep the measured raster boundary for the very small center cells;
        # a one-pixel simplification would consume too much of their area.
        contour = cell['contour'] if cell['area_px'] < 40 else cell['model_contour']
        points = list(reversed(contour))  # Image y-down to Blender y-up.
        cx, cy = cell['center']
        radius = math.hypot(cx - .5, cy - .5) * 2
        xy = [((x-.5)*DIAMETER, (.5-y)*DIAMETER) for x,y in points]
        cell_width = min(max(p[axis] for p in xy)-min(p[axis] for p in xy) for axis in (0,1))
        top = min(.15, cell_width*.6)
        count = len(xy)
        verts = [(x,y,0) for x,y in xy] + [(x,y,top) for x,y in xy]
        faces = [tuple(range(count-1,-1,-1)), tuple(range(count,count*2))]
        faces += [(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
        mesh = bpy.data.meshes.new(f'{slug}_cell_{index:03d}')
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(f'{slug} | {cell["id"]}', mesh)
        collection.objects.link(obj)
        mesh.materials.append(porcelain)
        mesh.materials.append(face_material)
        mesh.polygons[1].material_index = 1
        uv = mesh.uv_layers.new(name='Original artwork')
        for polygon in mesh.polygons:
            for loop in polygon.loop_indices:
                u,v = points[mesh.loops[loop].vertex_index % count]
                uv.data[loop].uv = (u,1-v)
        bevel = obj.modifiers.new('Soft neutral edge | scaled to each original cell', 'BEVEL')
        bevel.width = min(.006, cell_width*.09)
        bevel.segments = 3
        bevel.material = 0
        bevel.affect = 'EDGES'
        obj.modifiers.new('Weighted surface normals', 'WEIGHTED_NORMAL')
        obj['original_image'] = source
        obj['traced_cell'] = cell['id']
        obj['study'] = 'Original contour trace; enamel depth and sidewalls are a new 3D interpretation'
        records.append({'cell': cell['id'], 'vertices': count, 'center': [cx,cy], 'top': top})
    bpy.ops.object.select_all(action='DESELECT')
    for obj in collection.objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = next(iter(collection.objects))
    bpy.ops.export_scene.gltf(filepath=str(HERE / 'models' / (slug + '.glb')),
        export_format='GLB', use_selection=True, use_active_scene=True, export_apply=True, export_animations=False,
        export_cameras=False, export_lights=False, export_extras=True)
    studio(scene)
    scene.render.filepath = str(HERE / 'renders' / (slug + '.png'))
    bpy.ops.render.render(write_still=True)
    return collection, records

# Factory-startup is requested by the runner; remove only its default scene.
starting = list(bpy.data.scenes)
collections = []
manifest = {'blender': bpy.app.version_string, 'interpretation': 'Original tapered contours; shallow enamel relief and neutral sidewalls', 'color_meaning': {'purple':'humans','teal':'AI','green':'biomass'}, 'marks': {}}
for slug, source, label in MARKS:
    collection, records = build_mark(slug, source, label)
    collections.append(collection)
    manifest['marks'][slug] = {'source': source, 'cells': records}

overview = new_scene('00 | Original genesis blooms')
for collection, x in zip(collections[:3], (-4.1, 0, 4.1)):
    instance = bpy.data.objects.new(collection.name + ' | display instance', None)
    instance.instance_type = 'COLLECTION'
    instance.instance_collection = collection
    instance.location = (x, 0, 0)
    overview.collection.objects.link(instance)
studio(overview, overview=True)
overview.render.filepath = str(HERE / 'renders' / 'original-blooms.png')
bpy.ops.render.render(write_still=True)
for scene in starting:
    bpy.data.scenes.remove(scene)
bpy.context.window.scene = overview
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'models' / 'original-genesis-study.blend'))
(HERE / 'geometry-receipt.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf8')
print('GENESIS STUDY COMPLETE: 4 GLBs, editable multi-scene BLEND, 5 renders; original traced geometry.')
