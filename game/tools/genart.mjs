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
