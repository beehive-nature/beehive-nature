# -*- coding: utf-8 -*-
# burti — the original latvian letterform of the .a/.b names, compiled to a font.
# lowercase, the latvian court, the cell dot and the spacing are the founder's own dna (burti-dna.js), path for path.
# new here, drawn on the same grid with the same 16-unit round-capped monoline: capitals, ü ö ä, a hyphen, and the crest's signs as sigils.
import math, re, sys, json, subprocess, os
from shapely.geometry import LineString, Polygon, Point
from shapely.ops import unary_union
from shapely.geometry.polygon import orient
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
DNA_JS = os.path.join(HERE, 'burti-dna.js')
STROKE = 16
TRACK = 18            # the specimen sets letters at advance = w + 18
K = 5                 # dna unit → font unit (baseline y=140, x-height 40, ascender/cap 0, descender 180)
BASE = 140

# ── read the dna exactly as written (node evaluates the file; nothing is retyped)
dna = json.loads(subprocess.check_output(['node', '-e', "const {G,STROKE}=require(process.argv[1]);process.stdout.write(JSON.stringify({G,STROKE}))", DNA_JS]))
assert dna['STROKE'] == STROKE
G = dna['G']

# ── capitals: same grid (0..140), same stroke, circles for bowls like the small letters
CAPS = {
 'A': (128, ['M8,140 L64,0 L120,140', 'M30,90 L98,90']),
 'B': (112, ['M8,0 L8,140', 'M8,0 L58,0 A33,33 0 0,1 58,66 L8,66', 'M8,66 L64,66 A37,37 0 0,1 64,140 L8,140']),
 'C': (144, ['M133,27 A70,70 0 1,0 133,113']),
 'D': (124, ['M8,0 L8,140 L46,140 A70,70 0 0,0 46,0 L8,0']),
 'E': (100, ['M92,0 L8,0 L8,140 L92,140', 'M8,70 L80,70']),
 'F': (96,  ['M92,0 L8,0 L8,140', 'M8,70 L78,70']),
 'G': (152, ['M133,27 A70,70 0 1,0 148,70 L96,70']),
 'H': (124, ['M8,0 L8,140', 'M116,0 L116,140', 'M8,70 L116,70']),
 'I': (32,  ['M16,0 L16,140']),
 'J': (84,  ['M68,0 L68,108 A30,30 0 0,1 8,108']),
 'K': (116, ['M8,0 L8,140', 'M108,0 L8,84', 'M38,59 L112,140']),
 'L': (92,  ['M8,0 L8,140 L88,140']),
 'M': (156, ['M8,140 L8,0 L78,104 L148,0 L148,140']),
 'N': (128, ['M8,140 L8,0 L120,140 L120,0']),
 'O': (156, ['M78,0 a70,70 0 1,0 0.1,0']),
 'P': (108, ['M8,140 L8,0 L62,0 A38,38 0 0,1 62,76 L8,76']),
 'Q': (156, ['M78,0 a70,70 0 1,0 0.1,0', 'M104,104 L148,148']),
 'R': (112, ['M8,140 L8,0 L62,0 A38,38 0 0,1 62,76 L8,76', 'M52,76 L104,140']),
 'S': (108, ['M98,18 Q98,0 80,0 L30,0 Q12,0 12,18 L12,52 Q12,70 30,70 L78,70 Q96,70 96,88 L96,122 Q96,140 78,140 L8,140']),
 'T': (112, ['M4,0 L108,0', 'M56,0 L56,140']),
 'U': (124, ['M8,0 L8,86 A54,54 0 0,0 116,86 L116,0']),
 'V': (124, ['M6,0 L62,140 L118,0']),
 'W': (176, ['M6,0 L46,140 L88,36 L130,140 L170,0']),
 'X': (116, ['M8,0 L108,140', 'M108,0 L8,140']),
 'Y': (116, ['M6,0 L58,78 L110,0', 'M58,78 L58,140']),
 'Z': (112, ['M10,0 L102,0 L10,140 L102,140']),
}
# marks over capitals sit the same distance above the cap line as the court's sit above the x-height
CMACRON = lambda w: ['M%g,-28 L%g,-28' % (w / 2 - 32, w / 2 + 32)]
CCARON  = lambda w: ['M%g,-38 L%g,-20 L%g,-38' % (w / 2 - 22, w / 2, w / 2 + 22)]
COMMA_B = lambda x: ['M%g,158 Q%g,164 %g,178' % (x, x + 10, x + 2)]
def hexagon(cx, cy, R):   # pointy-top, like every cell in the house
    return Polygon([(cx + R * math.cos(math.radians(90 + 60 * k)), cy - R * math.sin(math.radians(90 + 60 * k))) for k in range(6)])

