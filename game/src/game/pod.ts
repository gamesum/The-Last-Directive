import { World } from '../world/world';
import {
  GRAVITY, FRICTION, AIR_RESISTANCE, TERMINAL_VEL, TILE,
  POD_MASS, POD_HW, POD_HH, XVEL_EPS, YVEL_EPS,
  DRILLS, HULLS, ENGINES, TANKS, RADIATORS, BAYS,
  MINERALS, ORE_COUNT, T, isOre, isRock, isLava,
  ROCK_DIG_FACTOR, LAVA_DAMAGE, FALL_DAMAGE_VEL, FALL_BOUNCE, gasDamage,
  FUEL_DIG_DIV, FUEL_FLY_DIV, FUEL_IDLE_DIV,
} from '../data/spec';

export type Mode = 'air' | 'ground' | 'digging' | 'dead';
export type Dir = 'down' | 'left' | 'right';

export interface Controls { up: boolean; down: boolean; left: boolean; right: boolean }

/** Events the pod raises for the game layer to turn into sound/FX/log lines. */
export type PodEvent =
  | { kind: 'dug'; code: number; x: number; y: number }
  | { kind: 'collect'; mineral: number }
  | { kind: 'bayFull' }
  | { kind: 'damage'; amount: number; cause: 'fall' | 'lava' | 'gas' }
  | { kind: 'died'; cause: 'hull' | 'fuel' }
  | { kind: 'land'; speed: number };

export class Pod {
  x = 0; y = 0;
  xVel = 0; yVel = 0;
  mode: Mode = 'air';
  facing: 1 | -1 = -1;
  /** Visual tilt, purely cosmetic. [ffdec] +/-15 deg */
  rotation = 0;
  rotorVel = 0;

  hp = HULLS[0].value;
  fuel = 6;                 // [ffdec] the original starts you short, not full
  cash = 0;
  score = 0;
  maxDepth = 0;

  drill = 0; hull = 0; engine = 0; tank = 0; radiator = 0; bay = 0;

  /** counts per mineral id, including artifacts */
  readonly bayContents: number[] = new Array(MINERALS.length).fill(0);

  // dig state
  private digX = 0; private digY = 0;
  private digDir: Dir = 'down';
  private digProgress = 0;
  private digFromX = 0; private digFromY = 0;

  readonly events: PodEvent[] = [];

  constructor(private world: World) {
    this.x = 8.5 * TILE;
    this.y = World.SURFACE_Y - POD_HH;
  }

  // ---------------------------------------------------------------- stats
  get enginePower() { return ENGINES[this.engine].value; }
  get maxHp() { return HULLS[this.hull].value; }
  get maxFuel() { return TANKS[this.tank].value; }
  get bayCapacity() { return BAYS[this.bay].value; }
  get radiatorMult() { return RADIATORS[this.radiator].value; }
  get drillSpeed() { return DRILLS[this.drill].value; }

  /** [ffdec] base mass plus the mass of every ore held. */
  getMass(): number {
    let m = POD_MASS;
    for (let i = 0; i < ORE_COUNT; i++) m += this.bayContents[i] * MINERALS[i].mass;
    return m;
  }

  bayUsed(): number {
    let n = 0;
    for (let i = 0; i < ORE_COUNT; i++) n += this.bayContents[i];
    return n;
  }

  get depthFeet(): number { return World.depthFeet(this.y); }

  // ---------------------------------------------------------------- damage
  damage(d: number, cause: 'fall' | 'lava' | 'gas'): void {
    if (this.mode === 'dead') return;
    d = Math.trunc(d);
    if (d === 0) return;               // [ffdec] exact guard, negatives heal
    this.hp -= d;
    this.events.push({ kind: 'damage', amount: d, cause });
    if (this.hp <= 0) { this.hp = 0; this.mode = 'dead'; this.events.push({ kind: 'died', cause: 'hull' }); }
  }

