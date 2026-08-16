# Motherload — Extracted Reference Spec

Source: `8khsgfbehb000t_v937.swf` (XGen official build). Two extraction methods
were used, in order of reliability:

1. **`decompiled/`** — real ActionScript 2 source, produced by **JPEXS Free
   Flash Decompiler (FFDec) v26.2.1** via its CLI (`tools/ffdec/`), the
   standard open-source AS2/AS3 decompiler. This is ground truth: readable
   `if`/`while`/`function` source, not a hand-traced guess. Everything
   tagged **[ffdec]** below is copy-pasted from this output.
2. **`v937_dis_full.txt`** — a hand-rolled bytecode disassembler
   (`swfdis.py`) used before FFDec was set up. Tagged **[swf]**. Where both
   exist for the same value, they agree, which is a useful cross-check —
   but treat **[ffdec]** as authoritative going forward, and prefer it for
   anything not yet re-verified.

**If you only take one thing from this file: re-run FFDec.** It exported all
500 scripts across the SWF as real source in ~12 seconds
(`java -jar ffdec-cli.jar -export script,shape,sound,image,text,symbolClass
<outdir> <file.swf>`), correctly reconstructing the ore-generation algorithm
that hand-tracing couldn't safely resolve, and it caught a real error in the
wiki's fall-damage claim (below). It's the reliable path for anything still
open in this document — vector art, boss logic, `getDepth()`, per-mineral
spawn tuning — all of it is sitting in `decompiled/scripts/frame_1/DoAction.as`
and the other 499 files, just not all read yet.

Confidence key: **[ffdec]** real decompiled source (highest) · **[swf]** hand
bytecode trace · **[wiki]** fan wiki · **[est]** estimate · **[?]** unknown

---

## File facts **[swf]**

| Property | Value |
|---|---|
| SWF version | 8 (ActionScript 2) |
| Frame rate | **42 fps** |
| Uncompressed size | 4,444,286 bytes |
| Compression | zlib (`CWS`) |

Frame rate is the master scale factor: every per-frame constant below must be
multiplied by 42 to get per-second values.

## Physics globals **[swf]**

| Constant | Value |
|---|---|
| `gravity` | 9.81 |
| `friction` | 0.94 |
| `airResistance` | 0.98 |
| `scrollSpeed` | 10 |
| `dayLength` | 2880 frames (~68.6 s) |

Integration, per frame:

```
xVel *= airResistance          // 0.98
yVel *= airResistance
yVel  = Math.min(20, yVel + gravity/30)
```

Terminal velocity is therefore **20 units/frame = 840 units/s**. Note the game
divides gravity by 30 while running at 42 fps — the constant is not a real-world
g, it is a tuned number.

## Pod defaults **[swf]**

| Property | Value |
|---|---|
| `mass` | 198 |
| `width` / `height` | 20 / 20 |
| starting `hp` | 10 |
| starting `fuel` | 6 |
| `facing` | left |

The wiki's "1980 kg" is this 198 × 10. The wiki scales mass, drill speed and
mineral weight by 10 throughout; the raw units are below.

## Equipment tables **[swf]**

All arrays are stored best-first in the SWF; listed here worst-first (index 6 → 0).

### Drills
| Tier | Name | Speed | Price |
|---|---|---|---|
| 0 | Stock Drill | 2 | 0 |
| 1 | Silvide Drill | 2.8 | 750 |
| 2 | Goldium Drill | 4 | 2,000 |
| 3 | Emerald Drill | 5 | 5,000 |
| 4 | Ruby Drill | 7 | 20,000 |
| 5 | Diamond Drill | 9.5 | 100,000 |
| 6 | Amazonite Drill | 12 | 500,000 |

### Hulls
| Tier | Name | HP | Price |
|---|---|---|---|
| 0 | Stock Hull | 10 | 0 |
| 1 | Ironium Hull | 17 | 750 |
| 2 | Bronzium Hull | 30 | 2,000 |
| 3 | Steel Hull | 50 | 5,000 |
| 4 | Platinium Hull | 80 | 20,000 |
| 5 | Einsteinium Hull | 120 | 100,000 |
| 6 | Energy-Shielded Hull | 180 | 500,000 |

