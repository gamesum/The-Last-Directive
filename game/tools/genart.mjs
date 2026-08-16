/**
 * Background art generation via Google AI Studio (Gemini image models).
 *
 * Usage:  npm run art            -- generate everything missing
 *         npm run art -- --force -- regenerate all
 *         npm run art -- surface -- one target
 *
 * Key comes from GEMINI_API_KEY, or game/.env.local (untracked).
 * Only *backgrounds* are generated here. Tiles, the pod and all UI are
 * procedural/hand-authored in src/render/textures.ts.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', 'public', 'bg');
const SPRITE_SRC = resolve(HERE, '..', 'art-src');

function apiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  const envFile = resolve(HERE, '..', '.env.local');
  if (existsSync(envFile)) {
    const m = readFileSync(envFile, 'utf8').match(/^GEMINI_API_KEY\s*=\s*(.+)$/m);
    if (m) return m[1].trim();
  }
  throw new Error('No GEMINI_API_KEY (set the env var or game/.env.local)');
}

const MODEL = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-3-pro-image';

/**
 * Shared style contract. Every backdrop must sit behind hand-authored 50px
 * pixel tiles without fighting them: limited palette, chunky pixels, low
 * contrast, and dark enough that the foreground and HUD stay readable.
 */
const STYLE = [
  'Retro pixel art, 16-bit era, chunky visible square pixels, limited palette.',
  'Painted as a distant BACKGROUND layer: low contrast, hazy, desaturated,',
  'darker than a foreground would be, soft atmospheric depth.',
  'No text, no letters, no numbers, no logos, no watermark, no signature.',
  'No characters, no people, no creatures. No UI elements. No border or frame.',
].join(' ');

/**
 * Sprites are generated on a flat chroma-key field so the background can be
 * knocked out and the art trimmed to its content box. Models can't emit
 * alpha, so this is the reliable route.
 */
const CHROMA = [
  'The subject is centred and complete, isolated on a COMPLETELY FLAT, SOLID,',
  'UNIFORM pure magenta background, hex #FF00FF, filling every pixel that is',
  'not the subject. No gradient, no vignette, no texture, no shadow, no glow,',
  'and no reflection anywhere on the magenta. The subject must not touch the',
  'edges of the frame. Nothing else in the image.',
].join(' ');

const SPRITE_STYLE = [
  'Retro pixel art game sprite, 16-bit era, chunky visible square pixels,',
  'limited palette, crisp hard edges, strong readable silhouette,',
  'flat side-on orthographic view, no perspective, lit from upper left.',
  'No text, no letters, no numbers, no logos, no watermark, no signature.',
].join(' ');

