import { World } from '../world/world';
import { Pod } from './pod';
import { Input } from '../core/input';
import { Renderer, Camera } from '../render/render';
import { img } from '../render/assets';
import { TRANSMISSIONS, Transmission } from '../data/transmissions';
import { Intro } from './intro';
import { Ending, Choice } from './ending';
import {
  bezel, scanlines, glowText, chunky, cylinder, MONO, GREEN, GREEN_DIM, GREEN_FAINT,
  embossed, button, cell, closeStud,
} from '../ui/crt';
import {
  TILE, VIEW_W, VIEW_H, DT, FPS, MINERALS, ORE_COUNT, REPAIR_COST, FUEL_PER_L,
  DRILLS, HULLS, ENGINES, TANKS, RADIATORS, BAYS, Upgrade, SKY_ROWS, T, START_CASH,
} from '../data/spec';

type Screen = 'play' | 'fuel' | 'sell' | 'repair' | 'upgrade' | 'dead' | 'intro' | 'ending';

interface Building {
  id: Exclude<Screen, 'play' | 'dead' | 'intro' | 'ending'>;
  tile: number; w: number; label: string;
}

/**
 * Depth at which the shaft opens into the chamber and the ending takes over.
 * The world's own hell chamber sits in the last dozen rows; this fires a
 * little above its ceiling so the sequence starts as you break through.
 */
const ENDING_DEPTH_FT = -7250;

const BUILDINGS: Building[] = [
  { id: 'fuel',    tile: 3,  w: 2, label: 'PROPELLANT' },
  { id: 'sell',    tile: 10, w: 2, label: 'PROCESSOR' },
  { id: 'repair',  tile: 18, w: 2, label: 'REPAIR BAY' },
  { id: 'upgrade', tile: 26, w: 3, label: 'OUTFITTER' },
];

interface Category {
  key: keyof Pod & string;
  label: string;
  list: Upgrade[];
  unit: string;
  /** Prefix of the per-tier thumbnails in public/art. */
  art: string;
}

const CATEGORIES: Category[] = [
  { key: 'drill',    label: 'DRILL',     list: DRILLS,    unit: 'ft/s',   art: 'drills' },
  { key: 'hull',     label: 'HULL',      list: HULLS,     unit: 'hp',     art: 'hulls' },
  { key: 'engine',   label: 'ENGINE',    list: ENGINES,   unit: 'pwr',    art: 'engines' },
  { key: 'tank',     label: 'FUEL TANK', list: TANKS,     unit: 'L',      art: 'tanks' },
  { key: 'radiator', label: 'RADIATOR',  list: RADIATORS, unit: 'x dmg',  art: 'radiators' },
  { key: 'bay',      label: 'CARGO BAY', list: BAYS,      unit: 'slots',  art: 'bays' },
];

const SAVE_KEY = 'tld.save.v1';

export class Game {
  readonly world: World;
  readonly pod: Pod;
  private cam: Camera = { x: 0, y: 0 };
  private renderer: Renderer;
  private screen: Screen = 'play';
  private menuIndex = 0;
  private toast = '';
  private toastT = 0;
  private time = 0;
  private acc = 0;
  private log: { text: string; t: number }[] = [];
  private firedTransmissions = new Set<number>();

  private intro: Intro | null = null;
  private ending: Ending | null = null;
  /** Persisted so the opening plays once and the ending fires once. */
  private introSeen = false;
  private endingSeen = false;
  private endingChoice: Choice | null = null;

  constructor(private ctx: CanvasRenderingContext2D, private input: Input, seed: string) {
    this.world = new World(seed);
    this.sealShopFoundations();
    this.pod = new Pod(this.world);
    this.renderer = new Renderer(ctx);
    this.load();

    // A fresh save wakes up in the lab. A continued one does not.
    if (!this.introSeen) {
      this.intro = new Intro();
      this.screen = 'intro';
    }
  }

  // ---------------------------------------------------------------- loop
  update(dtMs: number): void {
    this.time += dtMs;
    this.acc += dtMs / 1000;
    const step = 1 / FPS;
    let guard = 0;
    while (this.acc >= step && guard++ < 8) {
      this.fixed();
      this.acc -= step;
    }
    if (this.toastT > 0) this.toastT -= dtMs;
    this.render();
  }

