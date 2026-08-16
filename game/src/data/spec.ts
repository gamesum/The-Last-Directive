/**
 * Extracted constants from the original build (8khsgfbehb000t_v937.swf),
 * via JPEXS FFDec decompilation. See ../../reference/motherload-spec.md.
 *
 * Gameplay numbers are functional, not expressive — safe to reimplement.
 * NOTHING here is original art, audio, or dialogue text.
 *
 * Every value tagged [ffdec] is copied from real decompiled ActionScript.
 * Values tagged [est] are our own tuning where the original was unread.
 */

// ---------------------------------------------------------------- timing
/** Original ran at 42fps; every per-frame constant below is scaled to it. [ffdec] */
export const FPS = 42;
export const DT = 1 / FPS;

// ---------------------------------------------------------------- physics
export const GRAVITY = 9.81;        // [ffdec] divided by 30 per frame, not real g
export const FRICTION = 0.94;       // [ffdec] ground friction
export const AIR_RESISTANCE = 0.98; // [ffdec]
export const TERMINAL_VEL = 20;     // [ffdec] Math.min(20, yVel + gravity/30)

// ---------------------------------------------------------------- world
export const TILE = 50;             // [ffdec]
export const EARTH_W = 36;          // [ffdec]
export const EARTH_H = 600;         // [ffdec]
export const SKY_ROWS = 5;          // [ffdec] rows 0..4 are air
export const MINERAL_RATE = 65;     // [ffdec] generateEarth()

/** Pixels per foot on the altimeter. depth = int((earthY - podY + 204)/4) [ffdec] */
export const PX_PER_FOOT = 4;
/** 50px tile / 4px-per-ft = 12.5 ft per row. Row 5→597 == 0→-7400 ft. */
export const FEET_PER_ROW = TILE / PX_PER_FOOT;

// ---------------------------------------------------------------- pod
export const POD_MASS = 198;        // [ffdec] wiki's "1980kg" is this x10
/** HALF-extents: the original uses these as `_x + width` / `_x - width`. */
export const POD_HW = 20;           // [ffdec] -> 40px wide
export const POD_HH = 20;           // [ffdec] -> 40px tall
export const REPAIR_COST = 15;      // [ffdec] $ per HP

/** Velocity below these snaps to zero. [ffdec] */
export const XVEL_EPS = 0.12;
export const YVEL_EPS = 0.07;

// ---------------------------------------------------------------- tuning
/**
 * DELIBERATE DEVIATIONS from the original, kept together so they are easy to
 * find and revert. Everything outside this block is measured, not chosen.
 *
 * Speed: the original caps horizontal travel at enginePower/10, which is
 * 15px/frame on the stock engine rising to 21 on the best — only a 40%
 * spread, so the engine ladder reads as pointless until the bay is heavy
 * enough for mass to matter. Subtracting a flat offset makes stock notably
 * slower and widens the spread to 10 -> 16, so every tier is felt at once.
 * Set both offsets to 0 for the original's exact numbers. [tuned]
 */
export const SPEED_CAP_OFFSET = 5;
export const LIFT_CAP_OFFSET = 3.5;
export const speedCap = (power: number) => Math.max(2, power / 10 - SPEED_CAP_OFFSET);
export const liftCap = (power: number) => Math.max(2, power / 12 - LIFT_CAP_OFFSET);

/**
 * World density: the original hollows out `random(3) == 0` of every tile —
 * a full third — which leaves connected caverns wide enough to fly through
 * for long stretches without ever drilling. These divisors make the crust
 * solid near the surface and open up gradually with depth, so caverns become
 * something you descend into rather than the default state of the world.
 * Set both to 3 for the original's exact generation. [tuned]
 */
export const HOLLOW_DIV_SURFACE = 8;
export const HOLLOW_DIV_DEEP = 4;

/**
 * Corner forgiveness. The machine is 40px inside 50px tiles, so threading a
 * one-tile gap squarely is fiddly. When only one of the two leading corners
 * catches, and it only just catches, the pod slides clear instead of stopping
 * dead — the collision box behaves as though its corners were rounded off.
 * FORGIVE is how deep an overlap still counts as a clip; SLIDE caps how far
 * it can be nudged in a single frame so it stays imperceptible. [tuned]
 */
export const CORNER_FORGIVE = 19;
export const CORNER_SLIDE = 6;

