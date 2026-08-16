/**
 * Generated art, preloaded before the game starts so tile textures are built
 * with the sprites already available (they're cached on first use, so a late
 * arrival would bake a spriteless tile in permanently).
 *
 * Every consumer falls back to the procedural drawing if a file is absent,
 * so the game still runs with an empty public/art/.
 */

const NAMES = [
  'pod', 'pod_body', 'pod_drill',
  'ore_0', 'ore_1', 'ore_2', 'ore_3', 'ore_4',
  'ore_5', 'ore_6', 'ore_7', 'ore_8', 'ore_9',
  'artifact_0', 'rock_0',
  'shop_fuel_t', 'shop_processor_t', 'shop_repair_t', 'shop_outfitter_t',
] as const;

const BACKDROPS = ['surface', 'mid', 'deep', 'lab'] as const;

/** Upgrade thumbnails: one per tier, sliced out of the per-category sheets. */
const PART_CATEGORIES = ['drills', 'hulls', 'engines', 'tanks', 'radiators', 'bays'];
const PARTS = PART_CATEGORIES.flatMap(
  (c) => Array.from({ length: 7 }, (_, i) => `part_${c}_${i}`));

const store = new Map<string, HTMLImageElement>();

export function img(name: string): HTMLImageElement | null {
  return store.get(name) ?? null;
}

function one(name: string, url: string): Promise<void> {
  return new Promise((resolve) => {
    const i = new Image();
    i.onload = () => { store.set(name, i); resolve(); };
    i.onerror = () => resolve();          // missing art is not an error
    i.src = url;
  });
}

/** Resolves once every asset has either loaded or failed. Never rejects. */
export async function loadAssets(): Promise<number> {
  await Promise.all([
    ...NAMES.map((n) => one(n, `art/${n}.png`)),
    ...PARTS.map((n) => one(n, `art/${n}.png`)),
    ...BACKDROPS.map((n) => one(`bg_${n}`, `bg/${n}.png`)),
  ]);
  return store.size;
}