  private fixed(): void {
    const step = 1000 / FPS;
    if (this.screen === 'intro') this.updateIntro(step);
    else if (this.screen === 'ending') this.updateEnding(step);
    else if (this.screen === 'play') this.updatePlay();
    else this.updateMenu();
    this.input.endFrame();
  }

  private updateIntro(step: number): void {
    this.intro!.update(step, this.input);
    if (!this.intro!.finished) return;
    this.intro = null;
    this.introSeen = true;
    this.screen = 'play';
    this.save();
  }

  /**
   * The ending returns the player to the surface either way. Refusing is a
   * statement, not a fail state — and leaving the world playable afterwards
   * keeps the ambiguity the design asks for about what resumed the shift.
   */
  private updateEnding(step: number): void {
    this.ending!.update(step, this.input);
    if (!this.ending!.finished) return;

    this.endingChoice = this.ending!.choice;
    this.ending = null;
    this.endingSeen = true;
    this.screen = 'play';
    this.pod.respawn();
    this.logLine(this.endingChoice === 'refuse'
      ? '——: [the band is quiet. something logged the shift anyway.]'
      : 'FOREMAN: Shift logged. Quota reset. Thank you for your continued service.');
    this.save();
  }

  private updatePlay(): void {
    const i = this.input;
    this.pod.step({
      up: i.held('up'), down: i.held('down'),
      left: i.held('left'), right: i.held('right'),
    });

    this.drainEvents();
    this.checkTransmissions();

    // Breaking through into the chamber hands off to the ending.
    if (!this.endingSeen && this.pod.depthFeet <= ENDING_DEPTH_FT) {
      this.ending = new Ending();
      this.screen = 'ending';
      this.save();
      return;
    }

    // enter a facility
    const b = this.buildingUnderPod();
    if (b && (i.justPressed('confirm') || i.justPressed('up'))) {
      this.screen = b.id;
      this.menuIndex = 0;
    }

    if (this.pod.mode === 'dead') this.screen = 'dead';
    this.updateCamera();
  }

  private updateMenu(): void {
    const i = this.input;
    if (this.screen === 'dead') {
      if (i.justPressed('confirm')) {
        // Death costs your cargo, not your progress. [design]
        this.pod.respawn();
        this.screen = 'play';
        this.say('Reinitialised. Cargo bay was not recovered.');
      }
      return;
    }

    if (i.justPressed('cancel')) { this.screen = 'play'; this.save(); return; }

    if (this.screen === 'upgrade') {
      const n = CATEGORIES.length;
      // left/right walk the tab strip; up/down kept as an alias so the old
      // muscle memory still works
      if (i.justPressed('right') || i.justPressed('down')) this.menuIndex = (this.menuIndex + 1) % n;
      if (i.justPressed('left') || i.justPressed('up')) this.menuIndex = (this.menuIndex + n - 1) % n;
      if (i.justPressed('confirm')) this.buyUpgrade(this.menuIndex);
      return;
    }

    if (i.justPressed('confirm')) {
      if (this.screen === 'fuel') this.buyFuel();
      else if (this.screen === 'sell') this.sell();
      else if (this.screen === 'repair') this.buyRepair();
    }
  }

  // ---------------------------------------------------------------- economy
  private buyFuel(): void {
    const need = this.pod.maxFuel - this.pod.fuel;
    if (need <= 0.01) return this.say('Tank is full.');
    const afford = Math.min(need, this.pod.cash / FUEL_PER_L);
    if (afford <= 0.01) return this.say('Insufficient credits.');
    this.pod.cash -= afford * FUEL_PER_L;
    this.pod.refuel(afford);
    this.say(`Loaded ${afford.toFixed(1)} L for $${Math.round(afford * FUEL_PER_L)}.`);
  }

  private sell(): void {
    if (this.pod.bayUsed() === 0 && !this.hasArtifacts()) return this.say('Bay is empty.');
    const total = this.pod.sellAll();
    this.say(`Processed. Credited $${total.toLocaleString()}.`);
  }

  private hasArtifacts(): boolean {
    for (let i = ORE_COUNT; i < MINERALS.length; i++) if (this.pod.bayContents[i] > 0) return true;
    return false;
  }