/**
 * Shrink of the collision box relative to the drawn machine, per side. The
 * measured box is 40px inside 50px tiles, leaving 5px of clearance each side
 * to fly a one-tile shaft — tighter than anyone can steer. Pulling each edge
 * in widens that to 8px without the machine visibly sinking into rock.
 * 0 restores the original's exact box. [tuned]
 */
export const COLLIDE_INSET = 3;
export const COLLIDE_HW = POD_HW - COLLIDE_INSET;
export const COLLIDE_HH = POD_HH - COLLIDE_INSET;

/**
 * Frames a direction must be held against diggable ground before the drill
 * engages, so brushing a wall while manoeuvring doesn't commit you to a
 * shaft. ~0.17s at 42fps. 0 restores the original's instant bite. [tuned]
 */
export const DIG_HOLD_FRAMES = 7;

/** Chance denominator for the hollow-out pass at world row `y`. */
export function hollowDiv(y: number, worldH: number): number {
  const t = Math.max(0, Math.min(1, y / worldH));
  return Math.round(HOLLOW_DIV_SURFACE + (HOLLOW_DIV_DEEP - HOLLOW_DIV_SURFACE) * t);
}

// ---------------------------------------------------------------- upgrades
export interface Upgrade { name: string; price: number; value: number }

const L = (names: string[], vals: number[], prices: number[]): Upgrade[] =>
  names.map((name, i) => ({ name, value: vals[i], price: prices[i] }));

/** Shared price ladder for the six-tier categories. [ffdec] */
const PRICES7 = [0, 750, 2000, 5000, 20000, 100000, 500000];

export const DRILLS = L(
  ['Stock Drill', 'Silvide Drill', 'Goldium Drill', 'Emerald Drill',
   'Ruby Drill', 'Diamond Drill', 'Amazonite Drill'],
  [2, 2.8, 4, 5, 7, 9.5, 12], PRICES7);

export const HULLS = L(
  ['Stock Hull', 'Ironium Hull', 'Bronzium Hull', 'Steel Hull',
   'Platinium Hull', 'Einsteinium Hull', 'Energy-Shielded Hull'],
  [10, 17, 30, 50, 80, 120, 180], PRICES7);

export const ENGINES = L(
  ['Stock Engine', 'V4 1600 cc', 'V4 2.0 Ltr Turbo', 'V6 3.8 Ltr',
   'V8 Supercharged 5.0 Ltr', 'V12 6.0 Ltr', 'V16 Jag Engine'],
  [150, 160, 170, 180, 190, 200, 210], PRICES7);

export const TANKS = L(
  ['Micro Tank', 'Medium Tank', 'Huge Tank', 'Gigantic Tank',
   'Titanic Tank', 'Leviathan Tank', 'Liquid Compression Tank'],
  [10, 15, 25, 40, 60, 100, 150], PRICES7);

/** Stored as a DAMAGE MULTIPLIER, not a percentage. [ffdec] */
export const RADIATORS = L(
  ['Stock Fan', 'Dual Fans', 'Single Turbine', 'Dual Turbines',
   'Puron Cooling', 'Tri-Turbine Freon Array'],
  [1.0, 0.9, 0.75, 0.6, 0.4, 0.2],
  [0, 2000, 5000, 20000, 100000, 500000]);

export const BAYS = L(
  ['Micro Bay', 'Medium Bay', 'Huge Bay', 'Gigantic Bay',
   'Titanic Bay', 'Leviathan Bay'],
  [7, 15, 25, 40, 70, 120],
  [0, 750, 2000, 5000, 20000, 100000]);

// ---------------------------------------------------------------- minerals
export interface Mineral { name: string; value: number; mass: number; color: string }

/**
 * Indices 0..9 are the ores, 10..13 the artifacts. Tile code maps as
 * mineralId = tileCode - 6, confirmed two ways in generateEarth(). [ffdec]
 * Colors are ours — the original art is reference-only.
 */
