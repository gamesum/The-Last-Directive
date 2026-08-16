import { Rng } from '../core/rng';
import { TILE, MINERALS, EARTH_H } from '../data/spec';

/**
 * Procedural pixel-art terrain.
 *
 * Look target, taken from the original's own screenshots:
 *
 *  - The soil is ONE continuous field of fine, low-contrast noise. It does not
 *    tile per-cell; there are no grid seams anywhere. Its colour barely moves
 *    over the whole descent — the dirt at -37ft and at -1850ft is nearly the
 *    same brown.
 *  - The excavated space carries the depth gradient instead: a warm tan at the
 *    surface, sliding through khaki to a deep olive-green by ~2000ft and to
 *    near-black at the bottom. That separation — static blocks, moving
 *    background — is what makes the descent read.
 *  - Ore, rock and lava are shapes *embedded in* the soil, with the soil
 *    running continuously around and behind them. They are not tiles.
 *
 * All original. Nothing here derives from the extracted reference art.
 */

const PX = 2;                  // art-pixel size
const GRID = TILE / PX;        // 25 art-pixels per tile edge

/**
 * The soil is drawn as windows into a large tiling sheet, so neighbouring
 * cells are continuous. The sheet is a whole number of tiles wide, which is
 * what makes the window arithmetic line up exactly.
 */
const SHEET_TILES = 6;
const SHEET = TILE * SHEET_TILES;

/** How many depth steps the palettes are sampled into. */
export const SUB = 24;

// ---------------------------------------------------------------- colour
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

type RGB = [number, number, number];

function mix(a: RGB, b: RGB, k: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  ];
}

const css = (c: RGB, alpha = 1) =>
  alpha >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;

/** Sample a [stop, colour] ramp at t in 0..1. */
function ramp(stops: [number, RGB][], t: number): RGB {
  t = clamp01(t);
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (t > stops[i][0]) continue;
    const [t0, c0] = stops[i - 1];
    const [t1, c1] = stops[i];
    return mix(c0, c1, t1 === t0 ? 0 : (t - t0) / (t1 - t0));
  }
  return stops[stops.length - 1][1];
}

/**
 * Soil base colour. Deliberately almost flat — the original's dirt stays the
 * same reddish brown for nearly the whole game and only cools right at the
 * bottom. Depth is communicated by the excavated space, not by this.
 */
const SOIL: [number, RGB][] = [
  [0.00, [122, 78, 54]],
  [0.30, [116, 73, 50]],
  [0.60, [104, 66, 47]],
  [0.82, [ 84, 56, 44]],
  [1.00, [ 54, 40, 38]],
];

/**
 * Excavated space. This is the gradient: warm tan just under the outpost,
 * khaki, then the olive-green the original is remembered for, then dark.
 */
const CAVITY: [number, RGB][] = [
  [0.00, [176, 150, 104]],
  [0.06, [150, 132,  86]],
  [0.14, [108, 110,  60]],
  [0.25, [ 62,  74,  38]],
  [0.45, [ 48,  58,  32]],
  [0.65, [ 36,  44,  26]],
  [0.85, [ 26,  32,  20]],
  [1.00, [ 16,  20,  14]],
];

/** Depth step for a world row, 0..SUB-1. */
export function subForRow(y: number, worldH = EARTH_H): number {
  return Math.max(0, Math.min(SUB - 1, Math.round((y / worldH) * (SUB - 1))));
}

/**
 * Excavated-space colour at a world y in pixels.
 *
 * Sampled continuously rather than per depth band, because the background is
 * poured into the cavity mask as one screen-space gradient — it has to be a
 * smooth function of depth or a seam appears wherever bands would meet.
 */
export function cavityColorAtY(worldY: number): string {
  return css(ramp(CAVITY, worldY / (EARTH_H * TILE)));
}

// ---------------------------------------------------------------- canvases
const cache = new Map<string, HTMLCanvasElement>();

function make(w = TILE, h = TILE): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  return [c, g];
}

function px(g: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  g.fillStyle = color;
  g.fillRect(Math.round(x) * PX, Math.round(y) * PX, PX, PX);
}

// ---------------------------------------------------------------- soil
/**
 * One tiling sheet of soil per depth step. Because every cell reads a window
 * out of this by world coordinate, adjacent cells are genuinely continuous —
 * the grid disappears, which is the single biggest difference between this
 * and a per-tile texture.
 */