  private buyRepair(): void {
    const missing = this.pod.maxHp - this.pod.hp;
    if (missing <= 0) return this.say('Hull is intact.');
    const cost = missing * REPAIR_COST;
    if (this.pod.cash < cost) return this.say(`Need $${cost.toLocaleString()}.`);
    this.pod.cash -= cost;
    this.pod.repair();
    this.say(`Hull restored for $${cost.toLocaleString()}.`);
  }

  private buyUpgrade(catIndex: number): void {
    const cat = CATEGORIES[catIndex];
    const cur = this.pod[cat.key] as unknown as number;
    const next = cur + 1;
    if (next >= cat.list.length) return this.say('Already at maximum tier.');
    const price = cat.list[next].price;
    if (this.pod.cash < price) return this.say(`Need $${price.toLocaleString()}.`);
    this.pod.cash -= price;
    (this.pod as unknown as Record<string, number>)[cat.key] = next;
    if (cat.key === 'hull') this.pod.hp = this.pod.maxHp;
    this.say(`Installed ${cat.list[next].name}.`);
    this.save();
  }

  private say(text: string): void { this.toast = text; this.toastT = 2600; }

  /** Push a line onto the transmission feed, newest first. */
  private logLine(text: string): void {
    this.log.unshift({ text, t: this.time });
    if (this.log.length > 4) this.log.pop();
  }

  // ---------------------------------------------------------------- events
  private drainEvents(): void {
    for (const e of this.pod.events) {
      if (e.kind === 'collect') this.say(`+ ${MINERALS[e.mineral].name}`);
      else if (e.kind === 'bayFull') this.say('Cargo bay full.');
      else if (e.kind === 'damage' && e.cause === 'gas') this.say('Gas pocket ruptured.');
      else if (e.kind === 'died') {
        this.say(e.cause === 'fuel' ? 'Propellant exhausted.' : 'Hull integrity lost.');
      }
    }
    this.pod.events.length = 0;
  }

  /**
   * [ffdec] The original walks an ordered array and fires the next entry once
   * maxDepth passes its threshold. Same mechanism, our own writing.
   */
  private checkTransmissions(): void {
    for (let i = 0; i < TRANSMISSIONS.length; i++) {
      const t: Transmission = TRANSMISSIONS[i];
      if (this.firedTransmissions.has(i)) continue;
      if (this.pod.maxDepth <= t.depth) {
        this.firedTransmissions.add(i);
        this.logLine(`${t.from}: ${t.text}`);
        break;
      }
    }
  }

  // ---------------------------------------------------------------- camera
  private updateCamera(): void {
    const tx = this.pod.x - VIEW_W / 2;
    const ty = this.pod.y - VIEW_H / 2;
    this.cam.x += (tx - this.cam.x) * 0.12;
    this.cam.y += (ty - this.cam.y) * 0.12;
    this.cam.x = Math.max(0, Math.min(this.world.w * TILE - VIEW_W, this.cam.x));
    this.cam.y = Math.max(-120, Math.min(this.world.h * TILE - VIEW_H, this.cam.y));
  }

  /**
   * Seal the surface row under every building. Without this you can park on
   * a shop, drill straight down, and drop the whole thing into a hole.
   */
  private sealShopFoundations(): void {
    for (const b of BUILDINGS)
      for (let tx = b.tile; tx <= b.tile + b.w; tx++)
        this.world.set(tx, SKY_ROWS, T.FOUNDATION);
  }

  private buildingUnderPod(): Building | null {
    if (this.pod.mode !== 'ground') return null;
    if (this.pod.depthFeet < -30) return null;
    const t = this.pod.x / TILE;
    return BUILDINGS.find(b => t >= b.tile && t <= b.tile + b.w) ?? null;
  }

  // ---------------------------------------------------------------- render
  private render(): void {
    const g = this.ctx;

    // The opening and the ending own the whole frame — no world, no HUD.
    if (this.screen === 'intro') {
      const anyG = g as unknown as { reset?: () => void };
      anyG.reset?.();
      this.intro!.draw(g, this.time);
      this.intro!.drawTitle(g);
      return;
    }
    if (this.screen === 'ending') {
      const anyG = g as unknown as { reset?: () => void };
      anyG.reset?.();
      this.ending!.draw(g, this.time);
      return;
    }

    this.renderer.draw(this.world, this.pod, this.cam, this.time);
    this.drawBuildings();
    this.drawHUD();
    if (this.screen !== 'play') this.drawScreen();
    if (this.toastT > 0) this.drawToast();
    void g;
  }

