import { Rng } from '../core/rng';
import { img } from './assets';
import { TILE, MINERALS, T, isOre, isRock, isLava } from '../data/spec';

/** How many ore sprites the generated sheet supplies (ids 0..9). */
const ORE_SPRITES = 10;

/**
 * Drop a generated sprite into a tile, jittered a little so neighbouring
 * tiles of the same ore don't line up into an obvious grid.
 */
function stamp(
  g: CanvasRenderingContext2D, sprite: HTMLImageElement | null, r: Rng, scale: number,
): void {
  if (!sprite) return;
  const w = sprite.width * scale, h = sprite.height * scale;
  const x = (TILE - w) / 2 + (r.next() * 8 - 4);
  const y = (TILE - h) / 2 + (r.next() * 8 - 4);
  const sm = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = true;
  g.drawImage(sprite, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  g.imageSmoothingEnabled = sm;
}

/**
 * Procedural pixel-art tile textures.
 *
 * Look target: the original's warm, bright, "homey" underground — fine
 * reddish-brown speckled soil, fully lit at every depth, with excavated
 * tunnels showing as olive-green rounded corridors. Deliberately NOT a
 * dark atmospheric cave game.
 *
 * All original. Nothing here derives from the extracted reference art.
 */

const PX = 2;                 // art-pixel size -> 25x25 logical grid per tile
const GRID = TILE / PX;

/**
 * Soil palettes by depth stratum: [base, dark, light, accent].
 * The drift from top to bottom is deliberately gentle — the original stays
 * recognisably brown for most of the descent and only turns cold near Hell.
 */
const STRATA: [string, string, string, string][] = [
  ['#7a4a33', '#5a3524', '#94614a', '#6a3f2b'],
  ['#74462f', '#553122', '#8e5c45', '#653b28'],
  ['#6e4230', '#502e21', '#885843', '#603826'],
  ['#684030', '#4b2c20', '#825440', '#5b3524'],
  ['#5f3d31', '#452a21', '#79503f', '#533223'],
  ['#563a33', '#3e2822', '#6e4b3e', '#4a2f26'],
  ['#4a3630', '#342422', '#5f4239', '#3f2a24'],
  ['#3b2e2c', '#28201f', '#4c3a35', '#31241f'],
];

/** Excavated-tunnel green, per stratum. The original's signature colour. */
const CAVITY = [
  '#4e5c28', '#4a5726', '#455024', '#3f4922',
  '#39421f', '#333b1c', '#2d3419', '#252b15',
];

export const BANDS = STRATA.length;

export function bandForRow(y: number, worldH: number): number {
  return Math.min(BANDS - 1, Math.floor((y / worldH) * BANDS));
}

export function cavityColor(band: number): string {
  return CAVITY[Math.max(0, Math.min(CAVITY.length - 1, band))];
}

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
  g.fillRect(x * PX, y * PX, PX, PX);
}

/** Dense fine speckle — the original soil reads as noisy grain, not blobs. */
function drawDirt(g: CanvasRenderingContext2D, r: Rng, band: number): void {
  const [base, dark, light, accent] = STRATA[band];
  g.fillStyle = base;
  g.fillRect(0, 0, TILE, TILE);

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const n = r.next();
      if (n < 0.26) px(g, x, y, dark);
      else if (n < 0.48) px(g, x, y, light);
      else if (n < 0.62) px(g, x, y, accent);
    }
  }
}

/**
 * Ore reads as a cluster of angular crystal shards sitting in the soil,
 * which is far more legible in motion than a soft blob.
 */
function drawOre(g: CanvasRenderingContext2D, r: Rng, id: number): void {
  const m = MINERALS[id];
  if (!m) return;

  const shards = 3 + r.int(3);
  for (let i = 0; i < shards; i++) {
    const cx = 5 + r.int(GRID - 10);
    const cy = 5 + r.int(GRID - 10);
    const len = 3 + r.int(4);
    const lean = r.int(3) - 1;

    // dark seat so the shard separates from the soil
    for (let s = -1; s <= len; s++) {
      const w = s === -1 || s === len ? 1 : 2;
      for (let d = -w - 1; d <= w + 1; d++)
        px(g, cx + d + lean * s * 0.3, cy + s - len / 2, 'rgba(0,0,0,.5)');
    }
    // shard body, tapering at both ends
    for (let s = 0; s < len; s++) {
      const t = 1 - Math.abs(s - (len - 1) / 2) / ((len - 1) / 2 || 1);
      const w = Math.max(0, Math.round(t * 2));
      for (let d = -w; d <= w; d++)
        px(g, cx + d + lean * s * 0.3, cy + s - len / 2, m.color);
    }
    // specular edge
    px(g, cx - 1 + lean * 0.3, cy - Math.floor(len / 2) + 1, '#ffffff');
  }
}