  // ---------------------------------------------------------------- update
  /** One fixed step at 42Hz. */
  step(c: Controls): void {
    if (this.mode === 'dead') return;

    if (this.mode === 'digging') { this.stepDig(); this.idleBurn(); return; }

    const grounded = this.isGrounded();
    this.mode = grounded ? 'ground' : 'air';

    if (grounded && this.tryStartDig(c)) { this.idleBurn(); return; }

    const power = this.enginePower;
    const mass = this.getMass();
    const capX = power / 10;

    if (grounded) {
      if (c.right) {
        this.xVel = Math.min(this.xVel + power / mass, capX);
        this.burn(FUEL_FLY_DIV); this.facing = 1;
      } else if (c.left) {
        this.xVel = Math.max(this.xVel - power / mass, -capX);
        this.burn(FUEL_FLY_DIV); this.facing = -1;
      } else {
        this.xVel *= FRICTION;
      }
      if (c.up) {
        // [ffdec] stronger initial shove when pushing off the ground
        this.yVel = Math.max(this.yVel - (power / mass) * 2, -capX);
        this.burn(FUEL_FLY_DIV);
        this.rotorVel = Math.min(this.rotorVel + 1, 11);
      }
      this.rotation *= 0.7;
    } else {
      if (c.right) {
        this.xVel = Math.min(this.xVel + power / mass / 1.5, capX);
        this.rotation = Math.min(this.rotation + power / 50, 15);
        this.burn(FUEL_FLY_DIV);
        this.rotorVel = Math.min(this.rotorVel + 0.3, 11);
        this.facing = 1;
      } else if (c.left) {
        this.xVel = Math.max(this.xVel - power / mass / 1.5, -capX);
        this.rotation = Math.max(this.rotation - power / 50, -15);
        this.burn(FUEL_FLY_DIV);
        this.rotorVel = Math.min(this.rotorVel + 0.3, 11);
        this.facing = -1;
      } else {
        this.rotation *= 0.9;
      }

      if (c.up) {
        this.rotorVel = Math.min(this.rotorVel + 1, 11);
        const accel = (c.left || c.right) ? power / mass / 1.5 : power / mass;
        this.yVel = Math.max(this.yVel - accel, -power / 12);
        this.burn(FUEL_FLY_DIV);
      } else {
        this.rotorVel = Math.max(this.rotorVel * 0.95, 0);
      }

      // [ffdec] passive integration, air only
      this.xVel *= AIR_RESISTANCE;
      this.yVel *= AIR_RESISTANCE;
      this.yVel = Math.min(this.yVel + GRAVITY / 30, TERMINAL_VEL);
    }

    this.idleBurn();
    this.collideAndMove();
  }

  // ---------------------------------------------------------------- fuel
  private burn(div: number): void { this.spendFuel(this.enginePower / div); }
  private idleBurn(): void { this.spendFuel(this.enginePower / FUEL_IDLE_DIV); }

  private spendFuel(n: number): void {
    if (this.mode === 'dead') return;
    this.fuel -= n;
    if (this.fuel <= 0) {
      this.fuel = 0;
      this.mode = 'dead';
      this.events.push({ kind: 'died', cause: 'fuel' });
    }
  }

  // ---------------------------------------------------------------- digging
  private isGrounded(): boolean {
    const yb = this.y + POD_HH + 1;
    const ty = Math.floor(yb / TILE);
    const x1 = Math.floor((this.x - POD_HW + 1) / TILE);
    const x2 = Math.floor((this.x + POD_HW - 1) / TILE);
    for (let tx = x1; tx <= x2; tx++) if (this.world.solidAt(tx, ty)) return true;
    return false;
  }

  private tryStartDig(c: Controls): boolean {
    const cx = Math.floor(this.x / TILE);
    const cy = Math.floor(this.y / TILE);
    let tx = cx, ty = cy, dir: Dir = 'down';

    if (c.down) { ty = cy + 1; dir = 'down'; }
    else if (c.left && Math.abs(this.xVel) < 4) { tx = cx - 1; dir = 'left'; }
    else if (c.right && Math.abs(this.xVel) < 4) { tx = cx + 1; dir = 'right'; }
    else return false;

    if (!this.world.drillableAt(tx, ty)) return false;

    this.mode = 'digging';
    this.digX = tx; this.digY = ty; this.digDir = dir;
    this.digProgress = 0;
    this.digFromX = this.x; this.digFromY = this.y;
    this.xVel = 0; this.yVel = 0;
    if (dir !== 'down') this.facing = dir === 'left' ? -1 : 1;
    return true;
  }

