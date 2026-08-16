# The Last Directive — Project Plan

*(Working title locked. Formerly tracked as "Motherload Remaster" — this
file's name and internal references still say that in places, harmless,
can be cleaned up whenever.)*

## Decisions locked in

| Axis | Decision |
|---|---|
| Title | **The Last Directive** — search-checked, no conflicts found (one loose genre-neighbor, *Directive 8020*, different title, not a collision) |
| Fidelity | Between faithful and modernized — keep the core numbers/curve/story close to source, fix specific known pain points |
| Platform | Godot 4 — single project exports to Web (HTML5), native iOS/Android, and native Windows/Mac/Linux for Steam |
| Art | Pixel-art assets + modern rendering layer (dynamic lighting, particles, smooth motion) |
| Scale | Real release — App Store / Play Store / web / Steam, not just a hobby prototype |

## Design pillars — what stays, what changes

The [reference spec](reference/motherload-spec.md) is close to a design doc
already: every economy number, physics constant, and formula came out of the
real game code. Default posture is **keep the numbers**, and change only
things that are clearly friction rather than design intent.

**Keep faithful** (these define the game's identity):
- The dig/fuel/cargo tension loop and its pacing — mineral values, weights,
  upgrade price ladder ($750→$500K), drill/engine/hull/tank/radiator curves
- **Death from empty fuel, no softened fallback.** See the review analysis
  below — this is the single most load-bearing mechanic in the original and
  the most-cited reason the sequel felt hollow to its own fans.
- **Fully free-form digging.** No unbreakable blocks or forced routes
  anywhere outside of the hell-chamber/boss-floor special tiles the original
  itself used. Pick your own line down, always.
- **Procedurally natural terrain, not hand-placed puzzle rooms.**
  Reimplement the real `generateEarth()` distribution logic (spec has the
  exact algorithm) rather than designing bespoke maze/shape rooms.
- **Named, flavored upgrade tiers** — Silvide Drill, Goldium Drill, etc.,
  with real tooltip text, not "Drill Lv3." The spec has the exact names,
  prices, and stats already extracted.
- World depth and structure (36×600 tile map, stone at -1,500ft, lava at
  -3,000ft, gas at -4,750ft)
- Upgrades purchasable purely with cash the moment you can afford them — no
  story gate blocking a purchase you can pay for.
- The four-shop surface loop and NG+ structure
- The story beats (deceived-miner narrative, boss twist) — rewritten in your
  own words, same arc
- Soil hardening with depth, the continuous fall-damage-by-speed model, the
  exact gas-pocket damage formula

**Modernize** (friction, not design):
- **Marsquakes fully wiping the tunnel** → keep the hazard, soften the
  penalty (partial cave-in near the shaft, not total tunnel loss) — but keep
  it present and reasonably frequent; see below, removing it entirely turned
  out to be its own complaint in the sequel
- **The pod-sinking-into-corners glitch** → just a bug, fix it
- **Boss-fight browser-tab-pause exploit** → not applicable once it's not a
  browser tab exploit, but worth an explicit, fair pause instead
- **NG+ to 99x with per-cycle damage scaling to "impossible without
  hacking"** → keep NG+, retune the scaling so late cycles are hard, not a
  wall
- UI/UX: modern control remapping, no server-account save system (local +
  cloud save instead)

**Underground checkpoints — leaning against, not an open toss-up anymore.**
The plan previously floated this as a fix for "every full cargo run needs a
full surface trip." Review evidence below argues the opposite: players
specifically mourn the *loss* of the long climb and the sense of depth it
built. Current lean is **no checkpoint system**, or at most something very
limited (e.g. a single mid-depth cache far short of "bases at every layer").
Confirm after Phase 1 once the backtrack tension can be felt directly rather
than judged in the abstract.

## Lessons from Super Motherload's Steam reception

XGen's own sequel is the closest thing to a natural experiment this project
will ever get: same core team, same IP, same starting mechanics, and ~70
public reviews (many from people who loved the original) reacting to what
changed. Read in bulk, the negative reviews aren't scattered complaints —
the same handful of specific systemic changes get named independently over
and over, which is a much stronger signal than any single opinion:

1. **Removing death from empty fuel** was the most-repeated complaint by a
   wide margin — "you just move slower instead of dying," "the punishment
   for dying is just non-existing." Cited again and again as *the* reason
   the sequel lost the original's tension. Already folded into "keep
   faithful" above — this is the evidence for why.
2. **Story-gated upgrades** instead of cash-gated — "the game stops you
   from doing so until you arbitrarily reach a new chunk of story." Breaks
   the earn→spend→descend loop.
3. **Unbreakable blocks forcing a route** — "no longer possible to freely
   mine your own path," "more things you can't drill through than things
   you can" by the late game.
4. **Hand-crafted puzzle rooms instead of natural procedural terrain** —
   "it takes something away from the remote, isolated atmosphere when
   you're obviously working through a hand-made puzzle instead of an
   interesting geological formation."
5. **Generic numeric upgrade tiers, no flavor text** — "no tooltips, no
   flavor text, only generic names," "I kinda miss the different names for
   upgrades (ruby drill, diamond drill etc)."
6. **Underground bases reducing the sense of depth** — split opinion (some
   liked less backtracking), but more reviewers specifically missed "seeing
   through all the colourful layers" on the climb back up. Source of the
   checkpoint lean above.

**Boss fight** — near-universal criticism, including from reviewers who
liked everything else: requires reflexes/skills never used earlier in the
game, no checkpoint near the fight so a death means a multi-minute backtrack
from the last surface base, unfair corner-trap kills, no invincibility
frames after a hit. Concrete design constraints for Phase 6: telegraph any
skill the boss demands well before the fight, checkpoint immediately outside
the boss chamber (not "back at the last shop"), audit for inescapable
corner/geometry traps, add brief i-frames after damage.

**Bright, sterile visuals losing the original's atmosphere** — called out
independent of any gameplay complaint, e.g. "the world feels too bright...
kind of ruins the atmosphere." Reinforces the plan's lighting-forward art
approach (see Art direction below) — err toward moody/dim with deliberate
light sources, not evenly-lit clarity.

**Liked additions worth considering, additive only** (don't replace
anything on the faithful list, just sit on top of it):
- A smelter/combo system — combine minerals mined in sequence for a bonus
  value, rewarding route-planning without touching the core sell loop.
  **Undecided, deferred to backlog** — revisit once the core loop (Phases
  1-4) is solid and there's a real feel for whether the game wants it
- Full voice acting for the transmission script — budget/scope dependent
- Local co-op — if added, don't force shared fuel between players (cited
  as an annoyance); keep it clearly optional, single-player-first