# ── svg path → polylines
TOK = re.compile(r'[MLAQCZmlaqcz]|-?\d*\.?\d+(?:e-?\d+)?')
def arc_pts(x0, y0, rx, ry, phi, fa, fs, x1, y1, n=40):
    if rx == 0 or ry == 0: return [(x1, y1)]
    ph = math.radians(phi); c, s = math.cos(ph), math.sin(ph)
    dx, dy = (x0 - x1) / 2, (y0 - y1) / 2
    x1p, y1p = c * dx + s * dy, -s * dx + c * dy
    rx, ry = abs(rx), abs(ry)
    lam = x1p ** 2 / rx ** 2 + y1p ** 2 / ry ** 2
    if lam > 1: rx, ry = rx * math.sqrt(lam), ry * math.sqrt(lam)
    num = rx ** 2 * ry ** 2 - rx ** 2 * y1p ** 2 - ry ** 2 * x1p ** 2
    den = rx ** 2 * y1p ** 2 + ry ** 2 * x1p ** 2
    co = math.sqrt(max(0, num / den)) * (-1 if fa == fs else 1)
    cxp, cyp = co * rx * y1p / ry, -co * ry * x1p / rx
    cx, cy = c * cxp - s * cyp + (x0 + x1) / 2, s * cxp + c * cyp + (y0 + y1) / 2
    ang = lambda ux, uy, vx, vy: math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
    t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
    if not fs and dt > 0: dt -= 2 * math.pi
    if fs and dt < 0: dt += 2 * math.pi
    steps = max(4, int(abs(dt) / (2 * math.pi) * 96))
    return [(cx + rx * math.cos(t1 + dt * i / steps) * c - ry * math.sin(t1 + dt * i / steps) * s,
             cy + rx * math.cos(t1 + dt * i / steps) * s + ry * math.sin(t1 + dt * i / steps) * c) for i in range(1, steps + 1)]
def polylines(d):
    t = TOK.findall(d); i = 0; out = []; cur = []; x = y = sx = sy = 0; cmd = None
    def num():
        nonlocal i; v = float(t[i]); i += 1; return v
    while i < len(t):
        if re.match(r'[A-Za-z]', t[i]): cmd = t[i]; i += 1
        if cmd in 'Mm':
            nx, ny = num(), num()
            if cmd == 'm': nx, ny = x + nx, y + ny
            if len(cur) > 1: out.append(cur)
            x, y = nx, ny; sx, sy = x, y; cur = [(x, y)]; cmd = 'L' if cmd == 'M' else 'l'
        elif cmd in 'Ll':
            nx, ny = num(), num()
            if cmd == 'l': nx, ny = x + nx, y + ny
            x, y = nx, ny; cur.append((x, y))
        elif cmd in 'Aa':
            rx, ry, phi, fa, fs, nx, ny = num(), num(), num(), int(num()), int(num()), num(), num()
            if cmd == 'a': nx, ny = x + nx, y + ny
            cur += arc_pts(x, y, rx, ry, phi, fa, fs, nx, ny); x, y = nx, ny
        elif cmd in 'Qq':
            cx_, cy_, nx, ny = num(), num(), num(), num()
            if cmd == 'q': cx_, cy_, nx, ny = x + cx_, y + cy_, x + nx, y + ny
            cur += [((1 - u) ** 2 * x + 2 * (1 - u) * u * cx_ + u * u * nx, (1 - u) ** 2 * y + 2 * (1 - u) * u * cy_ + u * u * ny) for u in [k / 12 for k in range(1, 13)]]
            x, y = nx, ny
        elif cmd in 'Cc':
            a, b, c_, d_, nx, ny = num(), num(), num(), num(), num(), num()
            if cmd == 'c': a, b, c_, d_, nx, ny = x + a, y + b, x + c_, y + d_, x + nx, y + ny
            cur += [((1 - u) ** 3 * x + 3 * (1 - u) ** 2 * u * a + 3 * (1 - u) * u * u * c_ + u ** 3 * nx,
                     (1 - u) ** 3 * y + 3 * (1 - u) ** 2 * u * b + 3 * (1 - u) * u * u * d_ + u ** 3 * ny) for u in [k / 16 for k in range(1, 17)]]
            x, y = nx, ny
        elif cmd in 'Zz':
            cur.append((sx, sy)); x, y = sx, sy
    if len(cur) > 1: out.append(cur)
    return out
