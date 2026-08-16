# The Last Directive

A remaster-in-spirit of the 2004 Flash game *Motherload*: dig down, haul ore
up, upgrade the pod, find out what's actually under the colony.

Set on **Venice** — a planet sold to investors on a name evoking water and
romance, which turned out to be a barren dig site. You are not a new hire.

## Running it

```bash
npm install --prefix game
npm run dev --prefix game
```

Then open http://localhost:5173.

Arrows or WASD to move. Hold a direction against soil to drill. Space at a
surface building to enter it, Esc to leave. `?wipe=1` clears the save,
`?seed=name` generates a different world.

A fresh save opens in the laboratory; Esc skips it. Reaching the chamber at
the bottom of the shaft plays the ending. Both are stored in the save, so
they each happen once — use `?wipe=1` to see them again.

```bash
npm run build --prefix game     # production build -> game/dist
```

## Layout

| Path | What |
|---|---|
| `game/src/data/spec.ts` | Every extracted constant, single source of truth |
| `game/src/world/world.ts` | Port of the original's `generateEarth()` |
| `game/src/game/pod.ts` | Physics, digging, cargo, damage |
| `game/src/game/intro.ts` | The opening — checklist doubles as the tutorial |
| `game/src/game/ending.ts` | The chamber, the directive, the choice |
| `game/src/render/` | Procedural tile textures, renderer, generated-art loader |
| `game/src/ui/crt.ts` | Pip-Boy UI chrome (bezel, phosphor, scanlines) |
| `game/tools/genart.mjs` | Background/sprite generation via Gemini |
| `game/process.html` | Chroma-key + trim + downscale pipeline for that art |
| `reference/motherload-spec.md` | Our measurements of the original |
| `remaster-plan.md`, `narrative-design.md` | Design and story direction |

## Art pipeline

Backgrounds and sprites are generated, then processed into game-ready assets:

```bash
npm run art --prefix game       # needs GEMINI_API_KEY in game/.env.local
```
Raw output lands in `game/art-src/`. Open `/process.html` in the dev server to
chroma-key, trim and downscale it into `game/public/art/`. Only the processed
set ships. Tile textures, the HUD and the fallback pod sprite are procedural,
drawn in code.

## On the original game

This project reimplements *behaviour* measured from the original Flash build
(physics constants, upgrade tables, world generation), which is functional
rather than expressive and safe to reimplement. See
`reference/motherload-spec.md`.

**No original assets are in this repository.** The extracted decompiled
source, sprites, audio and dialogue are XGen Studios' property, are used
locally as reference only, and are excluded via `.gitignore`. All art, audio,
text and names here are original work.

Two things still carry risk and are tracked in `remaster-plan.md`: the ore
names currently in `spec.ts` are still XGen's coinages and are placeholders
pending a rename, and the title has only had a search-engine check, not a
formal trademark search.

*Motherload* is © XGen Studios. This project is not affiliated with or
endorsed by them.
