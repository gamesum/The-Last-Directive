import { World } from '../world/world';
import { Pod } from '../game/pod';
import {
  tileTexture, bandForRow, podSprite, cavityColor, skylineTexture, surfaceTexture,
} from './textures';
import { img } from './assets';
import { TILE, VIEW_W, VIEW_H, POD_HW, POD_HH, T, EARTH_H, SKY_ROWS } from '../data/spec';

export interface Camera { x: number; y: number }

/** Corner radius where excavated tunnel meets soil. The original's signature. */
const R = 14;

const backdrops: Record<string, HTMLImageElement | null> = { surface: null, deep: null };

export function loadBackdrop(name: 'surface' | 'deep', url: string): void {
  const img = new Image();
  img.onload = () => { backdrops[name] = img; };
  img.onerror = () => { backdrops[name] = null; };
  img.src = url;
}

/**
 * 1px-thin gradient strips, built once and stretched. Nearest-neighbour
 * replication along the thin axis keeps them exact while costing nothing.
 */
function strip(w: number, h: number, x1: number, y1: number, a: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, x1, y1);
  gr.addColorStop(0, `rgba(0,0,0,${a})`);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  return c;
}

let _top: HTMLCanvasElement | null = null;
let _left: HTMLCanvasElement | null = null;
let _right: HTMLCanvasElement | null = null;
const shadeTop = () => (_top ??= strip(1, 18, 0, 18, 0.34));
const shadeLeft = () => (_left ??= strip(14, 1, 14, 0, 0.22));
const shadeRight = () => (_right ??= (() => {
  const c = document.createElement('canvas');
  c.width = 14; c.height = 1;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(14, 0, 0, 0);
  gr.addColorStop(0, 'rgba(0,0,0,.22)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 14, 1);
  return c;
})());

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Depth-wash control points: [depth 0..1, r, g, b, alpha]. */
const WASH: [number, number, number, number, number][] = [
  [0.00, 140, 74, 34, 0.00],
  [0.10, 122, 62, 30, 0.10],
  [0.28,  86, 62, 48, 0.19],
  [0.46,  58, 60, 78, 0.27],
  [0.64,  40, 50, 88, 0.35],
  [0.82,  26, 32, 66, 0.44],
  [1.00,  12, 10, 26, 0.56],
];

function washAt(t: number): [number, number, number, number] {
  t = clamp01(t);
  for (let i = 1; i < WASH.length; i++) {
    const [t1] = WASH[i];
    if (t > t1 && i < WASH.length - 1) continue;
    const [t0, r0, g0, b0, a0] = WASH[i - 1];
    const [, r1, g1, b1, a1] = WASH[i];
    const k = t1 === t0 ? 0 : clamp01((t - t0) / (t1 - t0));
    return [
      Math.round(r0 + (r1 - r0) * k),
      Math.round(g0 + (g1 - g0) * k),
      Math.round(b0 + (b1 - b0) * k),
      +(a0 + (a1 - a0) * k).toFixed(3),
    ];
  }
  return [12, 10, 26, 0.56];
}

export class Renderer {
  constructor(private ctx: CanvasRenderingContext2D) {}

  draw(world: World, pod: Pod, cam: Camera, time: number): void {
    const g = this.ctx;

    // Start every frame from a clean context. Without this, a single
    // exception thrown between save() and restore() leaves a clip on the
    // stack that nothing ever pops, and the canvas stays broken forever.
    const anyG = g as unknown as { reset?: () => void };
    if (typeof anyG.reset === 'function') anyG.reset();
    else for (let i = 0; i < 12; i++) g.restore();

    g.imageSmoothingEnabled = false;
    g.save();

    this.drawSky(cam, time);

    const x0 = Math.max(0, Math.floor(cam.x / TILE));
    const x1 = Math.min(world.w - 1, Math.floor((cam.x + VIEW_W) / TILE));
    const y0 = Math.max(0, Math.floor(cam.y / TILE));
    const y1 = Math.min(world.h - 1, Math.floor((cam.y + VIEW_H) / TILE));

    // 1. Soil, drawn as full opaque squares.
    //    Excavated cells get plain soil too, so that when the tunnel pass
    //    rounds a corner away the cut reveals dirt rather than the sky.
    for (let ty = y0; ty <= y1; ty++) {
      const band = bandForRow(ty, EARTH_H);
      for (let tx = x0; tx <= x1; tx++) {
        const code = world.at(tx, ty);
        const sx = Math.round(tx * TILE - cam.x);
        const sy = Math.round(ty * TILE - cam.y);

        if (code === T.EMPTY || code === T.HELL_AIR) {
          if (ty >= SKY_ROWS) g.drawImage(tileTexture(1, world.variantAt(tx, ty), band), sx, sy);
          continue;
        }
        if (code < 0 && code > -8) { g.drawImage(surfaceTexture(), sx, sy); continue; }
        g.drawImage(tileTexture(code, world.variantAt(tx, ty), band), sx, sy);
      }
    }

    // 2. excavated tunnels painted over the soil with rounded corners
    this.drawTunnels(world, cam, x0, x1, y0, y1);

    // 3. continuous depth wash — the strata textures change in steps, this
    //    slides smoothly so the descent reads as one long gradient with no
    //    visible seam between bands.
    this.drawDepthWash(cam);

    this.drawPod(pod, cam, time);
    g.restore();
  }

  /**
   * Paints excavated cells olive-green over the soil with rounded corners.
   *
   * Two separate fills, not one union path: rounded rects first, then the
   * soil-corner discs. Combining them made overlapping subpaths cancel under
   * nonzero winding, which punched holes at every concave corner.
   *
   * Only the strata actually on screen are considered, and the contact
   * shadows are stretched from tiny cached 1px gradient strips rather than
   * building a fresh CanvasGradient per cell — that was costing enough
   * frame time to starve the fixed-step simulation.
   */
  private drawTunnels(
    world: World, cam: Camera, x0: number, x1: number, y0: number, y1: number,
  ): void {
    const g = this.ctx;
    const open = (tx: number, ty: number) => {
      const c = world.at(tx, ty);
      return c === T.EMPTY || c === T.HELL_AIR;
    };

    const top = Math.max(SKY_ROWS, y0);
    if (top > y1) return;
    const bandLo = bandForRow(top, EARTH_H);
    const bandHi = bandForRow(y1, EARTH_H);

    for (let band = bandLo; band <= bandHi; band++) {
      const rects = new Path2D();
      const discs = new Path2D();
      let any = false;

      for (let ty = top; ty <= y1; ty++) {
        if (bandForRow(ty, EARTH_H) !== band) continue;
        const sy = Math.round(ty * TILE - cam.y);
        for (let tx = x0; tx <= x1; tx++) {
          const sx = Math.round(tx * TILE - cam.x);
          const up = open(tx, ty - 1), dn = open(tx, ty + 1);
          const lf = open(tx - 1, ty), rt = open(tx + 1, ty);

          if (open(tx, ty)) {
            any = true;
            rects.roundRect(sx, sy, TILE, TILE, [
              up || lf ? 0 : R, up || rt ? 0 : R,
              dn || rt ? 0 : R, dn || lf ? 0 : R,
            ]);
            continue;
          }

          // soil cell: round off any corner poking into open space
          if (up && lf) { any = true; discs.moveTo(sx + R, sy); discs.arc(sx, sy, R, 0, Math.PI * 2); }
          if (up && rt) { any = true; discs.moveTo(sx + TILE + R, sy); discs.arc(sx + TILE, sy, R, 0, Math.PI * 2); }
          if (dn && lf) { any = true; discs.moveTo(sx + R, sy + TILE); discs.arc(sx, sy + TILE, R, 0, Math.PI * 2); }
          if (dn && rt) { any = true; discs.moveTo(sx + TILE + R, sy + TILE); discs.arc(sx + TILE, sy + TILE, R, 0, Math.PI * 2); }
        }
      }

      if (!any) continue;

      // Composited on its own layer rather than clipping the main context.
      // `source-atop` confines the contact shadows to the green we just laid
      // down, and no clip ever touches the context the pod and HUD draw into.
      const lg = this.layerCtx();
      lg.setTransform(1, 0, 0, 1, 0, 0);
      lg.globalCompositeOperation = 'source-over';
      lg.clearRect(0, 0, VIEW_W, VIEW_H);

      lg.fillStyle = cavityColor(band);
      lg.fill(rects);
      lg.fill(discs);

      lg.globalCompositeOperation = 'source-atop';
      lg.imageSmoothingEnabled = true;
      for (let ty = top; ty <= y1; ty++) {
        if (bandForRow(ty, EARTH_H) !== band) continue;
        const sy = Math.round(ty * TILE - cam.y);
        for (let tx = x0; tx <= x1; tx++) {
          if (!open(tx, ty)) continue;
          const sx = Math.round(tx * TILE - cam.x);
          if (!open(tx, ty - 1)) lg.drawImage(shadeTop(), sx - R, sy, TILE + R * 2, 18);
          if (!open(tx - 1, ty)) lg.drawImage(shadeLeft(), sx, sy - R, 14, TILE + R * 2);
          if (!open(tx + 1, ty)) lg.drawImage(shadeRight(), sx + TILE - 14, sy - R, 14, TILE + R * 2);
        }
      }
      // Generated rock backdrop showing through the excavated space, so the
      // tunnels gain depth texture that shifts as you descend. Kept subtle —
      // the flat olive-green is the original's signature and stays dominant.
      const depthT = clamp01((cam.y + VIEW_H / 2) / (EARTH_H * TILE));
      const back = img(depthT < 0.45 ? 'bg_mid' : 'bg_deep');
      if (back) {
        lg.globalAlpha = 0.1 + depthT * 0.28;
        lg.imageSmoothingEnabled = true;
        const bw = back.width, bh = back.height;
        const ox = -((cam.x * 0.25) % bw);
        const oy = -((cam.y * 0.12) % bh);
        for (let px = ox - bw; px < VIEW_W; px += bw)
          for (let py = oy - bh; py < VIEW_H; py += bh)
            lg.drawImage(back, Math.round(px), Math.round(py));
        lg.globalAlpha = 1;
      }

      lg.globalCompositeOperation = 'source-over';

      g.drawImage(this.layer!, 0, 0);
    }
  }

  private layer: HTMLCanvasElement | null = null;
  private _layerCtx: CanvasRenderingContext2D | null = null;

  private layerCtx(): CanvasRenderingContext2D {
    if (!this._layerCtx) {
      this.layer = document.createElement('canvas');
      this.layer.width = VIEW_W;
      this.layer.height = VIEW_H;
      this._layerCtx = this.layer.getContext('2d')!;
    }
    return this._layerCtx;
  }

  /**
   * A soft colour wash whose tint and strength are a continuous function of
   * depth: warm rust near the surface, cooling through slate to near-black
   * at the bottom. Applied to the world only, so the pod stays readable.
   */
  private drawDepthWash(cam: Camera): void {
    const g = this.ctx;
    const worldPx = EARTH_H * TILE;

    // sample at the top and bottom of the viewport so the wash itself is a
    // gradient down the screen, not a flat tint that pops as you scroll
    const tTop = clamp01((cam.y) / worldPx);
    const tBot = clamp01((cam.y + VIEW_H) / worldPx);
    const a = washAt(tTop), b = washAt(tBot);
    if (a[3] < 0.004 && b[3] < 0.004) return;

    const horizon = World.SURFACE_Y - cam.y;
    const y0 = Math.max(0, horizon);
    if (y0 >= VIEW_H) return;

    const grd = g.createLinearGradient(0, y0, 0, VIEW_H);
    grd.addColorStop(0, `rgba(${a[0]},${a[1]},${a[2]},${a[3]})`);
    grd.addColorStop(1, `rgba(${b[0]},${b[1]},${b[2]},${b[3]})`);
    g.fillStyle = grd;
    g.fillRect(0, y0, VIEW_W, VIEW_H - y0);
  }

  // ------------------------------------------------------------------
  private drawSky(cam: Camera, time: number): void {
    const g = this.ctx;
    const horizon = World.SURFACE_Y - cam.y;

    // Deep indigo void everywhere; underground it simply never shows through.
    const void_ = g.createLinearGradient(0, 0, 0, VIEW_H);
    void_.addColorStop(0, '#120b26');
    void_.addColorStop(1, '#241640');
    g.fillStyle = void_;
    g.fillRect(0, 0, VIEW_W, VIEW_H);

    if (horizon <= 0) return;

    const bg = backdrops.surface;
    if (bg) {
      const px = -(cam.x * 0.3) % bg.width;
      const py = Math.min(0, -(cam.y * 0.3));
      for (let x = px - bg.width; x < VIEW_W; x += bg.width)
        g.drawImage(bg, Math.round(x), Math.round(py), bg.width, bg.height);
      return;
    }

    const sky = g.createLinearGradient(0, 0, 0, Math.max(1, horizon));
    sky.addColorStop(0, '#171033');
    sky.addColorStop(0.5, '#3d2246');
    sky.addColorStop(0.82, '#7c4340');
    sky.addColorStop(1, '#b6714a');
    g.fillStyle = sky;
    g.fillRect(0, 0, VIEW_W, horizon);

    g.fillStyle = 'rgba(255,245,225,.8)';
    for (let i = 0; i < 70; i++) {
      const sx = ((i * 137.5) - cam.x * 0.12) % VIEW_W;
      const sy = (i * 53.7) % Math.max(1, horizon * 0.65);
      g.globalAlpha = 0.25 + (0.5 + 0.5 * Math.sin(time * 0.002 + i)) * 0.5;
      g.fillRect(Math.round((sx + VIEW_W) % VIEW_W), Math.round(sy), 2, 2);
    }
    g.globalAlpha = 1;

    const sk = skylineTexture();
    const sy = horizon - sk.height;
    const off = -(cam.x * 0.35) % sk.width;
    for (let sx = off - sk.width; sx < VIEW_W; sx += sk.width)
      g.drawImage(sk, Math.round(sx), Math.round(sy));
  }

  private drawPod(pod: Pod, cam: Camera, time: number): void {
    const g = this.ctx;
    const sx = Math.round(pod.x - cam.x);
    const sy = Math.round(pod.y - cam.y);

    g.save();
    g.translate(sx, sy);
    g.rotate((pod.rotation * Math.PI) / 180);

    if (pod.rotorVel > 1) {
      const len = 5 + pod.rotorVel * 1.8 + Math.sin(time * 0.05) * 2;
      g.fillStyle = 'rgba(255,168,56,.85)';
      g.fillRect(-11, POD_HH - 4, 6, len);
      g.fillRect(5, POD_HH - 4, 6, len);
      g.fillStyle = 'rgba(255,244,190,.95)';
      g.fillRect(-10, POD_HH - 4, 4, len * 0.55);
      g.fillRect(6, POD_HH - 4, 4, len * 0.55);
    }

    // sprite is centred on the pod's origin rather than pinned to the
    // collision box, so upgraded drills can overhang without shifting it
    const spr = podSprite(pod.facing, pod.drill, pod.hull, pod.engine);
    g.imageSmoothingEnabled = true;
    g.drawImage(spr, Math.round(-spr.width / 2), Math.round(-spr.height / 2));
    g.imageSmoothingEnabled = false;

    if (pod.mode === 'digging') {
      g.fillStyle = `rgba(255,236,170,${0.45 + 0.45 * Math.sin(time * 0.09)})`;
      const dx = pod.facing === 1 ? POD_HW + 2 : -POD_HW - 8;
      g.fillRect(dx, -4, 7, 8);
    }
    g.restore();
  }
}