function drawRock(g: CanvasRenderingContext2D, r: Rng): void {
  g.fillStyle = '#8d8b86';
  g.fillRect(0, 0, TILE, TILE);
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      const n = r.next();
      if (n < 0.26) px(g, x, y, '#6e6c68');
      else if (n < 0.46) px(g, x, y, '#a5a39d');
      else if (n < 0.54) px(g, x, y, '#57554f');
    }
  // heavy rounded shading so boulders read as solid and immovable
  const grd = g.createRadialGradient(TILE * 0.35, TILE * 0.3, 2, TILE * 0.5, TILE * 0.5, TILE * 0.8);
  grd.addColorStop(0, 'rgba(255,255,255,.18)');
  grd.addColorStop(1, 'rgba(0,0,0,.42)');
  g.fillStyle = grd;
  g.fillRect(0, 0, TILE, TILE);
}

function drawLava(g: CanvasRenderingContext2D, r: Rng): void {
  g.fillStyle = '#5e1f12';
  g.fillRect(0, 0, TILE, TILE);
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      const n = r.next();
      if (n < 0.30) px(g, x, y, '#8f3416');
      else if (n < 0.50) px(g, x, y, '#d2601f');
      else if (n < 0.60) px(g, x, y, '#f7a838');
      else if (n < 0.64) px(g, x, y, '#ffd98a');
    }
}

function drawGas(g: CanvasRenderingContext2D, r: Rng, band: number): void {
  drawDirt(g, r, band);
  for (let i = 0; i < 6; i++) {
    const cx = 3 + r.int(GRID - 6), cy = 3 + r.int(GRID - 6), rad = 2 + r.int(2);
    for (let y = -rad; y <= rad; y++)
      for (let x = -rad; x <= rad; x++)
        if (x * x + y * y <= rad * rad && r.next() < 0.6)
          px(g, cx + x, cy + y, '#9fbf5e');
  }
}

function drawBedrock(g: CanvasRenderingContext2D, r: Rng): void {
  g.fillStyle = '#2a2026';
  g.fillRect(0, 0, TILE, TILE);
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      const n = r.next();
      if (n < 0.2) px(g, x, y, '#3a2c34');
      else if (n < 0.3) px(g, x, y, '#1c151a');
    }
}

