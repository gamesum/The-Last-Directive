import { Rng } from '../core/rng';
import {
  EARTH_W, EARTH_H, SKY_ROWS, MINERAL_RATE, TILE, PX_PER_FOOT, POD_HH,
  T, isSolid, isDrillable, hollowDiv,
} from '../data/spec';

/**
 * Direct port of generateEarth() from the decompiled original
 * (reference/decompiled/scripts/frame_1/DoAction.as:1475).
 *
 * Kept structurally identical to the source so the world *feels* right:
 * the same nested random(5) rarity gates, the same depth-scaled ore tier,
 * the same `random(3)==0` pass that hollows out a third of every tile —
 * which is what gives the original its cave-riddled, airy texture.
 */
export class World {
  /** tile code per cell */
  readonly code: Int16Array;
  /** cosmetic sub-variant 0..3, the original's earth[x][y][1] */
  readonly variant: Uint8Array;
  readonly w = EARTH_W;
  readonly h = EARTH_H;

  constructor(seed: string) {
    this.code = new Int16Array(EARTH_W * EARTH_H);
    this.variant = new Uint8Array(EARTH_W * EARTH_H);
    this.generate(new Rng(seed));
  }

  idx(x: number, y: number): number { return y * EARTH_W + x; }

  at(x: number, y: number): number {
    if (x < 0 || x >= EARTH_W || y < 0) return T.BEDROCK; // walls & sky-cap
    if (y >= EARTH_H) return T.BEDROCK;
    return this.code[this.idx(x, y)];
  }

  variantAt(x: number, y: number): number {
    if (x < 0 || x >= EARTH_W || y < 0 || y >= EARTH_H) return 0;
    return this.variant[this.idx(x, y)];
  }

  set(x: number, y: number, c: number): void {
    if (x < 0 || x >= EARTH_W || y < 0 || y >= EARTH_H) return;
    this.code[this.idx(x, y)] = c;
  }

  solidAt(x: number, y: number): boolean { return isSolid(this.at(x, y)); }
  drillableAt(x: number, y: number): boolean { return isDrillable(this.at(x, y)); }

  // ------------------------------------------------------------------
  private generate(r: Rng): void {
    const H = EARTH_H;

    for (let x = 0; x < EARTH_W; x++) {
      for (let y = 0; y < H; y++) {
        const i = this.idx(x, y);
        this.variant[i] = r.int(4);
        let c: number;

        if (y < SKY_ROWS) {
          c = T.EMPTY;
        } else if (y === SKY_ROWS) {
          // surface ground band: original used random(2)-2 (codes -2,-1)
          c = r.int(2) - 2;
        } else if (y === H - 12) {
          c = r.int(2) - 7;                 // hell-chamber ceiling
        } else if (y >= H - 11 && y < H - 5) {
          c = T.HELL_AIR;                   // open chamber
        } else if (y === H - 5) {
          c = -(9 + r.int(4));
        } else if (y > H - 5) {
          c = T.BEDROCK;
        } else {
          c = this.genOre(r, y, i, H);
        }

        this.code[i] = c;
      }
    }

    // Hand-carved cells from the original: chamber entrance + surface props.
    this.set(EARTH_W - 3, H - 12, T.EMPTY);
    this.set(EARTH_W - 4, H - 12, T.EMPTY);
  }

  /** The non-special-cased branch of generateEarth(). */
  private genOre(r: Rng, y: number, i: number, H: number): number {
    let c: number;

    if (r.int(5) === 0) {
      if (r.int(5) === 0) {
        if (r.int(5) === 0) {
          if (r.int(4) === 0 && y > 80) {
            // artifacts: random(4)+16 -> minerals 10..13
            c = r.int(4) + 16;
            if (c === 17) this.variant[i] = 0;
            return c;
          }
          c = Math.min(r.int(Math.trunc(y / MINERAL_RATE) + 2) + 8, 15);
        } else {
          c = Math.min(r.int(Math.trunc(y / MINERAL_RATE) + 2) + 7, 15);
        }
      } else {
        c = Math.min(r.int(Math.trunc(y / MINERAL_RATE) + 2) + 6, 15);
      }
    } else {
      c = r.int(5) + 1; // plain dirt
      // Below ~row 133 dirt starts converting to rock, then lava, then gas.
      // The (H-y)/H*15 term makes that conversion approach 100% near the floor.
      if (y * 1.5 > H / 3) {
        if (r.int(Math.trunc((H - y) / H * 15)) === 0) {
          if ((y / 2) * 1.5 > H / 3 && r.int(2) === 0) {
            if ((y / 3) * 1.5 > H / 3 && r.int(2) === 0) c = T.GAS;
            else c = 28 + r.int(3);
          } else {
            c = 25 + r.int(3);
          }
        }
      }
    }

    // The hollow-out pass, applied last to every tile. The original uses a
    // flat random(3), which leaves the whole crust cavernous; hollowDiv()
    // ramps it with depth instead. See the tuning block in spec.ts.
    if (r.int(hollowDiv(y, H)) === 0) c = T.EMPTY;
    return c;
  }

  // ------------------------------------------------------------------
  /** World-space y (px) of the ground surface — top of the first solid row. */
  static readonly SURFACE_Y = SKY_ROWS * TILE;

  /**
   * Altimeter datum is the pod's resting centre on flat ground, so a pod
   * parked at the outpost reads exactly 0 ft (the original's `+204` term
   * does the same job against its own sprite origin).
   */
  static readonly DATUM_Y = SKY_ROWS * TILE - POD_HH;

  /** Altimeter reading. Negative below ground. [ffdec] 4px per foot. */
  static depthFeet(podY: number): number {
    return Math.trunc(-(podY - World.DATUM_Y) / PX_PER_FOOT);
  }
}