def stroke(paths, w=STROKE):
    parts = []
    for d in paths:
        for pl in polylines(d):
            parts.append(LineString(pl).buffer(w / 2, cap_style='round', join_style='round', quad_segs=14))
    return parts

GLYPHS = {}   # name -> (advance in dna units, shapely geometry in dna units)
CMAP = {}
def put(ch, w, parts, name=None):
    name = name or ('uni%04X' % ord(ch))
    GLYPHS[name] = (w + TRACK, unary_union(parts) if parts else None)
    if ch is not None: CMAP[ord(ch)] = name

for ch, g in G.items():
    parts = stroke(g.get('d', []))
    for dx in g.get('dot', []): parts.append(hexagon(dx, 12, 14))                      # the dot is a cell
    if 'hex' in g: parts.append(hexagon(g['w'] / 2, 78 if g.get('mid') else 126, g['hex']))
    put(ch, g['w'], parts)
CMAP[0xA0] = CMAP[0x20]
for ch, (w, d) in CAPS.items(): put(ch, w, stroke(d))
lower = lambda c: G[c]
# ü ö ä and their capitals: two small cells, as the coronet's ü is cut (cells at x=32 and x=80 over u)
for base, ch in (('u', 'ü'), ('o', 'ö'), ('a', 'ä')):
    w = G[base]['w']; put(ch, w, stroke(G[base]['d']) + [hexagon(w / 2 - 24, 14, 10), hexagon(w / 2 + 24, 14, 10)])
for base, ch in (('U', 'Ü'), ('O', 'Ö'), ('A', 'Ä')):
    w, d = CAPS[base]; put(ch, w, stroke(d) + [hexagon(w / 2 - 24, -26, 10), hexagon(w / 2 + 24, -26, 10)])
# the latvian court, capitals
for base, ch, mk in (('A', 'Ā', 'm'), ('E', 'Ē', 'm'), ('I', 'Ī', 'm'), ('U', 'Ū', 'm'), ('C', 'Č', 'c'), ('S', 'Š', 'c'), ('Z', 'Ž', 'c')):
    w, d = CAPS[base]; put(ch, w, stroke(d + (CMACRON(w) if mk == 'm' else CCARON(w))))
for base, ch, x in (('G', 'Ģ', 70), ('K', 'Ķ', 50), ('L', 'Ļ', 40), ('N', 'Ņ', 58)):
    w, d = CAPS[base]; put(ch, w, stroke(d + COMMA_B(x)))
put('-', 72, stroke(['M10,90 L62,90'])); put('–', 100, stroke(['M10,90 L90,90'])); put('—', 150, stroke(['M10,90 L140,90']))
put("'", 28, stroke(['M14,0 L14,26'])); put('’', 28, stroke(['M16,0 Q22,10 10,26']))
put(',', 40, stroke(['M22,128 Q30,138 16,164']))
# ── the crest's own signs as sigils (paths copied from the achievement, scaled to the letter grid)
def scaled(paths, s, tx, ty):
    out = []
    for d in paths:
        for pl in polylines(d): out.append('M' + ' L'.join('%g,%g' % (px * s + tx, py * s + ty) for px, py in pl))
    return out
AUSEKLIS = ['M-15,-15 L15,-15 L15,15 L-15,15 Z', 'M0,-21 L21,0 L0,21 L-21,0 Z', 'M0,-21 L0,-40 M-9,-40 L9,-40', 'M0,21 L0,40 M-9,40 L9,40', 'M-21,0 L-40,0 M-40,-9 L-40,9', 'M21,0 L40,0 M40,-9 L40,9',
            'M-15,-15 L-29,-29 M-35,-23 L-23,-35', 'M15,-15 L29,-29 M23,-35 L35,-23', 'M-15,15 L-29,29 M-35,23 L-23,35', 'M15,15 L29,29 M23,35 L35,23']