  private drawBuildings(): void {
    const g = this.ctx;
    const baseY = World.SURFACE_Y - this.cam.y;
    for (const b of BUILDINGS) {
      const x = b.tile * TILE - this.cam.x;
      const w = b.w * TILE;
      const h = 96;
      if (x + w < -50 || x > VIEW_W + 50) continue;

      const art = img(`${b.id === 'fuel' ? 'shop_fuel'
        : b.id === 'sell' ? 'shop_processor'
        : b.id === 'repair' ? 'shop_repair' : 'shop_outfitter'}_t`);

      let topY = baseY - h;
      if (art) {
        const s = Math.min((w + 30) / art.width, 130 / art.height);
        const aw = art.width * s, ah = art.height * s;
        topY = baseY - ah;
        g.imageSmoothingEnabled = true;
        g.drawImage(art, Math.round(x + (w - aw) / 2), Math.round(topY),
          Math.round(aw), Math.round(ah));
        g.imageSmoothingEnabled = false;
      } else {
        g.fillStyle = '#2b2530';
        g.fillRect(x, baseY - h, w, h);
        g.fillStyle = '#3a323f';
        g.fillRect(x, baseY - h, w, 10);
        g.fillStyle = '#e8b26a';
        for (let i = 0; i < b.w; i++) g.fillRect(x + 12 + i * TILE, baseY - h + 26, 14, 12);
      }

      chunky(g, b.label, x + w / 2, topY - 10, 13, '#e8d9a0', 'center');
    }

    const b = this.buildingUnderPod();
    if (b) {
      g.font = '12px ui-monospace, monospace';
      g.textAlign = 'center';
      g.fillStyle = '#e8d9a0';
      g.fillText(`[ SPACE ]  ${b.label}`, VIEW_W / 2, VIEW_H - 78);
    }
    g.textAlign = 'left';
  }

  /** In-world HUD in the original's style: cylinder gauges, chunky type. */
  private drawHUD(): void {
    const g = this.ctx;
    const p = this.pod;

    cylinder(g, 16, 14, 46, 66, p.hp / p.maxHp, 'Hull',
      ['#7d1f24', '#d24a52', '#f28b90']);
    cylinder(g, 72, 14, 40, 66, p.fuel / p.maxFuel, 'Fuel',
      ['#7a6231', '#d3b268', '#efdca6']);

    // fuel tick marks, as on the original
    chunky(g, 'F', 116, 26, 13, '#f2d98a');
    chunky(g, 'E', 116, 86, 13, '#f2d98a');

    // altimeter
    const d = p.depthFeet;
    chunky(g, `${d} ft.`, 16, 112, 24, d < -3000 ? '#ff9d6e' : '#ffffff');

    // score and cash, centre and right like the original
    chunky(g, p.score.toLocaleString(), VIEW_W * 0.42, 46, 26, '#ffe14d', 'center');
    chunky(g, `$${Math.floor(p.cash).toLocaleString()}`, VIEW_W - 150, 46, 30, '#ffe14d', 'right');

    // cargo readout
    chunky(g, `BAY ${p.bayUsed()}/${p.bayCapacity}`, VIEW_W - 150, 74, 15, '#cfe89a', 'right');

    this.drawTransmissionFeed();
  }

  /** Transmissions arrive on a small Pip-Boy screen in the lower-left. */
  private drawTransmissionFeed(): void {
    const live = this.log.filter(l => this.time - l.t < 24000);
    if (!live.length) return;

    const g = this.ctx;
    const w = 460, h = 26 + live.length * 22;
    const x = 14, y = VIEW_H - h - 14;

    const newest = this.time - live[0].t;
    const a = Math.min(1, newest / 260) * Math.min(1, (24000 - newest) / 1800);
    g.save();
    g.globalAlpha = Math.max(0, a);

    const s = bezel(g, x, y, w, h);
    for (let i = 0; i < live.length; i++) {
      const age = this.time - live[i].t;
      const fade = Math.max(0.28, 1 - age / 24000);
      g.globalAlpha = Math.max(0, a * fade);
      glowText(g, live[i].text, s.x + 12, s.y + 20 + i * 22, 13,
        i === 0 ? GREEN : GREEN_DIM);
    }
    g.globalAlpha = Math.max(0, a);
    scanlines(g, s);
    g.restore();
  }