### Engines
| Tier | Name | Power | Price |
|---|---|---|---|
| 0 | Stock Engine | 150 | 0 |
| 1 | V4 1600 cc | 160 | 750 |
| 2 | V4 2.0 Ltr Turbo | 170 | 2,000 |
| 3 | V6 3.8 Ltr | 180 | 5,000 |
| 4 | V8 Supercharged 5.0 Ltr | 190 | 20,000 |
| 5 | V12 6.0 Ltr | 200 | 100,000 |
| 6 | V16 Jag Engine | 210 | 500,000 |

### Fuel tanks
| Tier | Name | Capacity | Price |
|---|---|---|---|
| 0 | Micro Tank | 10 | 0 |
| 1 | Medium Tank | 15 | 750 |
| 2 | Huge Tank | 25 | 2,000 |
| 3 | Gigantic Tank | 40 | 5,000 |
| 4 | Titanic Tank | 60 | 20,000 |
| 5 | Leviathan Tank | 100 | 100,000 |
| 6 | Liquid Compression Tank | 150 | 500,000 |

### Radiators
Stored as a **damage multiplier**, not a percentage. Damage taken = base × value.

| Tier | Name | Multiplier | Price |
|---|---|---|---|
| 0 | Stock Fan | 1.0 | 0 |
| 1 | Dual Fans | 0.9 | 2,000 |
| 2 | Single Turbine | 0.75 | 5,000 |
| 3 | Dual Turbines | 0.6 | 20,000 |
| 4 | Puron Cooling | 0.4 | 100,000 |
| 5 | Tri-Turbine Freon Array | 0.2 | 500,000 |

### Cargo bays
| Tier | Name | Size | Price |
|---|---|---|---|
| 0 | Micro Bay | 7 | 0 |
| 1 | Medium Bay | 15 | 750 |
| 2 | Huge Bay | 25 | 2,000 |
| 3 | Gigantic Bay | 40 | 5,000 |
| 4 | Titanic Bay | 70 | 20,000 |
| 5 | Leviathan Bay | 120 | 100,000 |

## Minerals **[swf]**

Constructor signature is `mineral(name, value, weight)`.

| Mineral | Value | Weight |
|---|---|---|
| Ironium | 30 | 1 |
| Bronzium | 60 | 1 |
| Silverium | 100 | 1 |
| Goldium | 250 | 2 |
| Platinium | 750 | 3 |
| Einsteinium | 2,000 | 4 |
| Emerald | 5,000 | 6 |
| Ruby | 20,000 | 8 |
| Diamond | 100,000 | 10 |
| Amazonite | 500,000 | 12 |
| Dinosaur Bones | 1,000 | 1 |

In-game spelling is **"Platinium"** (the wiki uses both spellings).

## World generation **[swf, partially decoded]**

`generateEarth()` opens with `mineralRate = 65` and fills a
`earth[x][y]` array over `earthWidth` × `earthHeight`. Tile codes seen so far
include `0` (empty, top 5 rows), `-999`, `-8`, and randomised negatives near the
surface band. Full decode still pending — see Open Questions.

## Cheat codes **[swf, confirmed in shipped text file]**

`blingbling` +$100,000 · `supersize` bay · `penetrable` hull · `warp9` engine ·
`toocool` radiator · `guzzle` fuel tank · `digdug` drill ·
`ntouchable` max everything + 99 of every item

## Corrections to the fan wiki

| Wiki claim | Reality **[swf]** |
|---|---|
| Drill speeds 28–120 "ft/s" | 2–12 raw; the ft/s framing and ×10 are the wiki's |
| Pod mass 1,980 kg | 198 |
| Mineral weights 10–120 kg | 1–12 |
| Gigantic Bay $50,000 | $5,000 — confirmed wiki typo |
| Radiator "effectiveness %" | Stored as multiplier; % = 1 − multiplier (consistent) |
| "8 drills / 9 engines" (XGen wiki) | 7 entries per array including Stock |
| Stock tiers unlisted | Stock exists for all six categories with real values |

## Movement & fuel — decoded from the sprite-local `move` handler **[swf]**

The original disassembler only walked top-level `DoAction`/`DoInitAction` tags;
`swfdis.py` now recurses into `DefineSprite` timelines too (`v937_dis_full.txt`,
62,636 lines), which is where the pod's actual per-frame movement code lives —
it's a `MovieClip` behaviour, not a document-level script.

