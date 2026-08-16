import { World } from '../world/world';
import { Pod } from './pod';
import { Input } from '../core/input';
import { Renderer, Camera } from '../render/render';
import { img } from '../render/assets';
import { TRANSMISSIONS, Transmission } from '../data/transmissions';
import {
  bezel, scanlines, glowText, chunky, cylinder, MONO, GREEN, GREEN_DIM, GREEN_FAINT,
} from '../ui/crt';
import {
  TILE, VIEW_W, VIEW_H, DT, FPS, MINERALS, ORE_COUNT, REPAIR_COST, FUEL_PER_L,
  DRILLS, HULLS, ENGINES, TANKS, RADIATORS, BAYS, Upgrade,
} from '../data/spec';

type Screen = 'play' | 'fuel' | 'sell' | 'repair' | 'upgrade' | 'dead';

interface Building { id: Exclude<Screen, 'play' | 'dead'>; tile: number; w: number; label: string }

const BUILDINGS: Building[] = [
  { id: 'fuel',    tile: 3,  w: 2, label: 'PROPELLANT' },
  { id: 'sell',    tile: 6,  w: 2, label: 'PROCESSOR' },
  { id: 'repair',  tile: 12, w: 2, label: 'REPAIR BAY' },
  { id: 'upgrade', tile: 15, w: 3, label: 'OUTFITTER' },
];