  /**
   * Shop panels, built the way the original's are: a heavy metal casing with
   * the vendor's name struck into it, a red close stud in the corner, a
   * recessed green CRT for the readout, and moulded push-buttons for the
   * actions rather than bracketed key hints floating in the display.
   *
   * The buttons are labelled with the key that works them, so what you see is
   * what you can actually press — the panel is keyboard-driven, not a mouse
   * surface dressed up as one.
   */
  private drawScreen(): void {
    const g = this.ctx;
    g.fillStyle = 'rgba(4,6,4,.72)';
    g.fillRect(0, 0, VIEW_W, VIEW_H);

    const px = 46, py = 38, pw = VIEW_W - 92, ph = VIEW_H - 76;
    const TITLE_H = 40;
    const s = bezel(g, px, py, pw, ph, TITLE_H);
    const cx = s.x + s.w / 2;
    g.textAlign = 'center';

    if (this.screen === 'dead') {
      embossed(g, 'UNIT OFFLINE', px + pw / 2, py + 46, 27);
      closeStud(g, px + pw - 26, py + 26);
      glowText(g, 'The Foreman logs the loss and files a replacement request.',
        cx, s.y + 120, 13, GREEN_DIM);
      button(g, cx - 110, s.y + 168, 220, 44, 'REINITIALISE  [SPACE]', 'red', true);
      g.textAlign = 'left';
      scanlines(g, s);
      return;
    }

    const titles: Record<string, string> = {
      fuel: 'Propellant Vendor 12000', sell: 'Mineral Processor 4400',
      repair: 'Emendation Station 3500', upgrade: 'AutoBuy 2000',
    };
    embossed(g, titles[this.screen], px + pw / 2, py + 46, 25);
    closeStud(g, px + pw - 26, py + 26);

    // Credits sit on the casing rather than inside the display, as on the
    // original's panels — and it keeps them clear of the tab strip.
    chunky(g, `$${Math.floor(this.pod.cash).toLocaleString()}`,
      px + 20, py + 50, 24, '#ffe14d', 'left');

    if (this.screen === 'upgrade') this.drawUpgrades(s);
    else if (this.screen === 'sell') this.drawSellList(s);
    else if (this.screen === 'fuel') {
      const need = this.pod.maxFuel - this.pod.fuel;
      const gx = s.x + 74;
      glowText(g, 'CURRENT FUEL', gx + 22, s.y + 78, 12, GREEN_DIM);
      cylinder(g, gx, s.y + 96, 44, 210, this.pod.fuel / this.pod.maxFuel, 'Fuel',
        ['#7a6231', '#d3b268', '#efdca6']);
      const rx = (gx + 66 + s.x + s.w) / 2;
      glowText(g, `${this.pod.fuel.toFixed(1)} / ${this.pod.maxFuel} L`, rx, s.y + 150, 26);
      glowText(g, `REFILL COST  $${Math.round(need * FUEL_PER_L).toLocaleString()}`,
        rx, s.y + 186, 15, GREEN_DIM);
      button(g, rx - 120, s.y + 220, 240, 48, 'FILL TANK  [SPACE]', 'red', need > 0);
    } else if (this.screen === 'repair') {
      const missing = this.pod.maxHp - this.pod.hp;
      const gx = s.x + 74;
      glowText(g, 'CURRENT HULL', gx + 22, s.y + 78, 12, GREEN_DIM);
      cylinder(g, gx, s.y + 96, 44, 210, this.pod.hp / this.pod.maxHp, 'Hull',
        ['#7d1f24', '#d24a52', '#f28b90']);
      const rx = (gx + 66 + s.x + s.w) / 2;
      glowText(g, `${Math.ceil(this.pod.hp)} / ${this.pod.maxHp} HP`, rx, s.y + 150, 26);
      glowText(g, `REPAIR COST  $${(missing * REPAIR_COST).toLocaleString()}`,
        rx, s.y + 186, 15, GREEN_DIM);
      button(g, rx - 120, s.y + 220, 240, 48, 'TOTAL REPAIR  [SPACE]', 'green', missing > 0);
    }

    glowText(g, '[ ESC ]  LEAVE', cx, s.y + s.h - 14, 12, GREEN_DIM);
    g.textAlign = 'left';
    scanlines(g, s);
  }