const TARGETS = {
  surface: {
    aspect: '16:9',
    prompt: `${STYLE}
Wide panorama of an abandoned off-world mining outpost at deep dusk, seen from
ground level across a flat dust plain. Silhouetted derelict prefab habitat
blocks and cargo gantries on the horizon, half-buried in drifted grey dust.
Skeletal collapsed radio masts and a toppled cooling tower. A few tiny dim
amber window lights still burning in otherwise dark structures.
Sky graduates from deep indigo at the top through dull violet to a cold rust
orange at the horizon. Faint band of stars high up. Thin haze layer at the
horizon line. Utterly still and empty. Melancholy, industrial, forgotten.`,
  },
  deep: {
    aspect: '16:9',
    prompt: `${STYLE}
An enormous hollow cavern void far underground, pitch dark, seen as a distant
background. Vast basalt walls receding into blackness. Faint cold blue-green
mineral luminescence bleeding from cracks in the far rock face. Suspended dust.
Almost entirely black with only the faintest structure visible. Oppressive,
airless, immense scale, deeply unsettling emptiness.`,
  },

  /** Mid-depth backdrop so the descent reads as a continuous gradient. */
  mid: {
    aspect: '16:9',
    prompt: `${STYLE}
A distant background of deep rock strata, seen far behind the foreground.
Layered sedimentary bands in muted grey-brown fading to cold slate blue with
depth. Occasional thin pale mineral seams threading horizontally through the
rock. Hazy, dim, receding into darkness at the edges. No cave mouth, no
opening, just deep dense stone. Quiet and heavy.`,
  },

  /** Opening-scene backdrop: the laboratory the player wakes up in. */
  lab: {
    aspect: '16:9',
    prompt: `${STYLE}
Interior of a long-abandoned off-world research laboratory, seen side-on as a
flat game background. A row of tall cylindrical specimen tanks along the back
wall, most cracked and drained, two still full of murky green fluid with
indistinct shapes suspended inside. Dead control consoles with dark screens.
Scattered debris and toppled equipment. Thick dust, hanging cables, a single
failing overhead light casting weak cold blue-green illumination. Decades of
neglect. Clinical, silent, deeply wrong. No people, no skeletons in focus.`,
  },

  machine: {
    aspect: '1:1',
    sprite: true,
    prompt: `${SPRITE_STYLE} ${CHROMA}
A compact armoured mining vehicle facing RIGHT, viewed exactly from the side.
Olive-drab and dull military green riveted metal hull, stubby and boxy and
wider than it is tall. A large conical steel drill bit mounted on the front
right. A small dark angular cockpit window near the front with faint cyan
glass. Heavy black rubber caterpillar tracks along the bottom. Two small
thruster nozzles beneath the belly. Weathered, scratched, industrial,
utilitarian. Looks heavy and slow and well used.`,
  },

  /**
   * The machine is generated in two pieces so the drill can be aimed at
   * whatever it is cutting. Slicing a one-piece sprite always cut through
   * some part of the body; separate art means the hull is never touched.
   */
  machine_body: {
    aspect: '1:1',
    sprite: true,
    prompt: `${SPRITE_STYLE} ${CHROMA}
An armoured mining vehicle hull in strict side view, unmistakably FACING AND
TRAVELLING TO THE RIGHT, WITH NO DRILL OR DRILL BIT OF ANY KIND.

The silhouette must make the direction obvious at a glance:
- The RIGHT end is the FRONT. It is lower and wedge-shaped, sloping down and
  forward like the prow of a bulldozer, and terminates in a small flat round
  mounting plate ringed with bolt heads where a tool would attach.
- A rounded armoured cockpit canopy sits high on the FRONT HALF, just behind
  the prow, with dark angular glass lit faint cyan and a heavy brow visor
  over it.
- The LEFT end is the REAR. It is tall, blunt and square, with a raised
  engine housing, a ribbed radiator grille and two short exhaust stacks
  pointing up and back.
- Heavy black caterpillar tracks run the full length along the bottom, with
  a large drive sprocket at the rear and a smaller idler wheel at the front.
- Two short bell-mouthed thruster nozzles point straight DOWN from the belly
  between the tracks. The nozzles are COLD AND SHUT DOWN: bare dark metal
  bells with nothing coming out of them. No flame, no fire, no exhaust, no
  jet, no plume, no glow, no sparks, no smoke anywhere in the image.

Olive-drab and dull military green plate armour with visible rivet lines,
weld seams, scuffed paint and rust streaks. Chunky, heavy, purposeful.
Absolutely no cone, no auger, no spike, no drill anywhere in the image.`,
  },

  drill_bit: {
    aspect: '1:1',
    sprite: true,
    prompt: `${SPRITE_STYLE} ${CHROMA}
A single heavy conical mining drill bit, alone, pointing RIGHT, viewed exactly
from the side. Polished dark steel cone with deep spiral cutting flutes
winding around it to a sharp point at the right. A short cylindrical collar
with bolt heads at the LEFT end where it mounts. Scratched and worn metal,
cold grey with brown wear staining. Just the drill bit and nothing else — no
vehicle, no hull, no machine, no background object, no hands, no mount.
The cone's axis is exactly horizontal and it fills most of the frame.`,
  },

  ores: {
    aspect: '1:1',
    sprite: true,
    prompt: `${SPRITE_STYLE} ${CHROMA}
A neat grid of TWELVE separate mineral ore clusters arranged in 3 rows of 4,
evenly spaced with clear magenta gaps between every cluster. Each cluster is a
small tight cluster of angular gemstone crystal shards. Row 1 left to right:
rusty iron brown, warm bronze, pale silver, bright gold. Row 2: pale mint
platinum, deep violet, vivid emerald green, blood red ruby. Row 3: brilliant
pale cyan diamond, luminous turquoise, chalky bone white, dull grey stone.
Each cluster identical in size and framing, sharp faceted highlights.`,
  },
};