  private stepDig(): void {
    const code = this.world.at(this.digX, this.digY);

    // [ffdec] digVel = 0.5*drillSpeed, then softened by depth hardening.
    let digVel = 0.5 * this.drillSpeed;
    const depthMag = Math.max(0, -this.depthFeet);
    digVel = digVel / (1 + depthMag / 1000);
    if (isRock(code)) digVel *= ROCK_DIG_FACTOR;   // [est]

    this.digProgress += digVel;
    this.spendFuel(this.enginePower / FUEL_DIG_DIV);

    // slide the pod into the tile as it breaks
    const t = Math.min(1, this.digProgress / TILE);
    const tgtX = this.digX * TILE + TILE / 2;
    const tgtY = this.digY * TILE + TILE / 2;
    if (this.digDir === 'down') this.y = this.digFromY + (tgtY - this.digFromY) * t;
    else { this.x = this.digFromX + (tgtX - this.digFromX) * t; this.y = this.digFromY; }

    if (this.digProgress < TILE) return;

    // ---- tile broken
    this.world.set(this.digX, this.digY, T.EMPTY);
    this.events.push({ kind: 'dug', code, x: this.digX, y: this.digY });

    if (isOre(code)) this.collect(code - 6);
    else if (isLava(code)) this.damage(LAVA_DAMAGE, 'lava');
    else if (code === T.GAS) this.damage(gasDamage(this.depthFeet, this.radiatorMult), 'gas');

    this.mode = 'air';
    this.digProgress = 0;
  }

  private collect(id: number): void {
    if (id < 0 || id >= MINERALS.length) return;
    // Artifacts ignore bay capacity — they're one-off story pickups.
    if (id < ORE_COUNT && this.bayUsed() >= this.bayCapacity) {
      this.events.push({ kind: 'bayFull' });
      return;
    }
    this.bayContents[id]++;
    this.events.push({ kind: 'collect', mineral: id });
  }

  // ---------------------------------------------------------------- collision
  /** Swept AABB against the tile grid, matching the original's probe order. */
  private collideAndMove(): void {
    if (this.xVel > 0) {
      if (this.solidSpan(this.x + this.xVel + POD_HW, true)) this.xVel = 0;
    } else if (this.xVel < 0) {
      if (this.solidSpan(this.x + this.xVel - POD_HW, true)) this.xVel = 0;
    }

    if (this.yVel > 0) {
      if (this.solidSpan(this.y + this.yVel + POD_HH, false)) {
        if (this.yVel > FALL_DAMAGE_VEL) this.damage(this.yVel / 2, 'fall');
        this.events.push({ kind: 'land', speed: this.yVel });
        this.yVel *= FALL_BOUNCE;      // [ffdec] -0.2 bounce
      }
    } else if (this.yVel < 0) {
      if (this.solidSpan(this.y + this.yVel - POD_HH - 1, false)) this.yVel *= FALL_BOUNCE;
    }

    if (Math.abs(this.xVel) < XVEL_EPS) this.xVel = 0;
    if (Math.abs(this.yVel) < YVEL_EPS) this.yVel = 0;

    this.x += this.xVel;
    this.y += this.yVel;

    // keep inside the shaft walls
    const minX = POD_HW, maxX = this.world.w * TILE - POD_HW;
    if (this.x < minX) { this.x = minX; this.xVel = 0; }
    if (this.x > maxX) { this.x = maxX; this.xVel = 0; }
    if (this.y < POD_HH) { this.y = POD_HH; if (this.yVel < 0) this.yVel = 0; }

    if (this.depthFeet < this.maxDepth) this.maxDepth = this.depthFeet;
  }

  /**
   * Probe the two corners of the leading edge, as the original's paired
   * hitTest calls do — vertical:false means probe a horizontal edge.
   */
  private solidSpan(edge: number, vertical: boolean): boolean {
    if (vertical) {
      const tx = Math.floor(edge / TILE);
      return this.world.solidAt(tx, Math.floor((this.y + POD_HH - 1) / TILE))
          || this.world.solidAt(tx, Math.floor((this.y - POD_HH + 1) / TILE));
    }
    const ty = Math.floor(edge / TILE);
    return this.world.solidAt(Math.floor((this.x + POD_HW - 1) / TILE), ty)
        || this.world.solidAt(Math.floor((this.x - POD_HW + 1) / TILE), ty);
  }

  // ---------------------------------------------------------------- economy
  sellAll(): number {
    let total = 0;
    for (let i = 0; i < MINERALS.length; i++) {
      total += this.bayContents[i] * MINERALS[i].value;
      this.bayContents[i] = 0;
    }
    this.cash += total;
    this.score += total;
    return total;
  }

  refuel(litres: number): void { this.fuel = Math.min(this.maxFuel, this.fuel + litres); }
  repair(): void { this.hp = this.maxHp; }

  respawn(): void {
    this.mode = 'air';
    this.x = 8.5 * TILE;
    this.y = World.SURFACE_Y - POD_HH;
    this.xVel = this.yVel = 0;
    this.hp = this.maxHp;
    this.fuel = this.maxFuel;
    for (let i = 0; i < this.bayContents.length; i++) this.bayContents[i] = 0;
  }
}