  private drawSellList(s: { x: number; y: number; w: number; h: number }): void {
    const g = this.ctx;
    const left = s.x + 60, right = s.x + s.w - 60;
    let y = s.y + 122;
    let total = 0;

    for (let i = 0; i < MINERALS.length; i++) {
      const n = this.pod.bayContents[i];
      if (!n) continue;
      const v = n * MINERALS[i].value;
      total += v;
      g.textAlign = 'left';
      g.fillStyle = MINERALS[i].color;
      g.fillRect(left - 20, y - 10, 11, 11);
      glowText(g, `${MINERALS[i].name} x${n}`, left, y, 14);
      g.textAlign = 'right';
      glowText(g, `$${v.toLocaleString()}`, right, y, 14, GREEN_DIM);
      y += 22;
    }

    g.textAlign = 'center';
    const cx = s.x + s.w / 2;
    if (total === 0) glowText(g, 'BAY EMPTY', cx, s.y + 140, 16, GREEN_DIM);
    else {
      glowText(g, `TOTAL  $${total.toLocaleString()}`, cx, y + 26, 19);
      button(g, cx - 110, y + 46, 220, 44, 'SELL ALL  [SPACE]', 'green', true);
    }
  }

  /**
   * The outfitter, laid out like the original's AutoBuy: a tab strip of
   * categories across the top, the part you currently own on the left, and
   * the tiers still ahead of you as a grid of thumbnails on the right.
   */
  private drawUpgrades(s: { x: number; y: number; w: number; h: number }): void {
    const g = this.ctx;
    const cat = CATEGORIES[this.menuIndex];
    const cur = this.pod[cat.key] as unknown as number;
    const maxed = cur + 1 >= cat.list.length;

    // ---- tab strip
    const strip = s.w - 52;
    const tabW = Math.floor(strip / CATEGORIES.length);
    const tabY = s.y + 10;

    // chevrons instead of a "[LEFT/RIGHT] CATEGORY" line — self-explanatory,
    // and there is no room at the foot of the panel for another hint
    g.textAlign = 'center';
    glowText(g, '‹', s.x + 14, tabY + 19, 20, GREEN);
    glowText(g, '›', s.x + s.w - 14, tabY + 19, 20, GREEN);

    for (let i = 0; i < CATEGORIES.length; i++) {
      const tx = s.x + 26 + i * tabW;
      const on = i === this.menuIndex;
      g.fillStyle = on ? 'rgba(93,255,100,.18)' : 'rgba(0,0,0,.35)';
      g.beginPath(); g.roundRect(tx + 1, tabY, tabW - 2, 26, [5, 5, 0, 0]); g.fill();
      g.strokeStyle = on ? GREEN : GREEN_FAINT;
      g.lineWidth = 1;
      g.beginPath(); g.roundRect(tx + 1.5, tabY + 0.5, tabW - 3, 26, [5, 5, 0, 0]); g.stroke();
      g.textAlign = 'center';
      glowText(g, CATEGORIES[i].label, tx + tabW / 2, tabY + 18, 11, on ? GREEN : GREEN_DIM);
    }
    g.strokeStyle = GREEN;
    g.beginPath(); g.moveTo(s.x + 26, tabY + 26.5); g.lineTo(s.x + 26 + strip, tabY + 26.5); g.stroke();

    const thumb = (name: string, bx: number, by: number, box: number) => {
      const a = img(name);
      if (!a) return false;
      const k = Math.min(box / a.width, box / a.height);
      const w = a.width * k, h = a.height * k;
      g.imageSmoothingEnabled = true;
      g.drawImage(a, Math.round(bx + (box - w) / 2), Math.round(by + (box - h) / 2),
        Math.round(w), Math.round(h));
      g.imageSmoothingEnabled = false;
      return true;
    };

    // ---- what you're running now
    const colX = s.x + 22;
    const top = tabY + 44;
    g.textAlign = 'left';
    glowText(g, 'CURRENT', colX, top, 12, GREEN_DIM);
    cell(g, colX, top + 8, 96, 96, false);
    if (!thumb(`part_${cat.art}_${cur}`, colX, top + 8, 96)) {
      g.textAlign = 'center';
      glowText(g, '—', colX + 48, top + 62, 24, GREEN_DIM);
      g.textAlign = 'left';
    }
    glowText(g, cat.list[cur].name, colX, top + 126, 12, GREEN);
    glowText(g, `${cat.list[cur].value}${cat.unit}`, colX, top + 144, 12, GREEN_DIM);

    // ---- the ladder ahead
    const gx = colX + 130;
    const box = 72, gap = 12;
    const perRow = Math.max(1, Math.floor((s.x + s.w - 22 - gx) / (box + gap)));
    glowText(g, 'AVAILABLE UPGRADES', gx, top, 12, GREEN_DIM);

    if (maxed) {
      glowText(g, 'FULLY UPGRADED', gx, top + 60, 16, GREEN);
    } else {
      for (let t = cur + 1, n = 0; t < cat.list.length; t++, n++) {
        const bx = gx + (n % perRow) * (box + gap);
        const by = top + 8 + Math.floor(n / perRow) * (box + 40);
        const next = t === cur + 1;
        const can = this.pod.cash >= cat.list[t].price;

        cell(g, bx, by, box, box, next);
        thumb(`part_${cat.art}_${t}`, bx, by, box);
        g.textAlign = 'center';
        glowText(g, `$${cat.list[t].price.toLocaleString()}`, bx + box / 2, by + box + 15, 11,
          next ? (can ? GREEN : '#b45a4a') : GREEN_DIM);
        g.textAlign = 'left';
      }
    }

    // ---- buy
    g.textAlign = 'center';
    const cx = s.x + s.w / 2;
    const by = s.y + s.h - 76;
    if (!maxed) {
      const nxt = cat.list[cur + 1];
      const can = this.pod.cash >= nxt.price;
      glowText(g, `NEXT  ${nxt.name}   $${nxt.price.toLocaleString()}`, cx, by - 8, 13,
        can ? GREEN : '#b45a4a');
      button(g, cx - 110, by, 220, 40, 'BUY  [SPACE]', 'green', can);
    }
  }