**Tile size:** 50 px (confirmed independently in `startDigging()` and matches
the 592-square-to-Hell math worked out from the mineral table below).

**World size:** `earthWidth = 36`, `earthHeight = 600` tiles. At 50 px/tile
that's 1800×30000 px. 600 rows − ~8 rows of sky ≈ 592 diggable rows, which
matches the wiki's independently-derived "592 squares to -7400 ft" almost
exactly — good cross-validation between two unrelated methods.

> **CORRECTED 2026-08-15 against FFDec `vehicle.prototype.move` (lines
> 2569–2699).** The hand-traced versions previously printed here were wrong:
> they read `enginePower/10` as the *acceleration* term, which would saturate
> the velocity cap on frame one and make engine upgrades do nothing. In the
> real code `enginePower/10` is the **cap** and `enginePower/getMass()` is the
> **acceleration** — which is what makes cargo mass matter. **[ffdec]**

**Horizontal thrust** (per frame):
```
// on the ground
xVel = min(xVel + enginePower/getMass(),       enginePower/10)
// in the air (weaker)
xVel = min(xVel + enginePower/getMass()/1.5,   enginePower/10)
fuel -= enginePower / 50000
```

**Vertical thrust, ascending:**
```
// pushing off the ground — doubled kick
yVel = max(yVel - enginePower/getMass()*2, -enginePower/10)
// in the air
yVel = max(yVel - enginePower/getMass(),   -enginePower/12)
// in the air while also steering left/right
yVel = max(yVel - enginePower/getMass()/1.5, -enginePower/12)
_rotation = clamp(_rotation ± enginePower/50, -15, 15)
fuel -= enginePower / 50000
rotorVel = min(11, rotorVel + 0.3)   // +1 when thrusting straight up
```

**Idle fuel drain — previously undocumented.** Every frame the pod is alive,
regardless of input:
```
fuel -= enginePower / 100000
```
This is why hovering is never free and why the 6 L starting tank is a real
clock: a stock engine burns 0.063 L/s doing nothing at all.

**Mass is the real difficulty curve.** Acceleration is `enginePower/getMass()`
while gravity adds a flat `9.81/30 = 0.327` per frame. A full Leviathan bay of
Amazonite (120 × 12 = 1440) against base mass 198 gives 210/1638 = 0.128 —
**less than gravity**, so a maxed pod physically cannot lift a full load of the
best ore. That is a designed wall, not a bug.

**Collision extents.** `this.width`/`this.height` (both 20) are used as
*half*-extents (`_x + width`, `_x - width`), so the pod's collision box is
**40 × 40 px**, not 20 × 20.

**Rest thresholds:** `|xVel| < 0.12 -> 0`, `|yVel| < 0.07 -> 0`.

**Mass model:**
```
getMass() = mass + sum(cargo[i].mass for each held mineral)
```
Base `mass = 198`. This is exactly the wiki's "1,980 kg" ÷ 10 — the wiki
uniformly multiplies mass/weight/drill-speed by 10 for display, which is
also confirmed directly: the upgrade-shop label literally builds the string
`drillSpeed × 10 + " ft/s"`, i.e. "ft/s" in the wiki is XGen's own in-game
label, not a wiki invention.

**Falling / passive gravity** (every frame, `mod == "air"`):
```
xVel *= airResistance      // 0.98
yVel *= airResistance
yVel  = min(20, yVel + gravity/30)     // gravity = 9.81
```
Terminal velocity: 20 units/frame × 42 fps = 840 px/s = 16.8 tiles/s.

**Digging** — lives in a separate 5-frame sprite (id 476) spawned while `mod
== "digging"`:
```
digVel = 0.5 × drillSpeed
depth  = (earthMC._y - atvMC._y - 204) / 4      // tiles from surface, roughly
digVel = digVel / (1 + max(0, depth)/1000)      // soil hardens with depth
fuel  -= enginePower / 25000                     // per frame, double the flight rate
```
So soil hardness is real and roughly linear: at 1,000 tiles-of-depth-units
digging is half speed, at 2,000 a third, etc. (Note: `depth` here is a raw
pixel/tile expression, not feet — converting to the in-game foot display
needs the `getDepth()` function, not yet traced.)

**Repair cost:** confirmed exactly — `repairCost = 15` ($/HP), matching the
wiki.