const CATEGORIES: { key: keyof Pod & string; label: string; list: Upgrade[]; unit: string }[] = [
  { key: 'drill',    label: 'Drill',    list: DRILLS,    unit: 'ft/s' },
  { key: 'hull',     label: 'Hull',     list: HULLS,     unit: 'hp' },
  { key: 'engine',   label: 'Engine',   list: ENGINES,   unit: 'pwr' },
  { key: 'tank',     label: 'Fuel Tank',list: TANKS,     unit: 'L' },
  { key: 'radiator', label: 'Radiator', list: RADIATORS, unit: 'x dmg' },
  { key: 'bay',      label: 'Cargo Bay',list: BAYS,      unit: 'slots' },
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

  constructor(private ctx: CanvasRenderingContext2D, private input: Input, seed: string) {
    this.world = new World(seed);
    this.pod = new Pod(this.world);
    this.renderer = new Renderer(ctx);
    this.load();
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
    if (this.screen === 'play') this.updatePlay();
    else this.updateMenu();
    this.input.endFrame();
  }

  private updatePlay(): void {
    const i = this.input;
    this.pod.step({
      up: i.held('up'), down: i.held('down'),
      left: i.held('left'), right: i.held('right'),
    });

    this.drainEvents();
    this.checkTransmissions();

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
      if (i.justPressed('down')) this.menuIndex = (this.menuIndex + 1) % CATEGORIES.length;
      if (i.justPressed('up')) this.menuIndex = (this.menuIndex + CATEGORIES.length - 1) % CATEGORIES.length;
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
        this.log.unshift({ text: `${t.from}: ${t.text}`, t: this.time });
        if (this.log.length > 4) this.log.pop();
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

  private buildingUnderPod(): Building | null {
    if (this.pod.mode !== 'ground') return null;
    if (this.pod.depthFeet < -30) return null;
    const t = this.pod.x / TILE;
    return BUILDINGS.find(b => t >= b.tile && t <= b.tile + b.w) ?? null;
  }

  // ---------------------------------------------------------------- render
  private render(): void {
    const g = this.ctx;
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

  /** Every menu is a Pip-Boy terminal: metal bezel, phosphor screen. */
  private drawScreen(): void {
    const g = this.ctx;
    g.fillStyle = 'rgba(4,6,4,.72)';
    g.fillRect(0, 0, VIEW_W, VIEW_H);

    const s = bezel(g, 60, 50, VIEW_W - 120, VIEW_H - 100);
    const cx = s.x + s.w / 2;
    g.textAlign = 'center';

    if (this.screen === 'dead') {
      glowText(g, 'UNIT OFFLINE', cx, s.y + 150, 30, '#ff6a5a', true);
      glowText(g, 'The Foreman logs the loss and files a replacement request.',
        cx, s.y + 192, 13, GREEN_DIM);
      glowText(g, '[ SPACE ]  REINITIALISE', cx, s.y + 246, 15, GREEN);
      g.textAlign = 'left';
      scanlines(g, s);
      return;
    }

    const titles: Record<string, string> = {
      fuel: 'PROPELLANT VENDOR', sell: 'MINERAL PROCESSOR',
      repair: 'REPAIR BAY', upgrade: 'OUTFITTER',
    };
    glowText(g, titles[this.screen], cx, s.y + 40, 22, GREEN, true);
    g.strokeStyle = GREEN_FAINT;
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(s.x + 24, s.y + 54); g.lineTo(s.x + s.w - 24, s.y + 54); g.stroke();
    glowText(g, `CREDITS  $${Math.floor(this.pod.cash).toLocaleString()}`,
      cx, s.y + 78, 13, GREEN_DIM);

    if (this.screen === 'upgrade') this.drawUpgrades(s);
    else if (this.screen === 'sell') this.drawSellList(s);
    else if (this.screen === 'fuel') {
      const need = this.pod.maxFuel - this.pod.fuel;
      glowText(g, `${this.pod.fuel.toFixed(1)} / ${this.pod.maxFuel} L`, cx, s.y + 170, 24);
      glowText(g, `REFILL COST  $${Math.round(need * FUEL_PER_L).toLocaleString()}`,
        cx, s.y + 210, 15, GREEN_DIM);
      glowText(g, '[ SPACE ]  FILL', cx, s.y + 268, 16);
    } else if (this.screen === 'repair') {
      const missing = this.pod.maxHp - this.pod.hp;
      glowText(g, `${Math.ceil(this.pod.hp)} / ${this.pod.maxHp} HP`, cx, s.y + 170, 24);
      glowText(g, `REPAIR COST  $${(missing * REPAIR_COST).toLocaleString()}`,
        cx, s.y + 210, 15, GREEN_DIM);
      glowText(g, '[ SPACE ]  REPAIR', cx, s.y + 268, 16);
    }

    glowText(g, '[ ESC ]  LEAVE', cx, s.y + s.h - 18, 12, GREEN_DIM);
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
    if (total === 0) glowText(g, 'BAY EMPTY', cx, s.y + 170, 16, GREEN_DIM);
    else {
      glowText(g, `TOTAL  $${total.toLocaleString()}`, cx, y + 26, 19);
      glowText(g, '[ SPACE ]  SELL ALL', cx, y + 58, 15);
    }
  }

  private drawUpgrades(s: { x: number; y: number; w: number; h: number }): void {
    const g = this.ctx;
    const left = s.x + 46, right = s.x + s.w - 46;
    let y = s.y + 120;

    for (let i = 0; i < CATEGORIES.length; i++) {
      const cat = CATEGORIES[i];
      const cur = this.pod[cat.key] as unknown as number;
      const sel = i === this.menuIndex;
      const maxed = cur + 1 >= cat.list.length;
      const nxt = maxed ? null : cat.list[cur + 1];

      if (sel) {
        g.fillStyle = 'rgba(93,255,100,.12)';
        g.fillRect(left - 24, y - 16, s.w - 44, 26);
        g.fillStyle = GREEN;
        g.fillRect(left - 24, y - 16, 3, 26);
      }
      g.textAlign = 'left';
      glowText(g, sel ? '>' : ' ', left - 16, y, 14, GREEN);
      glowText(g, cat.label, left, y, 14, sel ? GREEN : GREEN_DIM);
      glowText(g, `${cat.list[cur].name} (${cat.list[cur].value}${cat.unit})`,
        left + 100, y, 12, GREEN_DIM);

      g.textAlign = 'right';
      if (maxed) glowText(g, 'MAX', right, y, 13, GREEN_DIM);
      else {
        const can = this.pod.cash >= nxt!.price;
        glowText(g, `${nxt!.name}  $${nxt!.price.toLocaleString()}`, right, y, 13,
          can ? GREEN : '#b45a4a');
      }
      y += 30;
    }
    g.textAlign = 'center';
    glowText(g, '[ UP/DOWN ] SELECT     [ SPACE ] BUY', s.x + s.w / 2, y + 22, 13, GREEN_DIM);
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
        cash: d.cash ?? 0, score: d.score ?? 0, maxDepth: d.maxDepth ?? 0,
        drill: d.drill ?? 0, hull: d.hull ?? 0, engine: d.engine ?? 0,
        tank: d.tank ?? 0, radiator: d.radiator ?? 0, bay: d.bay ?? 0,
      });
      p.hp = Math.min(d.hp ?? p.maxHp, p.maxHp);
      p.fuel = Math.min(d.fuel ?? p.maxFuel, p.maxFuel);
      this.firedTransmissions = new Set(d.fired ?? []);
    } catch { /* corrupt save, start fresh */ }
  }

  static wipeSave(): void { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }
}

void DT;