  private drawToast(): void {
    const g = this.ctx;
    const a = Math.min(1, this.toastT / 400);
    g.save();
    g.globalAlpha = a;
    g.textAlign = 'center';
    g.font = MONO(14);
    const w = g.measureText(this.toast).width + 44;
    const x = VIEW_W / 2 - w / 2;
    const s = bezel(g, x, VIEW_H - 96, w, 52);
    glowText(g, this.toast, s.x + s.w / 2, s.y + s.h / 2 + 5, 14);
    scanlines(g, s);
    g.restore();
    g.textAlign = 'left';
  }

  // ---------------------------------------------------------------- save
  save(): void {
    const p = this.pod;
    const data = {
      cash: p.cash, score: p.score, maxDepth: p.maxDepth, hp: p.hp, fuel: p.fuel,
      drill: p.drill, hull: p.hull, engine: p.engine, tank: p.tank,
      radiator: p.radiator, bay: p.bay,
      fired: [...this.firedTransmissions],
      introSeen: this.introSeen,
      endingSeen: this.endingSeen,
      endingChoice: this.endingChoice,
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* private mode */ }
  }

  private load(): void {
    let raw: string | null = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch { return; }
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      const p = this.pod;
      Object.assign(p, {
        cash: d.cash ?? START_CASH, score: d.score ?? 0, maxDepth: d.maxDepth ?? 0,
        drill: d.drill ?? 0, hull: d.hull ?? 0, engine: d.engine ?? 0,
        tank: d.tank ?? 0, radiator: d.radiator ?? 0, bay: d.bay ?? 0,
      });
      p.hp = Math.min(d.hp ?? p.maxHp, p.maxHp);
      p.fuel = Math.min(d.fuel ?? p.maxFuel, p.maxFuel);
      this.firedTransmissions = new Set(d.fired ?? []);
      this.introSeen = !!d.introSeen;
      this.endingSeen = !!d.endingSeen;
      this.endingChoice = d.endingChoice ?? null;
    } catch { /* corrupt save, start fresh */ }
  }

  static wipeSave(): void { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }
}

void DT;