**Operational lesson**: one specific bug (Esc force-quitting instead of
pausing) shows up in reviews from 2014 and from 2025 — over a decade
unfixed. Whatever the launch bug list looks like, plan for it to actually
get worked down post-launch, not just triaged once. The original flash
game's dev, by contrast, got singled out in a positive review for turning
around a reported bug fix within an hour — worth treating responsiveness
as a real part of the plan, not a footnote.

## Art direction: reconciling pixel art with modern graphics

Concretely, not just in principle:

1. **Assets are pixel art** — hand-authored sprite sheets, fixed low
   resolution per tile (bigger canvas than the original's 50px raw bitmaps —
   likely 32×32 or 64×64 source art, nearest-neighbor scaled), disciplined
   palette per depth stratum (the original's rust/steel/soil progression is
   a good starting reference, see `reference/bitmaps/` for the real palette).
2. **Rendering is modern**, layered on top of that pixel base:
   - Dynamic 2D lighting (drill glow, lava glow, gas pocket flash, headlamp
     cone in deep dark)
   - Particle systems for dig debris, explosions, thruster exhaust, ore
     sparkle — these don't need to be pixel-constrained themselves
   - Smooth tweened pod motion and camera (the original was frame-stepped;
     modern easing reads as "polished" without betraying the pixel-art look)
   - Screen-space bloom/glow on lava and boss effects, subtle parallax on
     background layers
   - Shader-based screen shake/damage flash instead of sprite-swap effects
3. Godot's `CanvasItem` lighting (`Light2D`/`PointLight2D`), `GPUParticles2D`,
   and its shader language make all of this native — no fighting the engine
   to get pixel-perfect assets to coexist with modern post effects.

## Legal / asset requirement — non-negotiable for a real release

Everything in `reference/decompiled/` (art, audio, exact dialogue text) is
XGen Studios' IP, extracted for **reference only**. For an App Store /
commercial release:

- **Art**: fully original, new pixel-art assets. The extracted bitmaps are a
  palette/silhouette reference, not source material to trace or crop from.
- **Audio**: fully original score and SFX. Do not ship the extracted MP3s.
- **Text**: the transmission dialogue needs to be **rewritten** — same story
  beats, your own words. Don't ship the extracted strings verbatim.