function soilSheet(sub: number): HTMLCanvasElement {
  const key = `soil|${sub}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const [c, g] = make(SHEET, SHEET);
  const t = sub / (SUB - 1);
  const base = ramp(SOIL, t);
  const dark = mix(base, [0, 0, 0], 0.34);
  const light = mix(base, [255, 226, 190], 0.30);
  const accent = mix(base, [40, 16, 10], 0.22);

  g.fillStyle = css(base);
  g.fillRect(0, 0, SHEET, SHEET);

  // Fine, dense, low-contrast grain. The original's dirt is noisy at the
  // pixel level and almost featureless above it.
  const r = new Rng(`soil-grain-${sub}`);
  const n = SHEET / PX;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v = r.next();
      if (v < 0.28) px(g, x, y, css(dark));
      else if (v < 0.50) px(g, x, y, css(light));
      else if (v < 0.64) px(g, x, y, css(accent));
    }
  }

  // A few very soft large-scale patches so the field isn't perfectly uniform
  // at a distance. Drawn nine times so they wrap across the sheet edges.
  for (let i = 0; i < 18; i++) {
    const bx = r.next() * SHEET;
    const by = r.next() * SHEET;
    const rad = 26 + r.next() * 54;
    const col = r.next() < 0.5 ? dark : light;
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const gx = bx + ox * SHEET, gy = by + oy * SHEET;
        if (gx < -rad || gx > SHEET + rad || gy < -rad || gy > SHEET + rad) continue;
        const grd = g.createRadialGradient(gx, gy, 0, gx, gy, rad);
        grd.addColorStop(0, css(col, 0.14));
        grd.addColorStop(1, css(col, 0));
        g.fillStyle = grd;
        g.fillRect(gx - rad, gy - rad, rad * 2, rad * 2);
      }
    }
  }

  cache.set(key, c);
  return c;
}

/** Blit the soil window belonging to world cell (tx,ty) at screen (sx,sy). */
export function drawSoil(
  g: CanvasRenderingContext2D, tx: number, ty: number, sx: number, sy: number, sub: number,
): void {
  const sheet = soilSheet(sub);
  const u = (((tx % SHEET_TILES) + SHEET_TILES) % SHEET_TILES) * TILE;
  const v = (((ty % SHEET_TILES) + SHEET_TILES) % SHEET_TILES) * TILE;
  g.drawImage(sheet, u, v, TILE, TILE, sx, sy, TILE, TILE);
}

// ---------------------------------------------------------------- inclusions
/**
 * Angular shards, the shape language the original uses for every embedded
 * material — ore, lava and the pale streaks alike. Flat-shaded with a dark
 * seat underneath so they sit in the soil rather than on it.
 */
function shards(
  g: CanvasRenderingContext2D, r: Rng,
  body: string, edge: string, count: number, spread: number,
): void {
  for (let i = 0; i < count; i++) {
    const cx = GRID / 2 + (r.next() * 2 - 1) * spread;
    const cy = GRID / 2 + (r.next() * 2 - 1) * spread;
    const len = 4 + r.int(5);
    const lean = (r.next() * 2 - 1) * 0.5;

    for (let s = 0; s < len; s++) {
      // taper to a point at both ends
      const k = 1 - Math.abs(s - (len - 1) / 2) / ((len - 1) / 2 || 1);
      const w = Math.max(0, Math.round(k * 2));
      const x = cx + lean * s;
      const y = cy + s - len / 2;
      for (let d = -w - 1; d <= w + 1; d++) px(g, x + d, y, 'rgba(0,0,0,.40)');
      for (let d = -w; d <= w; d++) px(g, x + d, y, body);
      if (w > 0) px(g, x - w, y, edge);
    }
  }
}

/**
 * Ore as it appears IN the ground: embedded shards of the mineral's colour,
 * with the soil continuing around them. Deliberately not the same art as the
 * inventory icon — the generated sprites read as objects sitting on top of
 * the dirt, which is exactly what we don't want here.
 */
export function oreOverlay(id: number, variant: number): HTMLCanvasElement {
  const key = `ore|${id}|${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const [c, g] = make();
  const r = new Rng(key);
  const m = MINERALS[id];
  const body = m ? m.color : '#cccccc';

  shards(g, r, body, '#ffffff', 3 + r.int(3), 5);

  // loose flecks bedded into the surrounding soil, so the deposit reads as a
  // seam running through the rock rather than a single lump
  for (let i = 0; i < 6; i++) {
    const fx = 2 + r.int(GRID - 4), fy = 2 + r.int(GRID - 4);
    px(g, fx, fy + 1, 'rgba(0,0,0,.4)');
    px(g, fx, fy, body);
  }

  cache.set(key, c);
  return c;
}

/** Grey boulders: lumpy, rounded, clearly a different material to the soil. */
export function rockOverlay(variant: number): HTMLCanvasElement {
  const key = `rock|${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const [c, g] = make();
  const r = new Rng(key);

  // irregular rounded mass, built from overlapping discs so the silhouette is
  // lumpy rather than a rounded square
  const mass = new Path2D();
  const cx = TILE / 2 + (r.next() * 6 - 3);
  const cy = TILE / 2 + (r.next() * 6 - 3);
  mass.arc(cx, cy, 15 + r.next() * 3, 0, Math.PI * 2);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r.next();
    const d = 7 + r.next() * 5;
    mass.moveTo(cx + Math.cos(a) * d + 9, cy + Math.sin(a) * d);
    mass.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 8 + r.next() * 3, 0, Math.PI * 2);
  }

  g.fillStyle = 'rgba(0,0,0,.45)';
  g.save();
  g.translate(1, 2);
  g.fill(mass);                       // contact shadow, offset down-right
  g.restore();

  g.fillStyle = '#8d8b86';
  g.fill(mass);

  // speckle and shading, confined to the boulder
  g.save();
  g.clip(mass);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const v = r.next();
      if (v < 0.24) px(g, x, y, '#6e6c68');
      else if (v < 0.42) px(g, x, y, '#a5a39d');
      else if (v < 0.49) px(g, x, y, '#57554f');
    }
  }
  const grd = g.createRadialGradient(cx - 6, cy - 7, 2, cx, cy, 24);
  grd.addColorStop(0, 'rgba(255,255,255,.22)');
  grd.addColorStop(1, 'rgba(0,0,0,.45)');
  g.fillStyle = grd;
  g.fillRect(0, 0, TILE, TILE);
  g.restore();

  cache.set(key, c);
  return c;
}

/** Lava: the same embedded-shard language, glowing. */
export function lavaOverlay(variant: number): HTMLCanvasElement {
  const key = `lava|${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const [c, g] = make();
  const r = new Rng(key);

  shards(g, r, '#d2601f', '#ffd98a', 4 + r.int(3), 6);
  // a warm bloom over the whole cell so it reads as hot
  const grd = g.createRadialGradient(TILE / 2, TILE / 2, 3, TILE / 2, TILE / 2, 24);
  grd.addColorStop(0, 'rgba(255,150,50,.30)');
  grd.addColorStop(1, 'rgba(255,120,30,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, TILE, TILE);

  cache.set(key, c);
  return c;
}

/** Gas pocket: sickly green haze bedded into the soil. */
export function gasOverlay(variant: number): HTMLCanvasElement {
  const key = `gas|${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const [c, g] = make();
  const r = new Rng(key);
  for (let i = 0; i < 5; i++) {
    const cx = 8 + r.next() * (TILE - 16);
    const cy = 8 + r.next() * (TILE - 16);
    const rad = 7 + r.next() * 9;
    const grd = g.createRadialGradient(cx, cy, 1, cx, cy, rad);
    grd.addColorStop(0, 'rgba(168,208,96,.62)');
    grd.addColorStop(1, 'rgba(140,180,80,0)');
    g.fillStyle = grd;
    g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  cache.set(key, c);
  return c;
}

export function bedrockTile(variant: number): HTMLCanvasElement {
  const key = `bedrock|${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const [c, g] = make();
  const r = new Rng(key);
  g.fillStyle = '#2a2026';
  g.fillRect(0, 0, TILE, TILE);
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      const v = r.next();
      if (v < 0.2) px(g, x, y, '#3a2c34');
      else if (v < 0.3) px(g, x, y, '#1c151a');
    }
  cache.set(key, c);
  return c;
}

/** Surface crust — dusty topsoil with a darker skin, matching the outpost. */
export function surfaceTexture(): HTMLCanvasElement {
  const key = 'surface-ground';
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = make();
  g.drawImage(soilSheet(0), 0, 0, TILE, TILE, 0, 0, TILE, TILE);
  g.fillStyle = '#4a2c1c';
  g.fillRect(0, 0, TILE, 6);
  g.fillStyle = '#96674a';
  g.fillRect(0, 6, TILE, 2);
  cache.set(key, c);
  return c;
}

// ---------------------------------------------------------------- the pod
/**
 * Drill palettes, one per tier: coloured as the mineral each is named after,
 * so an upgrade is legible the moment you leave the shop.
 */
const DRILL_COLORS: [string, string, string][] = [
  ['#7d7b75', '#b9b7b0', '#efeee9'], // Stock      — plain steel
  ['#8d949c', '#cdd6de', '#f4f8fb'], // Silvide    — silver
  ['#a97c18', '#f2c13c', '#ffe9a0'], // Goldium    — gold
  ['#1d8a48', '#3fd97a', '#b0ffcf'], // Emerald
  ['#a01430', '#f0405c', '#ffb0c0'], // Ruby
  ['#4fa8bd', '#9ff0ff', '#ffffff'], // Diamond
  ['#149a7e', '#46f0c0', '#c8fff0'], // Amazonite
];

/** Hull palettes: [shadow, body, highlight, trim]. */
const HULL_COLORS: [string, string, string, string][] = [
  ['#4c5628', '#6d7a3c', '#8a9950', '#9aa860'], // Stock
  ['#5a4a2c', '#7a6a48', '#9a8a60', '#b0a070'], // Ironium
  ['#6a4a22', '#8a6b3a', '#ab8a52', '#c4a166'], // Bronzium
  ['#4a545a', '#6e7a80', '#8f9ba2', '#a8b4bb'], // Steel
  ['#5e6c72', '#8a9aa0', '#adbdc4', '#c8d6dc'], // Platinium
  ['#3d4a60', '#5f6f8a', '#8296b4', '#9db0cc'], // Einsteinium
  ['#2e4d63', '#4a6f8a', '#77a6c4', '#a8dcf5'], // Energy-Shielded
];

/**
 * The pod, split into a hull and a separate drill head.
 *
 * The original swaps between distinct sprites for driving, flying and digging
 * down or sideways, so the drill always points at what it is cutting. Keeping
 * the drill as its own piece lets us do the same with one set of art: the
 * renderer pivots it about `seam` to aim it.
 *
 * Everything here is authored facing RIGHT. The renderer mirrors.
 */
export interface PodParts {
  /** Hull, drawn at (-w/2, -h/2) in pod-centred coords. */
  body: HTMLCanvasElement;
  /** Drill head, drawn at (0, -drillMidY) after translating to the pivot. */
  drill: HTMLCanvasElement;
  w: number;
  h: number;
  /** x of the hull/drill seam within the full sprite — the drill's pivot. */
  seam: number;
  /**
   * Vertical centre of the drill. When the head swings under the machine its
   * sprite-space y becomes screen-space x, so pivoting about the canvas
   * centre would throw it off to one side; this keeps the bit on the axis it
   * is cutting along.
   */
  drillMidY: number;
  /** Thruster mouths in pod-centred coords, so the flame starts at the bell. */
  nozzles: { x: number; y: number }[];
}

/**
 * Machine geometry, in game pixels.
 *
 * BODY_H matches the collision box height exactly (2 * COLLIDE_HH). Get this
 * wrong and the machine visibly floats: the box rests on the ground while the
 * shorter sprite hangs above it, leaving a gap under the tracks.
 */
const BODY_W = 34;
const BODY_H = 34;
/** The bit overlaps the mounting plate slightly, so there is no visible join. */
const SEAM = BODY_W - 2;
/** Vertical centre of the mounting plate, and so of the bit. */
const MOUNT_Y = 17;
/** Belly gap between the two track bogies, where the thrusters hang. */
const NOZZLE_X = [10, 18];
const NOZZLE_TOP = 22;
const NOZZLE_BOTTOM = 31;

/**
 * The machine, drawn in code one game pixel at a time.
 *
 * This was generated art for a while and it did not work. The image models
 * produce a detailed 1024px illustration *of* pixel art; the machine is drawn
 * at ~44px across, and everything that made the illustration good — rivets,
 * grilles, panel lines — turned to mush on the way down. The belly nozzles
 * came out about two pixels tall, which is why there was visibly nothing for
 * the thrusters to fire from. Generated art still does the job for the ore
 * and upgrade thumbnails, because those are shown at 54px where the detail
 * survives. At machine scale, hand-placed pixels win.
 *
 * Authored facing RIGHT; the renderer mirrors. The hull and the bit are built
 * as separate canvases so the bit can be aimed without touching the hull.
 */
function buildMachine(drill: number, hull: number, engine: number): PodParts {
  const [hShadow, hBody, hLight, hTrim] = HULL_COLORS[Math.min(hull, 6)];
  const [dShadow, dBody, dLight] = DRILL_COLORS[Math.min(drill, 6)];

  const [body, g] = make(BODY_W, BODY_H);
  const r = (x: number, y: number, w: number, h: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };

  const OUTLINE = '#151a0d';

  // ---- chassis skirt, laid down first so everything else sits on it
  r(2, 20, 30, 5, hShadow);
  r(2, 24, 30, 1, OUTLINE);

  // ---- rear engine block: grille and exhaust stacks, so the back reads as
  //      the back at a glance and the machine never looks reversed
  r(1, 7, 11, 14, hBody);
  r(1, 7, 11, 2, hLight);
  r(1, 19, 11, 2, hShadow);
  r(0, 9, 1, 11, OUTLINE);                     // rear bumper edge
  r(2, 10, 8, 8, '#20261a');
  for (let i = 0; i < 4; i++) r(3, 11 + i * 2, 6, 1, hShadow);

  const stacks = engine >= 4 ? 3 : 2;          // bigger engines vent harder
  for (let i = 0; i < stacks; i++) {
    r(3 + i * 3, 2 + i, 2, 6 - i, hShadow);
    r(3 + i * 3, 1 + i, 2, 1, '#17170f');
  }

  // ---- main hull
  r(12, 8, 12, 13, hBody);
  r(12, 8, 12, 2, hLight);
  r(12, 19, 12, 2, hShadow);
  r(12, 15, 12, 1, hShadow);                   // panel seam breaks up the mass
  if (hull >= 2) { r(13, 11, 5, 7, hLight); r(13, 11, 5, 1, hTrim); }
  if (hull >= 4) for (let i = 0; i < 5; i++) r(14 + i * 2, 17, 1, 1, hTrim);

  // ---- canopy, up front where the driver would sit
  r(17, 3, 10, 6, OUTLINE);
  r(18, 4, 8, 4, '#2f7f94');
  r(18, 4, 5, 2, '#6fd8e8');
  r(17, 2, 11, 1, hTrim);                      // brow visor

  // ---- sloped prow, stepped down to the mounting plate
  for (let i = 0; i < 8; i++) {
    const yTop = 8 + Math.floor(i * 0.85);
    r(24 + i, yTop, 1, 21 - yTop, hBody);
    r(24 + i, yTop, 1, 1, hLight);
  }
  r(31, MOUNT_Y - 3, 3, 6, hShadow);
  r(31, MOUNT_Y - 3, 3, 1, hTrim);

  if (hull >= 6) { r(1, 6, 27, 1, '#a8dcf5'); r(2, 25, 30, 1, '#7ab6d8'); }

  // ---- tracks, as two short bogies with a wide gap between them. The gap is
  //      the whole point: it is where the thrusters live, in clear air.
  const bogie = (bx: number, bw: number) => {
    r(bx, 25, bw, 9, '#191b16');
    r(bx, 25, bw, 1, '#3b4034');
    for (let i = 0; i + 3 <= bw - 1; i += 3) r(bx + 1 + i, 27, 2, 4, '#3a3f31');
    for (let i = 0; i < bw; i += 3) r(bx + i, 32, 2, 1, '#33372c');
    r(bx, 33, bw, 1, OUTLINE);
  };
  bogie(1, 8);
  bogie(24, 9);

  // ---- thruster bells, hanging in the gap between the bogies
  const mouth = 5 + (engine >= 3 ? 1 : 0);
  const bellH = 5;
  for (const nx of NOZZLE_X) {
    r(nx + 1, NOZZLE_TOP, 3, NOZZLE_BOTTOM - bellH - NOZZLE_TOP, '#4c5142');
    r(nx, NOZZLE_BOTTOM - bellH, mouth, bellH, '#5c6152');
    r(nx, NOZZLE_BOTTOM - bellH, mouth, 1, '#7e8570');       // rim catches light
    r(nx, NOZZLE_BOTTOM - 1, mouth, 1, '#241f18');           // dark mouth
    r(nx - 1, NOZZLE_BOTTOM - bellH, 1, bellH, OUTLINE);
    r(nx + mouth, NOZZLE_BOTTOM - bellH, 1, bellH, OUTLINE);
  }

  // ---- the bit, on its own canvas so it can be pivoted
  const bitLen = 11 + Math.ceil(drill / 2);
  const bitW = bitLen + 3;
  const [bit, bg] = make(bitW, BODY_H);
  const br = (x: number, y: number, w: number, h: number, col: string) => {
    bg.fillStyle = col;
    bg.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };

  const midY = MOUNT_Y;
  const BIT_OUTLINE = '#12100c';

  const halfAt = (i: number) => Math.max(1, Math.round(5 - (i / bitLen) * 4));

  // collar
  br(0, midY - 5, 3, 10, dShadow);
  br(0, midY - 5, 3, 1, dLight);
  br(0, midY + 4, 3, 1, BIT_OUTLINE);

  // cone: dark underside, lighter top, one bright lit edge, hard silhouette
  for (let i = 0; i < bitLen; i++) {
    const half = halfAt(i);
    br(3 + i, midY - half - 1, 1, 1, BIT_OUTLINE);
    br(3 + i, midY + half, 1, 1, BIT_OUTLINE);
    br(3 + i, midY - half, 1, half * 2, dShadow);
    br(3 + i, midY - half, 1, half, dBody);
    br(3 + i, midY - half, 1, 1, dLight);
  }

  // spiral flutes: diagonal bands, kept strictly inside the silhouette so no
  // stray pixels escape where the cone has narrowed to a point
  for (let band = 0; band < 3; band++) {
    for (let i = 1; i < bitLen; i++) {
      const half = halfAt(i);
      const y = midY - half + 1 + ((i + band * 4) % 6);
      if (y > midY - half && y < midY + half) br(3 + i, y, 1, 1, dShadow);
    }
  }

  return {
    body,
    drill: bit,
    w: SEAM + bitW,
    h: BODY_H,
    seam: SEAM,
    drillMidY: midY,
    nozzles: NOZZLE_X.map((nx) => ({
      x: nx + mouth / 2 - (SEAM + bitW) / 2,
      y: NOZZLE_BOTTOM - BODY_H / 2,
    })),
  };
}

const podCache = new Map<string, PodParts>();

export function podParts(drill = 0, hull = 0, engine = 0): PodParts {
  const key = `${drill}|${hull}|${engine}`;
  let hit = podCache.get(key);
  if (!hit) podCache.set(key, hit = buildMachine(drill, hull, engine));
  return hit;
}

/**
 * Derelict outpost skyline, parallaxed behind the surface. Silhouetted and
 * mostly unlit — "everyone is gone" stated in environmental terms.
 */
export function skylineTexture(): HTMLCanvasElement {
  const key = 'skyline';
  const hit = cache.get(key);
  if (hit) return hit;

  const W = 900, H = 260;
  const [c, g] = make(W, H);
  const r = new Rng('venice-skyline');
  const S = 3;

  const blk = (x: number, y: number, w: number, h: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(Math.round(x / S) * S, Math.round(y / S) * S,
               Math.round(w / S) * S, Math.round(h / S) * S);
  };

  let x = 40;
  while (x < W - 80) {
    const w = 40 + r.int(70), h = 24 + r.int(46);
    blk(x, H - h - 34, w, h, '#2a2038');
    x += w + 8 + r.int(26);
  }

  x = 40;
  while (x < W - 90) {
    const w = 34 + r.int(80);
    const h = 34 + r.int(84);
    const top = H - h - 26;
    blk(x, top, w, h, '#3a2c4c');
    blk(x, top, w, 4, '#4a3a60');

    for (let wy = top + 12; wy < H - 34; wy += 16)
      for (let wx = x + 8; wx < x + w - 8; wx += 14) {
        if (r.next() < 0.12) blk(wx, wy, 5, 6, '#e0a24a');
        else if (r.next() < 0.35) blk(wx, wy, 5, 6, '#2a1f38');
      }

    if (r.next() < 0.35) {
      const mx = x + w / 2, mh = 40 + r.int(60);
      const lean = r.int(2) ? 1 : -1;
      for (let s = 0; s < mh; s += 3) {
        blk(mx + lean * s * 0.18, top - s, 3, 3, '#352843');
        if (s % 15 === 0) blk(mx + lean * s * 0.18 - 6, top - s, 15, 3, '#352843');
      }
    }
    x += w + 14 + r.int(40);
  }

  const haze = g.createLinearGradient(0, H - 70, 0, H);
  haze.addColorStop(0, 'rgba(150,92,70,0)');
  haze.addColorStop(1, 'rgba(160,100,76,.9)');
  g.fillStyle = haze;
  g.fillRect(0, H - 70, W, 70);

  cache.set(key, c);
  return c;
}