## Gas pocket damage — confirmed exact formula **[swf]**

```
hp -= ((depth + 3000) / 15 as int) × radiatorCooling
```
`radiatorCooling` here is the multiplier from the equipment table above
(1.0 → 0.2, not a percentage), so the wiki's independently-reverse-engineered
formula (`(depth+3000)/15 × (1 − radiator%)`) was **exactly right** — this
fully confirms it rather than replaces it.

## Marsquakes — confirmed gate, undocumented anywhere else **[swf]**

```
earthQuakeChance():
    if score > 150000 and random(20) == 0:
        earthQuake()
```
So marsquakes cannot happen at all below 150,000 score, and above that
threshold there's a flat 1-in-20 roll each time the check fires (on shop
entry, per the wiki's own empirical finding). Nobody had the threshold before.

## checkTransmissions — trigger logic (not full depth table) **[swf]**

```
checkTransmissions():
    if (maxDepth - transmissions[lastTransmission+1].depth) > 0
       and lastTransmission >= 0 and dayTime > 40:
        <fire earthQuakeChance and the next transmission>
```
Confirms transmissions are a simple ordered array walked by depth, matching
the wiki's list. The dialogue strings themselves are fully recovered (see
Dialogue below) — the per-entry depth values weren't independently
re-derived this pass since the wiki's list already reads directly from this
same array structure.

## Full mineral/reward table, including hidden entries **[swf]**

The `minerals` array in `v937_dis_full.txt` (~line 1430) has **24 entries**,
not 10 — the ore table plus every artifact and every boss-ending reward item,
all defined through the same `mineral(id, weight, value, name)` constructor:

| id | Name | Weight | Value |
|---|---|---|---|
| 0–9 | Ironium … Amazonite | (see Minerals table above) | |
| 10 | Dinosaur Bones | 1 | 1,000 |
| 11 | Treasure | 1 | 5,000 |
| 12 | Martian Skeleton | 1 | 10,000 |
| 13 | Religious Artifact | 1 | 50,000 |
| 14 | Mr. Natas' Kevlar Suit | 1 | 50,000 |
| 15 | Mr. Natas' Staff of Hell | 1 | 100,000 |
| 16 | Mr. Natas' Laser Monacle | 1 | 200,000 |
| 17 | Satan's Hooves | 1 | 300,000 |
| 18 | Satan's Horns | 1 | 400,000 |
| 19 | Satan's Evil Eye (right) | 1 | 500,000 |
| 20 | Satan's Evil Eye (left) | 1 | 500,000 |
| 21 | Satan's Boiler of Eternal Infernos | 1 | 600,000 |
| 22 | Martian Reward for Restoring Peace | 1 | 1,000,000 |
| 23 | 250,000 Shares of Natas HI Inc. | 1 | 25,000,000 |

Sum of ids 14–23 = **$28,650,000**, matching the wiki's "$28.5M" ending reward
(their figure was a rounded approximation; this is the exact number).