JUMIS = ['M-26,15 L0,-15 L26,15', 'M-26,-15 L0,15 L26,-15', 'M-26,15 L-34,7 M26,15 L34,7 M-26,-15 L-34,-7 M26,-15 L34,-7']
MARA = ['M0,-20 L0,20 M-20,0 L20,0', 'M-8,-20 L8,-20 M-8,20 L8,20 M-20,-8 L-20,8 M20,-8 L20,8']
SAULE = ['M34,0 a34,34 0 1,0 0.1,0'.replace('M34,0', 'M0,-34')] + ['M%g,%g L%g,%g' % (40 * math.cos(math.radians(a)), 40 * math.sin(math.radians(a)), 60 * math.cos(math.radians(a)), 60 * math.sin(math.radians(a))) for a in range(0, 360, 22)][:16]
HEART = 'M0,-6 C-5,-15 -18,-13 -18,-2 C-18,8 -7,14 0,20 C7,14 18,8 18,-2 C18,-13 5,-15 0,-6 Z'
put('✶', 150, stroke(scaled(AUSEKLIS, 1.7, 75, 72), 12))        # ✶ auseklis, the morning star
put('‡', 140, stroke(scaled(JUMIS, 1.9, 70, 80), 12))           # ‡ jumis, two ears grown together
put('✚', 110, stroke(scaled(MARA, 2.2, 55, 84), 12))            # ✚ māra's cross
put('☼', 150, stroke(scaled(SAULE, 1.15, 75, 72), 10))          # ☼ saule
put('⬡', 124, stroke(['M' + ' L'.join('%g,%g' % p for p in list(hexagon(62, 84, 54).exterior.coords))], 12))   # ⬡ the cell
put('⬢', 124, [hexagon(62, 84, 60)])                            # ⬢ the cell, full
hp = Polygon(polylines(scaled([HEART], 3.4, 66, 70)[0])[0])
put('♥', 132, [hp.buffer(4, join_style='round')])               # ♥ the bond, full
put('♡', 132, [hp.exterior.buffer(6, cap_style='round', join_style='round')])   # ♡ the bond

def compile_font(out):
    order = ['.notdef'] + sorted(GLYPHS)
    glyphs, metrics = {}, {}
    def draw(g, adv):
        pen = TTGlyphPen(None)
        if g is not None and not g.is_empty:
            for p in [q for q in getattr(g, 'geoms', [g]) if q.geom_type == 'Polygon']:
                p = orient(p.simplify(0.12), sign=-1.0)
                for ring in [p.exterior] + list(p.interiors):
                    pts = [(round((x + TRACK / 2) * K), round((BASE - y) * K)) for x, y in ring.coords[:-1]]
                    if len(pts) >= 3:
                        pen.moveTo(pts[0]); [pen.lineTo(q) for q in pts[1:]]; pen.closePath()
        return pen.glyph()
    nd = Polygon([(0, 0), (80, 0), (80, 140), (0, 140)]).difference(Polygon([(12, 12), (68, 12), (68, 128), (12, 128)]))
    glyphs['.notdef'] = draw(nd, 98); metrics['.notdef'] = (98 * K, 0)
    for nm in order[1:]:
        adv, g = GLYPHS[nm]; gl = draw(g, adv); glyphs[nm] = gl
        metrics[nm] = (int(adv * K), min((x for x, y in gl.coordinates), default=0) if getattr(gl, 'numberOfContours', 0) > 0 else 0)
    fb = FontBuilder(1000, isTTF=True)
    fb.setupGlyphOrder(order); fb.setupCharacterMap(CMAP); fb.setupGlyf(glyphs); fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=960, descent=-260)
    fb.setupNameTable({'familyName': 'burti', 'styleName': 'Regular', 'uniqueFontIdentifier': 'burti-1.0-2026-09-19', 'fullName': 'burti', 'psName': 'burti-Regular', 'version': 'Version 1.000',
                       'designer': 'house von Zutphen — KinG bEe LoVis',
                       'description': 'burti: the letterform of the .a/.b names. monoline 16, round caps, the dot is a cell. lowercase and the latvian court are the original dna; capitals and sigils are cut to the same grid.'})
    fb.setupOS2(sTypoAscender=960, sTypoDescender=-260, sTypoLineGap=0, usWinAscent=960, usWinDescent=260, sxHeight=500, sCapHeight=700, achVendID='BEE ')
    fb.setupPost(); fb.save(out + '.ttf')
    f = TTFont(out + '.ttf'); f.flavor = 'woff2'; f.save(out + '.woff2')
    return len(order), len(CMAP)

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'burti')
    print(compile_font(out), os.path.getsize(out + '.ttf'), os.path.getsize(out + '.woff2'))