/**
 * Upgrade parts, one sheet per category, 4 across by 2 down, read left to
 * right and top to bottom in ascending tier. Sliced by process.html the same
 * way the ore sheet is. Described by appearance rather than by the tier names
 * in spec.ts, since several of those are still placeholders.
 */
/**
 * Laid out as a SINGLE HORIZONTAL ROW rather than a grid.
 *
 * A grid was unreliable: asked for 4x2, the model returned 4x2 for one sheet,
 * 3x3 for another, and ruled black lines between the cells on a third. Worse,
 * it drew a different number of subjects than asked, so the splitter had to
 * guess which ones were tiers — and guessing wrong once dropped a middle tier
 * and once promoted a stray fragment to the top tier. One row of N is easy to
 * count and easy to split, and leaves nothing to guess.
 */
const PART_SHEET = (subject, tiers, count) => ({
  aspect: '16:9',
  sprite: true,
  prompt: `${SPRITE_STYLE} ${CHROMA}
A SINGLE HORIZONTAL ROW of exactly ${count} ${subject}, side by side in one
straight line, evenly spaced across the full width of the image, with a clear
wide band of flat magenta between every neighbouring item so that none of them
touch or overlap. Exactly ${count} items, no more and no fewer. No grid, no
frames, no boxes, no dividing lines, no second row.
Every item is complete, unclipped, the same size, and drawn at the same
three-quarter angle. Reading LEFT TO RIGHT they ascend in quality, each one
clearly more elaborate and more valuable than the one before, and NO TWO ARE
ALIKE:
${tiers}`,
});

const PARTS = {
  part_drills: PART_SHEET('mining drill bits standing upright, point downward', `
1 a plain worn steel auger, chipped and rusty.
2 a clean bright silver bit with polished flutes.
3 a brass and gold bit with an ornate collar.
4 a bit set with green emerald cutting teeth.
5 a bit set with deep red ruby cutting teeth.
6 a bit ringed with brilliant white diamond studs.
7 an exotic glowing turquoise crystal bit wreathed in faint energy.`, 7),

  part_hulls: PART_SHEET('armour hull plates, each a curved chest-plate section', `
1 thin dented grey sheet metal with peeling paint.
2 rough rust-brown iron plate with heavy rivets.
3 warm bronze plate with a raised ridge.
4 blue-grey tempered steel plate, clean welds.
5 pale silvery platinum plate, mirror finish.
6 dark violet-blue exotic alloy plate with a faint sheen.
7 a translucent cyan energy shield panel glowing from within.`, 7),

  part_engines: PART_SHEET('automotive engine blocks', `
1 a small dull grey single-cylinder engine, oil-stained.
2 a compact four-cylinder block with a red valve cover.
3 a four-cylinder block with a fat chrome turbocharger.
4 a larger six-cylinder block with chrome headers.
5 a big supercharged V8 with a blower sticking out the top.
6 a huge twelve-cylinder block in deep blue with chrome runners.
7 a monstrous polished sixteen-cylinder block, gold and chrome.`, 7),

  part_tanks: PART_SHEET('pressurised fuel tanks lying horizontally', `
1 a tiny scuffed steel canister with hazard stripes.
2 a medium grey cylinder with a green level window.
3 a large cream-coloured cylinder with banding straps.
4 a very large ribbed tank in dull red.
5 an enormous pale green tank with a glowing level gauge.
6 a pair of huge linked blue tanks with pressure valves.
7 a sleek white compression vessel ringed with cryogenic frost.`, 7),

  part_radiators: PART_SHEET('cooling radiator and fan units seen face on', `
1 a small single grey fan in a plain square housing.
2 twin grey fans side by side in one housing.
3 a single large red turbine fan with a chrome ring.
4 twin blue turbine fans with chrome rings.
5 a tall finned radiator with a white spiral impeller.
6 a triple-turbine array with glowing blue coolant tubes.`, 6),

  part_bays: PART_SHEET('open-topped cargo ore bins seen from a high angle', `
1 a tiny battered steel crate with an orange interior.
2 a plain grey bin with reinforced corners.
3 a wide dull red bin with heavy rims.
4 a very large twin-compartment grey hopper.
5 an enormous pale industrial hopper with hydraulic rams.
6 a colossal armoured container with warning markings.`, 6),
};