- **Names**: "Mr. Natas," "Motherload," specific line reads are the
  original's expression of the idea — the *concept* (a friendly employer
  who's secretly Satan, deceiving miners into a suicide dig) isn't ownable,
  but the specific character name and dialogue are. Rename and rewrite.
- The gameplay numbers/formulas themselves (prices, physics constants, damage
  formulas) are **not** copyrightable — game mechanics and balance numbers
  are functional, not expressive, so reimplementing the *behavior* from the
  spec is fine. This is the entire point of having extracted it as data
  rather than code to copy.

**Title — sharper than a generic trademark check, given Steam is a target.**
XGen Studios currently sells **"Super Motherload"** and **"Motherload Goldium
Edition"** on Steam, under those exact names, on the same storefront this
project would list on. That's not a background trademark risk to check off
once — it's a live competing product from the original IP holder on the
platform you want to launch on. A title that reads as "Motherload" or close
to it risks a trademark complaint that gets a listing pulled even after
launch, review or no review. The storefront title needs to be genuinely its
own — not a "Remastered"/"HD"/"Reborn" suffix on the original name.

**Locked: "The Last Directive."** Fully clear of "Motherload" — no reuse of
the name or a derivative of it, so this specific risk is resolved. It's also
thematically load-bearing now, not just a label: the title names the actual
plot mechanism (see [narrative-design.md](narrative-design.md)) — an order
given once, never rescinded, still being followed by something that's
forgotten why. Search-checked against existing titles: no exact match found;
the nearest genre-neighbor is *Directive 8020* (Supermassive Games, 2026),
different title, not a collision, just worth knowing "directive" is a live
word in sci-fi-horror titling right now. This was lightweight search
vetting, not a formal trademark/USPTO search — fine for killing obvious
conflicts now, worth a real check before committing to a storefront listing.

## Phase roadmap

| Phase | Deliverable | Depends on |
|---|---|---|
| 0. Foundation | Godot project skeleton, source control, confirm HTML5 export pipeline works end to end (even with a gray box) | — |
| 1. Core loop prototype | Pod movement/physics/digging using the spec's exact constants, gray-box art, single test shaft | 0 |
| 2. Economy & shops | Four shop UIs, mineral sell loop, upgrade tiers, save/load | 1 |
| 3. World generation | Reimplemented (not copied) generator matching the spec's depth curve and ore distribution, tuned to feel right at your chosen map size | 1 |
| 4. Hazards & survival | Lava, gas pockets, fall damage, marsquakes (redesigned), stone/dynamite | 2, 3 |
| 5. Narrative | Rewritten transmission script, new character names, story delivery UI — see [narrative-design.md](narrative-design.md) | — (parallel-able) |
| 6. Boss fight & ending | Two-phase boss, reward screen, NG+ retuned — telegraphed attacks, checkpoint just outside the chamber, no corner-trap deaths, brief i-frames (see review lessons above) | 4, 5 |
| 7. Art pass | Final pixel-art asset set + lighting/particle/shader layer | 1-6 stable enough to skin |
| 8. Audio | Original score + SFX pass | 7 |
| 9. Platform packaging | Web export polish, iOS/Android store builds, Steam build (GodotSteam integration, SteamPipe upload, Steam Direct $100 fee), store listing assets, ratings questionnaire | 6-8 |
| 10. Polish & QA | Playtesting, balance pass against the "keep faithful" numbers, bug fixing, soft launch, **plan for sustained post-launch bug response** (see operational lesson above) | 9 |

Each phase is a real milestone — playable and demoable on its own — rather
than a strict waterfall; narrative (5) and art (7 concepting) can run
alongside the systems phases.

## Open decisions still needed

- **Checkpoint system**: current lean is against it, or very limited at
  most — see the Steam-review evidence above. Recommend confirming after
  Phase 1 is playable and the original's backtrack tension can be felt
  directly rather than judged in the abstract
- **Team**: solo/duo (you + me) confirmed — worth flagging if art or audio
  need an outside contributor, since neither of us can produce final game art
  or music
- **Monetization**: premium, free-with-IAP, ad-supported — affects Phase 9
  scope and store requirements substantially, worth deciding before Phase 9
- **Timeline/budget**: no target set yet — fine to leave open, but worth
  revisiting once Phase 1-2 give a real sense of pace
- **Title**: needs a genuinely distinct name before any public/store-facing
  work (logo, listing, marketing) — see the Legal section above; XGen's own
  Steam listings make this higher-stakes than a typical indie trademark check