Item shop table (`item()` constructor, name/hotkey/description/price) also
fully recovered — matches the wiki's Emendation Station table exactly,
including the flavour text (e.g. Reserve Fuel Tank: *"Portable backup -
refills up to 25 Liters instantaneously."*).

## World generation — structure decoded, full formula not hand-verified

`generateEarth()` (`v937_dis_full.txt` lines 8710–9665, ~960 bytecode lines)
opens with `mineralRate = 65` and:

- builds `earth[x][y]` for `x < 36`, `y < 600`
- top 5 rows are air (`tile[0] = 0`)
- row 5 and the bottom ~12 rows are special-cased (`-999`, `-8`,
  `9+random(4)` codes) — almost certainly the hell-chamber/boss-floor tiles
- `op_30` = AS2's `ActionRandomNumber` opcode (0x30) — not in standard
  disassembler tables, identified by cross-referencing its usage pattern
  against known random-dependent behaviour (mineral scatter, sub-tile
  texture variant `tile[1] = random(4)`)
- ore placement itself uses `random(int(y/mineralRate) + 2)`-shaped
  expressions scaled against per-mineral thresholds

I stopped short of hand-converting this to a certain closed-form probability
table: AS2 stack bytecode is genuinely ambiguous to trace by eye once
`Math.min`/`CallMethod` argument order comes into play, and a wrong formula
presented as verified would be worse than an honest gap. This is the one
item on the list that really wants a proper AS2 VM (JPEXS Free Flash
Decompiler decompiles this to real `if`/`for` source directly) rather than
more manual reading.

## Assets extracted **[swf]**

- **407 bitmaps**, pixel-exact, as PNG — `swfbitmaps.py` decodes
  `DefineBitsLossless`/`Lossless2` (paletted and 32-bit ARGB) directly from
  the SWF's zlib streams. Confirmed by inspection: all four shop UI panels
  (Propellant Vendor, Mineral Processor, Autobuy 2000, Emendation Station),
  the pod sprite in multiple facing/animation frames, 50×50 soil/ore tile
  art, item icons. Zero decode failures out of 407.
- **83 audio clips** — `swfaudio.py` extracts `DefineSound` payloads.
  79 MP3, 4 ADPCM. Three tracks (IDs 1959/1960/1961, ~250-265 KB, several
  minutes each) are almost certainly the three `BGM*` cues seen in the
  code (`BGMmain`, `BGMshop`, and the boss theme) — this fully resolves
  the "soundtrack completely unknown" gap; files are in `audio/`.
- **609 vector shapes** (`DefineShape*`) not yet extracted — rasterising
  these needs real shape-record parsing (fill styles, edges, gradients).
  JPEXS territory if wanted; bitmaps covered the highest-value assets.

## Build diff — the 8 archived versions **[swf]**

All 8 extracted builds decompress and disassemble cleanly. Headline finding:
**`8khsgfbehb000t_v937.swf` and `8khsgfbehb.swf` are byte-identical** (same
tag histogram, same string count) — two filenames for one file.

Demo (`motherloaddemo-914.swf`) vs. full XGen build (`v937`), diffed on
unique constant-pool strings:

- Demo is missing 138 strings present in the full game: **every** deep
  transmission ("The eyes... oh my god"), both trapped-miner messages, both
  Mr. Natas boss taunts, all reward-item names, the account/save system text
  — i.e. everything past the -825 ft demo wall, confirming the wiki's
  "endless stone below -825 ft" claim from the string level, not just
  observed play.
- Demo has 8 strings the full game lacks, including the exact depth-bonus
  wording confirming **-700 ft** (not -500 ft) as the demo's first bonus
  checkpoint — matches the wiki's separately-sourced claim exactly.
- Version string `0.914 DEMO` vs `0.937` confirms the numbering scheme the
  archive filenames use.

`motherload_933.swf` and the two Newgrounds/Miniclip 1269 builds have
markedly different tag-56 counts (1078–1127 vs ~339 in v937) — tag 56 is
`ExportAssets`, suggesting older/alternate builds exported far more named
symbols (likely for a shared-library or ad-wrapper linkage XGen later
dropped). Not further chased this pass.

## Ground truth from FFDec — confirms, and corrects, the hand-traced pass **[ffdec]**

All in `decompiled/scripts/frame_1/DoAction.as` unless noted.

**`generateEarth()` (line 1475)** — the real algorithm, previously the
biggest gap. Nested `random(5)==0` checks (5×5×5×4 ≈ 1-in-2500 chance) gate
the rarest ore band; the common case is `random(5)+1` (ores 1-5, i.e.
Ironium-Einsteinium) with a depth-scaled chance of upgrading to a rock/lava
tile (25-31) once `depth×1.5 > earthHeight/3`. Ore *tier* on the rare path is
`min(random(int(y/65)+2) + {6,7,8}, 15)` depending on which nesting level
hit — so richer ore bands do open up gradually with `y`, but bounded at 15
(index into the tile table) regardless of depth, capping how deep you need
to go before the best ore starts appearing. Hand-carved special tiles exist
at fixed coordinates near the top of the map (artifact/tutorial placement,
e.g. `earth[3][3][0] = -125` etc.) — likely fixed early bonus pickups, not
random loot.

**Fall damage — corrects the wiki, not just confirms it.** Real formula
(`vehicle.prototype.move`, ~line 2760):
```
if (yVel > 0 and landing on ground):
    if yVel > 7:
        damage(yVel / 2)      // int-truncated inside damage()
    yVel *= -0.2               // bounce
```
It's a **continuous function of landing speed**, not the wiki's discrete
6-tier height table. Minimum triggering damage is `int(7.0001/2) = 3` (matches
the wiki's reported minimum), but maximum is `int(20/2) = 10` since terminal
velocity is 20 — **the wiki's claimed max of 8 is wrong.** There's also a
separate, smaller collision case for hitting a ceiling while ascending
(`yVel < 0`), which just kills velocity with no damage term found nearby.

**`getMass()` and `damage()`** (lines 2481, 2492) — both match the
hand-traced **[swf]** versions exactly, word for word in logic. Good
cross-validation of the manual method where it was used.

**`hitGasPocket()`** (line 960) and **`earthQuakeChance()`** (line 1423) —
also both match the hand-traced formulas exactly, including the `score >
150000` marsquake gate.

## Open questions — what's left

Genuinely open, but now known to be one FFDec read away rather than requiring
more bytecode archaeology:

- ~~**`getDepth()` / pixel-to-feet conversion**~~ — **SOLVED [ffdec]**, in
  `updateHUD()`: `depth = int((earthMC._y - atvMC._y + 204) / 4)`. So it is
  **4 px per foot**, making a 50 px tile exactly **12.5 ft**. Rows 5 → 597
  therefore span 0 → −7,400 ft, which matches the wiki's independently
  derived "592 squares to −7400 ft" *exactly* — two unrelated methods
  agreeing. Depth is negative downward; `maxDepth = Math.min(depth, maxDepth)`.
  Two easter eggs live in the same function: below −7,300 ft the altimeter
  reads `"-66666 ft."`, and one other branch prints `"?" + (random(90000) +
  10000) + " ft."`.
- **Boss fight numbers** (attack cooldowns, telegraph timing, hitbox size) —
  `decompiled/scripts/DefineSprite_1955_satanP2_fireball/` and sibling
  sprite folders exist and are named descriptively; not read yet.
- **609 vector shapes** — exported as SVG this pass (`decompiled/`, shape
  export was included in the FFDec run) but not inventoried/reviewed.
- **`checkTransmissions()` per-entry depth table** — trigger *mechanism*
  confirmed in both passes; the specific depth for each of the 11 entries
  still comes from the wiki's list, not independently re-derived from the
  `transmissions` array contents.
- **Full `move()` read** — only the fall-damage and thrust portions were
  pulled out; the complete ~300-line function (2564-2856) covers collision
  on all four sides and hasn't been read end to end.

## Files

**Primary — use these first:**
- `decompiled/scripts/` — 500 real `.as` files, full readable AS2 source.
  `frame_1/DoAction.as` is the main game logic (physics, shops, upgrades,
  world gen). Sprite folders are named descriptively
  (`DefineSprite_1955_satanP2_fireball`, etc.) so boss/effect logic is easy
  to locate by name.
- `decompiled/` also holds 653 SVG vector shapes, 485 images, 80 sounds —
  a superset of the hand-extracted `bitmaps/`/`audio/` below, and it
  includes the 609 vector shapes those tools couldn't touch.
- `tools/ffdec/` — the portable FFDec CLI (v26.2.1, official
  [jindrapetrik/jpexs-decompiler](https://github.com/jindrapetrik/jpexs-decompiler)
  release). Re-run against any of the other 7 builds with:
  ```
  java -jar tools/ffdec/ffdec-cli.jar -onerror ignore \
    -export script,shape,sound,image,text,symbolClass \
    <outdir> "<path-to-other-build>.swf"
  ```

**Secondary — earlier hand-built extraction, kept for cross-validation:**
- `v937_dis.txt` / `v937_dis_full.txt` — hand-rolled disassembly
- `v937_strings.txt`, `strings_*.txt` / `stats_*.txt` — string tables, all 8 builds
- `generateEarth_flat.txt` — superseded by `decompiled/scripts/frame_1/DoAction.as:1475`
- `bitmaps/` (407 PNGs), `audio/` (83 clips) — superseded by `decompiled/`'s fuller set
- `swfdis.py` / `swfdump.py` / `swfbitmaps.py` / `swfaudio.py` — kept for
  reference; FFDec supersedes all four for future work

## Note on use

These are reference measurements for reimplementation. The extracted text and art
assets are XGen Studios' property — a remaster should reimplement behaviour, not
ship the originals.