for (const [name, spec] of Object.entries(PARTS)) TARGETS[name] = spec;

/** The four surface facilities, generated with a shared house style. */
const FACILITIES = {
  shop_fuel: 'a squat fuel depot with a large riveted cylindrical propellant tank on top, thick pipes and a hose reel',
  shop_processor: 'an ore processing plant with a hopper funnel on top, a conveyor belt stub and a stubby chimney',
  shop_repair: 'a repair garage with a wide roller shutter door, a gantry crane arm and tool racks',
  shop_outfitter: 'an equipment outfitter shed with stacked supply crates, an antenna mast and a small awning',
};

for (const [name, desc] of Object.entries(FACILITIES)) {
  TARGETS[name] = {
    aspect: '1:1',
    sprite: true,
    prompt: `${SPRITE_STYLE} ${CHROMA}
A small single-storey prefabricated off-world outpost building: ${desc}.
Weathered corrugated metal walls in muted grey and rust, bolted panels,
half-buried in pale dust at the base. One or two small windows lit warm amber
from within, everything else dark. Built for a harsh airless world.
Looks old, patched and barely maintained. Viewed straight on from the side.`,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generate(name, spec, key, attempt = 0) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const body = {
    contents: [{ parts: [{ text: spec.prompt }] }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: spec.aspect },
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    // 503 = model overloaded, 429 = rate limited. Both are usually transient.
    if ((res.status === 503 || res.status === 429) && attempt < 4) {
      const wait = 5000 * 2 ** attempt;
      console.log(`  .... ${name}: HTTP ${res.status}, retrying in ${wait / 1000}s`);
      await sleep(wait);
      return generate(name, spec, key, attempt + 1);
    }
    throw new Error(`${name}: HTTP ${res.status}\n${text.slice(0, 400)}`);
  }

  const json = JSON.parse(text);
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const img = parts.find((p) => p.inlineData?.data);
  if (!img) {
    throw new Error(`${name}: no image in response\n${JSON.stringify(json).slice(0, 600)}`);
  }

  // Sprites are raw source art: they get chroma-keyed and downscaled by
  // process.html into public/art/. Keeping them out of public/ stops half a
  // megabyte each of unused originals shipping in the build.
  const dir = spec.sprite ? SPRITE_SRC : OUT;
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `${name}.png`);
  writeFileSync(file, Buffer.from(img.inlineData.data, 'base64'));
  const kb = (Buffer.from(img.inlineData.data, 'base64').length / 1024) | 0;
  console.log(`  ok  ${name}.png  (${kb} KB)`);
}

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('--'));
const key = apiKey();

console.log(`model: ${MODEL}`);
for (const [name, spec] of Object.entries(TARGETS)) {
  if (only.length && !only.includes(name)) continue;
  const dest = spec.sprite
    ? resolve(SPRITE_SRC, `${name}.png`)
    : resolve(OUT, `${name}.png`);
  if (!force && existsSync(dest)) {
    console.log(`  skip ${name}.png (exists; --force to redo)`);
    continue;
  }
  try {
    await generate(name, spec, key);
  } catch (err) {
    console.error(`  FAIL ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}