export const MINERALS: Mineral[] = [
  { name: 'Ironium',     value: 30,     mass: 1,  color: '#b8763e' },
  { name: 'Bronzium',    value: 60,     mass: 1,  color: '#c9954a' },
  { name: 'Silverium',   value: 100,    mass: 1,  color: '#d3dde4' },
  { name: 'Goldium',     value: 250,    mass: 2,  color: '#f2c13c' },
  { name: 'Platinium',   value: 750,    mass: 3,  color: '#9fe8e0' },
  { name: 'Einsteinium', value: 2000,   mass: 4,  color: '#7d6bf0' },
  { name: 'Emerald',     value: 5000,   mass: 6,  color: '#3fd97a' },
  { name: 'Ruby',        value: 20000,  mass: 8,  color: '#f0405c' },
  { name: 'Diamond',     value: 100000, mass: 10, color: '#9ff0ff' },
  { name: 'Amazonite',   value: 500000, mass: 12, color: '#46f0c0' },
  // artifacts — one-off finds, weight 1
  { name: 'Fossil Remains',   value: 1000,  mass: 1, color: '#e8dcc0' },
  { name: 'Sealed Cache',     value: 5000,  mass: 1, color: '#d8a860' },
  { name: 'Unknown Skeleton', value: 10000, mass: 1, color: '#e0e8e8' },
  { name: 'Ritual Object',    value: 50000, mass: 1, color: '#c060e0' },
];

export const ORE_COUNT = 10;

// ---------------------------------------------------------------- tile codes
/** Tile code vocabulary, decoded from generateEarth(). [ffdec] */
export const T = {
  EMPTY: 0,
  DIRT_MIN: 1, DIRT_MAX: 5,        // random(5)+1, cosmetic variants
  ORE_MIN: 6, ORE_MAX: 15,         // -> MINERALS[code-6]
  ARTIFACT_MIN: 16, ARTIFACT_MAX: 19,
  ROCK_MIN: 25, ROCK_MAX: 27,      // hard rock
  LAVA_MIN: 28, LAVA_MAX: 30,      // 12 dmg on dig
  GAS: 31,                         // hitGasPocket()
  HELL_AIR: -999,
  BEDROCK: -8,
  /** Sealed ground under a surface building. Reads as surface, never digs. */
  FOUNDATION: -3,
} as const;

export const isOre = (c: number) => c >= T.ORE_MIN && c <= T.ARTIFACT_MAX;
export const isDirt = (c: number) => c >= T.DIRT_MIN && c <= T.DIRT_MAX;
export const isRock = (c: number) => c >= T.ROCK_MIN && c <= T.ROCK_MAX;
export const isLava = (c: number) => c >= T.LAVA_MIN && c <= T.LAVA_MAX;
export const isSolid = (c: number) => c !== T.EMPTY && c !== T.HELL_AIR;
/**
 * [ffdec] startDigging() gates on `earth[x][y][0] > -3`, so every code at or
 * below -3 is structural and undiggable: bedrock, the hell-chamber shell, and
 * the sealed ground under the surface buildings. Only the plain surface rows
 * (-1, -2) can be cut.
 */
export const isDrillable = (c: number) => isSolid(c) && c > T.FOUNDATION;

/** Hard rock drills slower. The original's exact factor wasn't read. [est] */
export const ROCK_DIG_FACTOR = 0.35;

// ---------------------------------------------------------------- damage
export const LAVA_DAMAGE = 12;      // [ffdec] dugTile 28..30
export const FALL_DAMAGE_VEL = 7;   // [ffdec] yVel > 7 triggers
export const FALL_BOUNCE = -0.2;    // [ffdec] yVel *= -0.2

/** [ffdec] int(-(depthFt + 3000)/15) * radiatorMultiplier, clamped at 0. */
export function gasDamage(depthFt: number, radiatorMult: number): number {
  return Math.max(0, Math.trunc((-(depthFt + 3000)) / 15) * radiatorMult);
}

// ---------------------------------------------------------------- fuel
export const FUEL_PER_L = 3;        // [est] price per litre at the pump

/**
 * Starting credits. The original drops you in at $0 with a part-full tank,
 * which reads as hostile before you understand the loop — you can strand
 * yourself before your first sale. Enough to fill from empty. [tuned]
 */
export const START_CASH = 30;
/**
 * Per-frame burn is enginePower divided by these. [ffdec]
 * IDLE is unconditional — it ticks every frame the pod is alive, which is
 * why you can't hover indefinitely. The spec doc missed this one.
 */
export const FUEL_DIG_DIV = 25000;
export const FUEL_FLY_DIV = 50000;
export const FUEL_IDLE_DIV = 100000;

// ---------------------------------------------------------------- view
export const VIEW_W = 800;
export const VIEW_H = 600;