export function tileTexture(code: number, variant: number, band: number): HTMLCanvasElement {
  const key = `${code}|${variant}|${band}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const [c, g] = make();
  const r = new Rng(key);

  if (code === T.BEDROCK || code <= -8) drawBedrock(g, r);
  else if (isRock(code)) { drawRock(g, r); stamp(g, img('rock_0'), r, 0.9); }
  else if (isLava(code)) drawLava(g, r);
  else if (code === T.GAS) drawGas(g, r, band);
  else if (isOre(code)) {
    drawDirt(g, r, band);
    const id = code - 6;
    const sprite = img(id < ORE_SPRITES ? `ore_${id}` : 'artifact_0');
    if (sprite) stamp(g, sprite, r, 0.78);
    else drawOre(g, r, id);
  } else drawDirt(g, r, band);

  cache.set(key, c);
  return c;
}

/** Surface ground band — grassless dusty crust with a darker topsoil line. */
export function surfaceTexture(): HTMLCanvasElement {
  const key = 'surface-ground';
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = make();
  const r = new Rng('surface-ground');
  drawDirt(g, r, 0);
  g.fillStyle = '#4a2c1c';
  g.fillRect(0, 0, TILE, 6);
  g.fillStyle = '#96674a';
  g.fillRect(0, 6, TILE, 2);
  cache.set(key, c);
  return c;
}

/**
 * The pod: stubby olive-drab tracked digger with a conical drill bit.
 * Chunky, high-contrast, readable at a glance against brown soil.
 */
/**
 * Drill bit palettes, one per tier: [dark, mid, light].
 * Each tier is coloured as the mineral it's named after — the same trick the
 * original uses, and it makes an upgrade instantly legible on screen.
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
 * Recolour the generated machine per upgrade tier.
 *
 * The art is authored facing right with the drill on the front third, so the
 * hull tint is masked to the rear ~62% and the drill tint to the front ~38%.
 * `source-atop` keeps the tint inside the sprite's own alpha, and the low
 * opacity preserves the original shading and rivet detail underneath.
 */
function podFromArt(
  art: HTMLImageElement, facing: 1 | -1, drill: number, hull: number,
): HTMLCanvasElement {
  const w = art.width, h = art.height;
  const [c, g] = make(w, h);

  g.imageSmoothingEnabled = true;
  g.drawImage(art, 0, 0, w, h);

  const split = Math.round(w * 0.62);
  g.globalCompositeOperation = 'source-atop';

  if (hull > 0) {
    g.globalAlpha = 0.16 + hull * 0.045;          // up to ~0.43 at tier 6
    g.fillStyle = HULL_COLORS[Math.min(hull, 6)][1];
    g.fillRect(0, 0, split, h);
  }
  if (drill > 0) {
    g.globalAlpha = 0.3 + drill * 0.06;           // drills read strongly
    g.fillStyle = DRILL_COLORS[Math.min(drill, 6)][1];
    g.fillRect(split, 0, w - split, h);
  }

  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';

  if (facing === 1) return c;

  // mirror for the other heading
  const [m, mg] = make(w, h);
  mg.imageSmoothingEnabled = true;
  mg.translate(w, 0);
  mg.scale(-1, 1);
  mg.drawImage(c, 0, 0);
  return m;
}

export function podSprite(
  facing: 1 | -1, drill = 0, hull = 0, engine = 0,
): HTMLCanvasElement {
  const key = `pod|${facing}|${drill}|${hull}|${engine}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const art = img('pod');
  if (art) {
    const built = podFromArt(art, facing, drill, hull);
    cache.set(key, built);
    return built;
  }

  const S = 2, W = 28, H = 20;
  const [c, g] = make(W * S, H * S);

  const put = (x: number, y: number, w: number, h: number, col: string) => {
    g.fillStyle = col;
    const X = facing === 1 ? x : W - x - w;
    g.fillRect(X * S, y * S, w * S, h * S);
  };

  const [dShadow, dBody, dLight] = DRILL_COLORS[Math.min(drill, 6)];
  const [hShadow, hBody, hLight, hTrim] = HULL_COLORS[Math.min(hull, 6)];

  // ---- drill: longer and blockier with tier, coloured by its mineral
  const dLen = 2 + Math.ceil(drill / 2);          // 2..5 segments
  let dx = 19;
  for (let i = 0; i < dLen; i++) {
    const inset = Math.min(3, i);
    put(dx, 7 + inset, 2, Math.max(2, 6 - inset * 2), i === 0 ? dShadow : dBody);
    dx += 2;
  }
  put(dx - 2, 9, 2, 2, dLight);                    // bright tip
  put(19, 6, 2, 1, dLight);                        // collar highlight
  put(19, 13, 2, 1, dShadow);

  // ---- hull
  put(3, 6, 16, 9, hBody);
  put(3, 6, 16, 2, hLight);
  put(3, 13, 16, 2, hShadow);
  put(2, 8, 1, 5, hShadow);

  // extra bolted armour plates appear as the hull tier climbs
  if (hull >= 2) { put(4, 8, 3, 5, hLight); put(4, 8, 3, 1, hTrim); }
  if (hull >= 4) { put(8, 12, 9, 2, hTrim); }
  if (hull >= 6) {                                  // energy shield shimmer
    put(2, 5, 18, 1, '#a8dcf5');
    put(2, 15, 18, 1, '#7ab6d8');
  }

  // ---- cockpit
  put(11, 8, 6, 4, '#232a17');
  put(12, 9, 4, 2, '#5fa8c4');
  put(12, 9, 2, 1, '#bfe9f5');

  put(5, 9, 1, 1, hTrim);
  put(7, 9, 1, 1, hTrim);

  // ---- treads
  put(2, 15, 17, 4, '#33372a');
  for (let i = 0; i < 5; i++) put(3 + i * 3, 16, 2, 2, '#5a5f47');
  put(2, 15, 17, 1, '#6e735a');

  // ---- thrusters grow with engine tier
  const nozzle = 2 + Math.floor(engine / 3);        // 2..4 wide
  const nozzleCol = engine >= 5 ? '#d8c48a' : engine >= 3 ? '#b0b4a0' : '#8a8f78';
  put(5, 19, nozzle, 1, nozzleCol);
  put(12, 19, nozzle, 1, nozzleCol);

  cache.set(key, c);
  return c;
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
