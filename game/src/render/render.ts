import { World } from '../world/world';
import { Pod } from '../game/pod';
import {
  drawSoil, subForRow, cavityColorAtY, oreOverlay, rockOverlay, lavaOverlay,
  gasOverlay, bedrockTile, surfaceTexture, skylineTexture, podParts, PodParts,
} from './textures';
import {
  TILE, VIEW_W, VIEW_H, T, EARTH_H, SKY_ROWS, isOre, isRock, isLava,
} from '../data/spec';

export interface Camera { x: number; y: number }

/** Corner radius where excavated tunnel meets soil. The original's signature. */
const R = 15;

const backdrops: Record<string, HTMLImageElement | null> = { surface: null, deep: null };

export function loadBackdrop(name: 'surface' | 'deep', url: string): void {
  const img = new Image();
  img.onload = () => { backdrops[name] = img; };
  img.onerror = () => { backdrops[name] = null; };
  img.src = url;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

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

    this.drawGround(world, cam, x0, x1, y0, y1);
    this.drawCavity(world, cam, x0, x1, y0, y1);
    this.drawPod(pod, cam, time);

    g.restore();
  }

  /**
   * The solid crust.
   *
   * Every cell — including excavated ones, which the tunnel pass paints over
   * afterwards — gets a window into one continuous soil sheet, addressed by
   * world coordinate. That continuity is the whole point: cells butt up
   * against each other with no seam, so the ground reads as one mass rather
   * than a grid of tiles. Ore, rock and lava are then stamped on top as
   * inclusions, with the soil running unbroken behind them.
   */
  private drawGround(
    world: World, cam: Camera, x0: number, x1: number, y0: number, y1: number,
  ): void {
    const g = this.ctx;

    for (let ty = Math.max(SKY_ROWS, y0); ty <= y1; ty++) {
      const sub = subForRow(ty, EARTH_H);
      const sy = Math.round(ty * TILE - cam.y);

      for (let tx = x0; tx <= x1; tx++) {
        const code = world.at(tx, ty);
        const sx = Math.round(tx * TILE - cam.x);
        const empty = code === T.EMPTY || code === T.HELL_AIR;

        if (!empty) {
          if (code === T.BEDROCK || code <= -8) {
            g.drawImage(bedrockTile(world.variantAt(tx, ty)), sx, sy);
            continue;
          }
          if (code < 0) { g.drawImage(surfaceTexture(), sx, sy); continue; }
        }

        drawSoil(g, tx, ty, sx, sy, sub);
        if (empty) continue;

        const v = world.variantAt(tx, ty);
        if (isOre(code)) g.drawImage(oreOverlay(code - 6, v), sx, sy);
        else if (isRock(code)) g.drawImage(rockOverlay(v), sx, sy);
        else if (isLava(code)) g.drawImage(lavaOverlay(v), sx, sy);
        else if (code === T.GAS) g.drawImage(gasOverlay(v), sx, sy);
      }
    }
  }

  /**
   * The background, revealed wherever the ground has been cut away.
   *
   * It is completely detached from the blocks: a single screen-space vertical
   * gradient — warm tan below the outpost, olive-green by a couple of thousand
   * feet, near-black at the bottom — poured through a mask of the excavated
   * cells. Nothing about it varies with where the tiles happen to sit, so no
   * shading, seam or band boundary can appear along an edge or a corner. The
   * soil in front keeps its own colour and is unaffected by depth.
   *
   * Two separate fills build the mask, not one union path: rounded rects
   * first, then the soil-corner discs. Combining them made overlapping
   * subpaths cancel under nonzero winding, punching holes at every concave
   * corner.
   */
  private drawCavity(
    world: World, cam: Camera, x0: number, x1: number, y0: number, y1: number,
  ): void {
    const g = this.ctx;
    const open = (tx: number, ty: number) => {
      const c = world.at(tx, ty);
      return c === T.EMPTY || c === T.HELL_AIR;
    };

    const top = Math.max(SKY_ROWS, y0);
    if (top > y1) return;

    const rects = new Path2D();
    const fillets = new Path2D();
    let any = false;

    /**
     * Carve one corner of a soil cell so it meets open space with a rounded
     * edge: the R-square at the corner minus the disc inscribed in it, with
     * (dx,dy) pointing into the cell.
     *
     * This used to be a full disc centred *on* the corner, which bit R deep
     * into the diagonal neighbour as well — that overreach is what produced
     * the bulbous lobes at junctions.
     */
    const fillet = (cx: number, cy: number, dx: number, dy: number) => {
      const ax = cx + dx * R, ay = cy + dy * R;
      fillets.moveTo(cx, cy);
      fillets.lineTo(ax, cy);
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * (Math.PI / 2);
        fillets.lineTo(ax - dx * R * Math.sin(a), ay - dy * R * Math.cos(a));
      }
      fillets.closePath();
    };

    for (let ty = top; ty <= y1; ty++) {
      const sy = Math.round(ty * TILE - cam.y);
      for (let tx = x0; tx <= x1; tx++) {
        const sx = Math.round(tx * TILE - cam.x);
        const up = open(tx, ty - 1), dn = open(tx, ty + 1);
        const lf = open(tx - 1, ty), rt = open(tx + 1, ty);

        if (open(tx, ty)) {
          any = true;
          // A corner whose diagonal neighbour is open is left square. Two
          // open cells meeting only at a corner are a passage, and rounding
          // both sides of it pinched the throat to a cusp and left the
          // boundary visibly undulating along every diagonal run. The solid
          // cells on the other two sides still get filleted, which is what
          // actually opens the passage out.
          const ul = open(tx - 1, ty - 1), ur = open(tx + 1, ty - 1);
          const dl = open(tx - 1, ty + 1), dr = open(tx + 1, ty + 1);
          rects.roundRect(sx, sy, TILE, TILE, [
            up || lf || ul ? 0 : R, up || rt || ur ? 0 : R,
            dn || rt || dr ? 0 : R, dn || lf || dl ? 0 : R,
          ]);
          continue;
        }

        // soil cell: round off any corner poking into open space
        if (up && lf) { any = true; fillet(sx, sy, 1, 1); }
        if (up && rt) { any = true; fillet(sx + TILE, sy, -1, 1); }
        if (dn && lf) { any = true; fillet(sx, sy + TILE, 1, -1); }
        if (dn && rt) { any = true; fillet(sx + TILE, sy + TILE, -1, -1); }
      }
    }

    if (!any) return;

    // Built on its own layer rather than by clipping the main context — no
    // clip ever touches the context the pod and HUD draw into.
    const lg = this.layerCtx();
    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.globalCompositeOperation = 'source-over';
    lg.clearRect(0, 0, VIEW_W, VIEW_H);
    lg.fillStyle = '#000';
    lg.fill(rects);
    lg.fill(fillets);

    lg.globalCompositeOperation = 'source-in';
    const grd = lg.createLinearGradient(0, 0, 0, VIEW_H);
    grd.addColorStop(0, cavityColorAtY(cam.y));
    grd.addColorStop(1, cavityColorAtY(cam.y + VIEW_H));
    lg.fillStyle = grd;
    lg.fillRect(0, 0, VIEW_W, VIEW_H);
    lg.globalCompositeOperation = 'source-over';

    // Anything above the ground line is sky, not excavation. Without this the
    // rounded corners on the topmost row bulge past the horizon and paint
    // background colour into the sky.
    const skyCut = Math.max(0, Math.min(VIEW_H, World.SURFACE_Y - cam.y));
    if (skyCut > 0) lg.clearRect(0, 0, VIEW_W, skyCut);

    g.drawImage(this.layer!, 0, 0);
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

  /**
   * The machine.
   *
   * Hull and drill are drawn as separate pieces so the drill can be pivoted
   * about their seam to point at whatever it's cutting — the original swaps
   * between dedicated dig-down and dig-across sprites to the same end.
   *
   * The transform order mirrors Flash's: tilt is applied in world space, then
   * the mirror, exactly as `_rotation` and `_xscale` compose on a MovieClip.
   */
  private drawPod(pod: Pod, cam: Camera, time: number): void {
    const g = this.ctx;
    const p = podParts(pod.drill, pod.hull, pod.engine);

    g.save();
    g.translate(Math.round(pod.x - cam.x), Math.round(pod.y - cam.y));
    g.rotate((pod.rotation * Math.PI) / 180);
    g.scale(pod.facing, 1);

    g.imageSmoothingEnabled = true;
    g.drawImage(p.body, Math.round(-p.w / 2), Math.round(-p.h / 2));

    // Flame is drawn after the hull so the nozzles in the art stay visible
    // and the plume reads as coming out of them. It rides rotorVel, which
    // spools up and down over several frames rather than snapping on.
    this.drawExhaust(g, pod, p, time);

    const dir = pod.digDirection;
    const down = dir === 'down';
    g.save();
    // pull the head back when it swings under the machine, so it sits beneath
    // the hull rather than hanging off the nose
    g.translate(-p.w / 2 + p.seam - (down ? 12 : 0), 0);
    if (down) g.rotate(Math.PI / 2);
    if (dir) g.rotate(Math.sin(time * 0.05) * 0.07);        // bite wobble
    g.drawImage(p.drill, 0, Math.round(-(down ? p.drillMidY : p.h / 2)));
    g.restore();

    g.imageSmoothingEnabled = false;
    g.restore();
  }

  /**
   * Twin thruster plumes under the belly, drawn in the pod's own frame.
   *
   * Three nested teardrops — a wide soft glow, an orange body and a white
   * core — each flickering on its own frequency so the flame never repeats
   * visibly. Length and width track `rotorVel`, which ramps over ~11 frames,
   * so the jets visibly light and die rather than popping. Below them a few
   * embers fall away on a looping cycle.
   */
  private drawExhaust(
    g: CanvasRenderingContext2D, pod: Pod, p: PodParts, time: number,
  ): void {
    const power = clamp01(pod.rotorVel / 11);
    if (power < 0.04) return;

    // Nozzle mouths come from the machine geometry rather than being guessed,
    // so the flame always starts exactly at the bell.
    for (let n = 0; n < p.nozzles.length; n++) {
      const { x: ox, y: y0 } = p.nozzles[n];
      const flick = 0.86 + 0.14 * Math.sin(time * 0.09 + n * 2.1)
                        + 0.06 * Math.sin(time * 0.23 + n);
      const len = (8 + power * 22) * flick;
      const wide = (3 + power * 1.6) * (0.9 + 0.1 * Math.sin(time * 0.17 + n));

      const cone = (halfW: number, l: number, top: string, bottom: string) => {
        const grd = g.createLinearGradient(0, y0, 0, y0 + l);
        grd.addColorStop(0, top);
        grd.addColorStop(1, bottom);
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(ox - halfW, y0);
        g.quadraticCurveTo(ox - halfW * 0.75, y0 + l * 0.62, ox, y0 + l);
        g.quadraticCurveTo(ox + halfW * 0.75, y0 + l * 0.62, ox + halfW, y0);
        g.closePath();
        g.fill();
      };

      cone(wide * 1.7, len * 1.15, 'rgba(255,150,60,.30)', 'rgba(255,90,30,0)');
      cone(wide, len, 'rgba(255,206,110,.92)', 'rgba(255,120,40,0)');
      cone(wide * 0.44, len * 0.58, 'rgba(255,253,246,.98)', 'rgba(255,232,170,0)');

      // embers, on a deterministic loop so they cost nothing to track
      for (let e = 0; e < 3; e++) {
        const t = ((time * 0.012 + e * 0.37 + n * 0.19) % 1);
        const ey = y0 + len * (0.7 + t * 1.1);
        const ex = ox + Math.sin((e + n) * 9.7 + t * 4) * (3 + t * 7);
        g.globalAlpha = (1 - t) * 0.8 * power;
        g.fillStyle = e % 2 ? '#ffd79a' : '#ff9a4a';
        g.fillRect(Math.round(ex), Math.round(ey), 2, 2);
      }
      g.globalAlpha = 1;
    }
  }
}
