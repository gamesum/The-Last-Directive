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
} as const;

export const isOre = (c: number) => c >= T.ORE_MIN && c <= T.ARTIFACT_MAX;
export const isDirt = (c: number) => c >= T.DIRT_MIN && c <= T.DIRT_MAX;
export const isRock = (c: number) => c >= T.ROCK_MIN && c <= T.ROCK_MAX;
export const isLava = (c: number) => c >= T.LAVA_MIN && c <= T.LAVA_MAX;
export const isSolid = (c: number) => c !== T.EMPTY && c !== T.HELL_AIR;
/** Bedrock and the hell-chamber shell can't be drilled. [est] */
export const isDrillable = (c: number) => isSolid(c) && c !== T.BEDROCK && c > -9;

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
