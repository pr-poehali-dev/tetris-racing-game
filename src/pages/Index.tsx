import { useEffect, useRef, useState, useCallback } from 'react';

// ═══════════════════════════════════════════════════════
//  CYBER DRIFT — 3D псевдо-перспектива, погоня полиции
// ═══════════════════════════════════════════════════════

const W = 800;
const H = 500;
const NUM_SEGS = 150;      // сегментов дороги в памяти
const VISIBLE = 100;       // сколько отрисовываем
const SEG_LEN = 200;       // длина сегмента в мировых единицах
const CAM_DEPTH = 0.84;
const ROAD_W = 2000;       // полуширина дороги в мировых единицах
const LANE_W = ROAD_W * 2 / 3;
const HORIZON_Y = H * 0.48; // горизонт на экране (откуда начинается дорога сверху)

// Цвета
const C = {
  sky1: '#050510',
  sky2: '#0a0520',
  road: '#111122',
  roadLight: '#1a1a33',
  grass1: '#001a00',
  grass2: '#002200',
  rumble: '#ff00ff',
  rumbleAlt: '#00ffff',
  line: '#ffff00',
  fog: 'rgba(5,5,30,',
};

// ═══════ Тип сегмента дороги ═══════
interface Seg {
  index: number;
  curve: number;       // изгиб
  hill: number;        // подъём
  color: 'light' | 'dark';
  startY: number;      // мировая высота начала
  // вычисляемые при отрисовке:
  p1?: Projected;
  p2?: Projected;
}

interface Projected {
  screen: { x: number; y: number; w: number };
  world: { z: number };
  scale: number;
}

// ═══════ Проекция ═══════
// Ближние сегменты → низ экрана (большой scale)
// Дальние сегменты → горизонт (HORIZON_Y, маленький scale)
function project(
  worldX: number, worldY: number, worldZ: number,
  camX: number, camY: number, camZ: number,
): Projected {
  const transX = worldX - camX;
  const transY = worldY - camY;
  const transZ = worldZ - camZ;
  if (transZ <= 0) return { screen: { x: 0, y: 0, w: 0 }, world: { z: transZ }, scale: 0 };
  const scale = CAM_DEPTH / transZ;
  // sx: горизонтальная позиция, центр W/2
  const sx = W / 2 + scale * transX * W / 2;
  // sy: дальние точки → HORIZON_Y (верх дороги), ближние → низ экрана
  // scale большой = близко = низ; scale маленький = далеко = HORIZON_Y
  const sy = HORIZON_Y + scale * transY * H - scale * 600;
  const sw = scale * ROAD_W * W / 2;
  return { screen: { x: sx, y: sy, w: sw }, world: { z: transZ }, scale };
}

// ═══════ Генерация трассы ═══════
function buildTrack(): Seg[] {
  const segs: Seg[] = [];
  for (let i = 0; i < NUM_SEGS; i++) {
    const t = i / NUM_SEGS;
    // Синусоидальные изгибы
    const curve =
      Math.sin(t * Math.PI * 4) * 3 +
      Math.sin(t * Math.PI * 7 + 1) * 1.5;
    const hill =
      Math.sin(t * Math.PI * 3) * 400 +
      Math.sin(t * Math.PI * 6 + 0.5) * 150;
    segs.push({
      index: i,
      curve,
      hill,
      color: i % 2 === 0 ? 'light' : 'dark',
      startY: hill,
    });
  }
  return segs;
}

const TRACK = buildTrack();

function getSeg(z: number): Seg {
  const idx = Math.floor(z / SEG_LEN) % NUM_SEGS;
  return TRACK[(idx + NUM_SEGS) % NUM_SEGS];
}

// ═══════ Трапеция дороги ═══════
function drawQuad(
  ctx: CanvasRenderingContext2D,
  color: string,
  x1: number, y1: number, w1: number,
  x2: number, y2: number, w2: number,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1 - w1, y1);
  ctx.lineTo(x1 + w1, y1);
  ctx.lineTo(x2 + w2, y2);
  ctx.lineTo(x2 - w2, y2);
  ctx.closePath();
  ctx.fill();
}

// ═══════ Рисуем машину (SVG-подобная через canvas) ═══════
function drawPlayerCar(ctx: CanvasRenderingContext2D, x: number, tilt: number, isShield: boolean) {
  const cx = x;
  const cy = H - 90;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt * 0.06);

  // Тень
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(0, 62, 70, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Кузов нижний
  ctx.fillStyle = '#1a0040';
  ctx.beginPath();
  ctx.roundRect(-55, 20, 110, 35, 4);
  ctx.fill();

  // Кузов верхний
  ctx.fillStyle = '#2a0060';
  ctx.beginPath();
  ctx.moveTo(-35, 20);
  ctx.lineTo(-40, -10);
  ctx.lineTo(40, -10);
  ctx.lineTo(35, 20);
  ctx.closePath();
  ctx.fill();

  // Неоновая окантовка низа
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.roundRect(-55, 20, 110, 35, 4);
  ctx.stroke();

  // Неоновая окантовка верха
  ctx.strokeStyle = '#ff00ff';
  ctx.shadowColor = '#ff00ff';
  ctx.beginPath();
  ctx.moveTo(-35, 20);
  ctx.lineTo(-40, -10);
  ctx.lineTo(40, -10);
  ctx.lineTo(35, 20);
  ctx.closePath();
  ctx.stroke();

  // Лобовое стекло
  ctx.fillStyle = 'rgba(0,200,255,0.25)';
  ctx.beginPath();
  ctx.moveTo(-28, 18);
  ctx.lineTo(-32, -6);
  ctx.lineTo(32, -6);
  ctx.lineTo(28, 18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Фары задние
  ctx.shadowColor = '#ff0000';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(-52, 28, 18, 10);
  ctx.fillRect(34, 28, 18, 10);

  // Выхлоп с огнём
  ctx.shadowColor = '#ff6600';
  ctx.shadowBlur = 25;
  for (let i = 0; i < 2; i++) {
    const ox = i === 0 ? -25 : 15;
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.ellipse(ox, 58 + Math.random() * 6, 8, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff4400';
    ctx.beginPath();
    ctx.ellipse(ox, 60 + Math.random() * 8, 5, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Колёса
  ctx.shadowBlur = 0;
  [{ x: -48, y: 38 }, { x: 48, y: 38 }, { x: -44, y: 14 }, { x: 44, y: 14 }].forEach(w => {
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.ellipse(w.x, w.y, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Диск
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.ellipse(w.x, w.y, 8, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  });

  // Щит
  if (isShield) {
    ctx.strokeStyle = `rgba(0,255,255,${0.5 + Math.sin(Date.now() / 150) * 0.3})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.ellipse(0, 20, 75, 55, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

// ═══════ Рисуем полицейскую машину ═══════
function drawCopCar(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number, scale: number,
  flash: boolean,
) {
  if (scale <= 0 || sy < 0) return;
  ctx.save();
  ctx.translate(sx, sy);
  const s = Math.max(0.2, Math.min(scale * 4.5, 1.2));
  ctx.scale(s, s);

  // Тень
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, 42, 52, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Кузов
  ctx.fillStyle = '#001833';
  ctx.beginPath();
  ctx.roundRect(-42, 12, 84, 28, 3);
  ctx.fill();
  ctx.fillStyle = '#00224a';
  ctx.beginPath();
  ctx.moveTo(-26, 12);
  ctx.lineTo(-30, -8);
  ctx.lineTo(30, -8);
  ctx.lineTo(26, 12);
  ctx.closePath();
  ctx.fill();

  // Полицейская полоска
  ctx.fillStyle = flash ? '#ffffff' : '#0088ff';
  ctx.fillRect(-42, 18, 84, 5);

  // Мигалка
  const t = Date.now();
  if (flash) {
    ctx.shadowBlur = 25;
    // Красная
    ctx.fillStyle = (t % 400) < 200 ? '#ff0000' : '#330000';
    ctx.shadowColor = '#ff0000';
    ctx.fillRect(-20, -14, 16, 8);
    // Синяя
    ctx.fillStyle = (t % 400) >= 200 ? '#0088ff' : '#001133';
    ctx.shadowColor = '#0088ff';
    ctx.fillRect(4, -14, 16, 8);
    ctx.shadowBlur = 0;
  }

  // Фары
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#aaddff';
  ctx.fillRect(-38, 20, 12, 8);
  ctx.fillRect(26, 20, 12, 8);
  ctx.shadowBlur = 0;

  // Окантовка
  ctx.strokeStyle = '#0088ff';
  ctx.lineWidth = 1.5;
  ctx.shadowColor = '#0088ff';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.roundRect(-42, 12, 84, 28, 3);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Колёса
  [[-36, 28], [36, 28], [-32, 6], [32, 6]].forEach(([wx, wy]) => {
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.ellipse(wx, wy, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

// ═══════ Трафик-машина (случайная) ═══════
function drawTrafficCar(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number, scale: number,
  color: string,
) {
  if (scale <= 0 || sy < 0 || sy > H) return;
  ctx.save();
  ctx.translate(sx, sy);
  const s = Math.max(0.1, Math.min(scale * 4.2, 1.1));
  ctx.scale(s, s);

  ctx.fillStyle = color + '33';
  ctx.beginPath();
  ctx.roundRect(-38, 10, 76, 26, 3);
  ctx.fill();
  ctx.fillStyle = color + '22';
  ctx.beginPath();
  ctx.moveTo(-24, 10);
  ctx.lineTo(-28, -7);
  ctx.lineTo(28, -7);
  ctx.lineTo(24, 10);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.roundRect(-38, 10, 76, 26, 3);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Стопы
  ctx.fillStyle = '#ff2200';
  ctx.shadowColor = '#ff0000';
  ctx.shadowBlur = 8;
  ctx.fillRect(-34, 16, 10, 6);
  ctx.fillRect(24, 16, 10, 6);
  ctx.shadowBlur = 0;

  ctx.restore();
}

// ═══════ Дождь ═══════
interface RainDrop { x: number; y: number; speed: number; len: number; }
function initRain(): RainDrop[] {
  return Array.from({ length: 120 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    speed: 8 + Math.random() * 10,
    len: 10 + Math.random() * 20,
  }));
}

// ═══════ Трафик ═══════
interface TrafficCar {
  lane: number;    // -1, 0, 1 (полосы)
  z: number;       // мировая позиция
  color: string;
}

const TRAFFIC_COLORS = ['#00ffff', '#ff00ff', '#ffff00', '#00ff41', '#ff6600'];

function initTraffic(): TrafficCar[] {
  return Array.from({ length: 8 }, (_, i) => ({
    lane: [-1, 0, 1][i % 3],
    z: 2000 + i * 1800,
    color: TRAFFIC_COLORS[i % TRAFFIC_COLORS.length],
  }));
}

// ═══════════════════════════════════════
//  ГЛАВНЫЙ КОМПОНЕНТ ИГРЫ (Canvas)
// ═══════════════════════════════════════
type Screen = 'menu' | 'game' | 'gameover';

interface GameState {
  pos: number;          // позиция камеры по Z
  playerX: number;      // -1..1 позиция по X
  speed: number;
  score: number;
  lives: number;
  shield: boolean;
  shieldTimer: number;
  cops: CopState[];
  traffic: TrafficCar[];
  rain: RainDrop[];
  keys: Set<string>;
  tilt: number;
  hitCooldown: number;
  frame: number;
  danger: number;       // 0..1 уровень тревоги
}

interface CopState {
  z: number;          // мировая z (позади игрока)
  x: number;          // позиция X (-1..1)
  siren: boolean;
}

function initGame(): GameState {
  return {
    pos: 0,
    playerX: 0,
    speed: 0,
    score: 0,
    lives: 3,
    shield: false,
    shieldTimer: 0,
    cops: [
      { z: -800, x: -0.3, siren: true },
      { z: -1400, x: 0.3, siren: true },
    ],
    traffic: initTraffic(),
    rain: initRain(),
    keys: new Set(),
    tilt: 0,
    hitCooldown: 0,
    frame: 0,
    danger: 0,
  };
}

// ═══════ МЕНЮ ═══════
function Menu({ onStart }: { onStart: () => void }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 60);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      width: W, height: H,
      background: 'radial-gradient(ellipse at 50% 60%, #0a0028 0%, #050510 100%)',
      position: 'relative', overflow: 'hidden', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Orbitron, monospace',
    }}>
      {/* Звёзды */}
      {Array.from({ length: 40 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: 2, height: 2,
          borderRadius: '50%',
          background: i % 3 === 0 ? '#00ffff' : i % 3 === 1 ? '#ff00ff' : '#fff',
          left: `${(i * 17.3) % 100}%`,
          top: `${(i * 11.7) % 45}%`,
          opacity: 0.3 + Math.sin(tick * 0.05 + i) * 0.3,
          filter: 'blur(0.5px)',
        }} />
      ))}

      {/* Дорога-превью снизу */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%',
        background: 'linear-gradient(to bottom, transparent, #111122 40%, #1a1a33)',
      }}>
        {/* Разметка */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            bottom: `${10 + i * 18}%`,
            left: '50%',
            transform: 'translateX(-50%)',
            width: `${80 - i * 14}%`,
            height: 3,
            background: `linear-gradient(to right, transparent, #ffff00, transparent)`,
            opacity: 0.4 - i * 0.07,
          }} />
        ))}
      </div>

      {/* Заголовок */}
      <div style={{ position: 'relative', marginBottom: 8, textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.6em', color: '#ff00ff', opacity: 0.8, marginBottom: 10 }}>
          // УРОВЕНЬ УГРОЗЫ: МАКСИМУМ //
        </div>
        <h1 style={{
          fontSize: 52, fontWeight: 900, letterSpacing: '0.08em', margin: 0,
          color: '#00ffff',
          textShadow: `0 0 10px #00ffff, 0 0 40px #00ffff, 0 0 80px #00ffff,
            ${Math.sin(tick * 0.1) * 3}px 0 0 #ff00ff`,
        }}>CYBER CHASE</h1>
        <div style={{ fontSize: 13, letterSpacing: '0.4em', color: '#ff00ff', marginTop: 6, fontWeight: 700 }}>
          ◈ УЙДИ ОТ ПОЛИЦИИ ◈
        </div>
      </div>

      {/* Машина на меню */}
      <div style={{
        fontSize: 64, marginBottom: 24,
        filter: 'drop-shadow(0 0 20px #00ffff)',
        transform: `translateY(${Math.sin(tick * 0.08) * 5}px)`,
      }}>🏎️</div>

      <button
        onClick={onStart}
        style={{
          fontFamily: 'Orbitron, monospace', fontWeight: 700,
          fontSize: 15, letterSpacing: '0.25em',
          background: 'transparent',
          border: '2px solid #00ffff',
          color: '#00ffff',
          padding: '14px 50px',
          cursor: 'pointer',
          clipPath: 'polygon(12px 0%, 100% 0%, calc(100% - 12px) 100%, 0% 100%)',
          boxShadow: '0 0 20px #00ffff44',
          transition: 'all 0.2s',
          marginBottom: 16,
        }}
        onMouseEnter={e => {
          (e.target as HTMLButtonElement).style.background = 'rgba(0,255,255,0.12)';
          (e.target as HTMLButtonElement).style.boxShadow = '0 0 40px #00ffff88';
        }}
        onMouseLeave={e => {
          (e.target as HTMLButtonElement).style.background = 'transparent';
          (e.target as HTMLButtonElement).style.boxShadow = '0 0 20px #00ffff44';
        }}
      >
        ▶ НАЧАТЬ ПОГОНЮ
      </button>

      <div style={{ fontSize: 11, letterSpacing: '0.3em', color: '#00ffff', opacity: 0.4, marginTop: 8 }}>
        ← → РУЛЬ &nbsp;|&nbsp; SPACE НИТРО &nbsp;|&nbsp; ESC ПАУЗА
      </div>

      {/* Копы */}
      <div style={{ position: 'absolute', bottom: 60, left: 60, fontSize: 32,
        filter: 'drop-shadow(0 0 10px #0088ff)',
        transform: `translateX(${Math.cos(tick * 0.06) * 8}px)`, opacity: 0.5 }}>🚓</div>
      <div style={{ position: 'absolute', bottom: 70, right: 50, fontSize: 28,
        filter: 'drop-shadow(0 0 10px #ff0000)',
        transform: `translateX(${Math.sin(tick * 0.07) * 6}px)`, opacity: 0.5 }}>🚔</div>

      <div style={{ position: 'absolute', top: 16, right: 20, fontFamily: 'Orbitron', fontSize: 9, color: '#00ffff', opacity: 0.25, letterSpacing: '0.2em' }}>v2.0</div>
    </div>
  );
}

// ═══════ GAME OVER ═══════
function GameOver({ score, onRestart, onMenu }: { score: number; onRestart: () => void; onMenu: () => void }) {
  return (
    <div style={{
      width: W, height: H,
      background: 'radial-gradient(ellipse at 50% 50%, #1a0000 0%, #050510 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Orbitron, monospace',
    }}>
      <div style={{ fontSize: 11, letterSpacing: '0.5em', color: '#ff0000', opacity: 0.9, marginBottom: 10 }}>
        // ПОЙМАН //
      </div>
      <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: '0.1em', color: '#ff00ff',
        textShadow: '0 0 20px #ff00ff, 0 0 60px #ff00ff', marginBottom: 6 }}>
        GAME OVER
      </div>
      <div style={{ fontSize: 60, marginBottom: 20 }}>🚓</div>
      <div style={{ border: '1px solid #00ffff33', padding: '20px 50px', marginBottom: 28,
        background: 'rgba(0,255,255,0.04)', textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.3em', color: '#00ffff', opacity: 0.5, marginBottom: 6 }}>ПРОБЕГ</div>
        <div style={{ fontSize: 38, fontWeight: 900, color: '#00ffff',
          textShadow: '0 0 15px #00ffff' }}>{score.toLocaleString()} м</div>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        {[
          { label: '↺ СНОВА', color: '#00ffff', action: onRestart },
          { label: '← МЕНЮ', color: '#ff00ff', action: onMenu },
        ].map(({ label, color, action }) => (
          <button key={label} onClick={action} style={{
            fontFamily: 'Orbitron', fontWeight: 700, fontSize: 13,
            letterSpacing: '0.2em', background: 'transparent',
            border: `2px solid ${color}`, color,
            padding: '12px 32px', cursor: 'pointer',
            clipPath: 'polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%)',
          }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
//  ЗВУКОВОЙ ДВИЖОК (Web Audio API)
// ═══════════════════════════════════════
class SoundEngine {
  ctx: AudioContext;
  // Узлы постоянных звуков
  engineOsc: OscillatorNode | null = null;
  engineGain: GainNode | null = null;
  nitroOsc: OscillatorNode | null = null;
  nitroGain: GainNode | null = null;
  sirenOsc1: OscillatorNode | null = null;
  sirenOsc2: OscillatorNode | null = null;
  sirenGain: GainNode | null = null;
  sirenLfo: OscillatorNode | null = null;
  masterGain: GainNode;

  constructor() {
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.ctx.destination);
  }

  resume() { if (this.ctx.state === 'suspended') this.ctx.resume(); }

  // ── Двигатель (постоянный гул) ──
  startEngine() {
    if (this.engineOsc) return;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineGain.connect(this.masterGain);

    // Основной тон
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 80;
    this.engineOsc.connect(this.engineGain);
    this.engineOsc.start();

    // Фильтр — даёт "рокот"
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    this.engineOsc.disconnect();
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
  }

  updateEngine(speed: number, nitro: boolean) {
    if (!this.engineOsc || !this.engineGain) return;
    const t = this.ctx.currentTime;
    const freq = 60 + speed * 5.5;
    this.engineOsc.frequency.setTargetAtTime(freq, t, 0.1);
    this.engineGain.gain.setTargetAtTime(nitro ? 0 : 0.18, t, 0.05);

    // Нитро — отдельный высокий тон
    if (nitro && !this.nitroOsc) {
      this.nitroGain = this.ctx.createGain();
      this.nitroGain.gain.value = 0.12;
      this.nitroGain.connect(this.masterGain);
      this.nitroOsc = this.ctx.createOscillator();
      this.nitroOsc.type = 'sawtooth';
      this.nitroOsc.frequency.value = freq * 2.2;
      this.nitroOsc.connect(this.nitroGain);
      this.nitroOsc.start();
    } else if (!nitro && this.nitroOsc) {
      this.nitroGain?.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      setTimeout(() => { this.nitroOsc?.stop(); this.nitroOsc = null; this.nitroGain = null; }, 200);
    }
    if (this.nitroOsc) {
      this.nitroOsc.frequency.setTargetAtTime(freq * 2.2, t, 0.1);
      if (this.nitroGain) this.nitroGain.gain.setTargetAtTime(0.14, t, 0.05);
    }
  }

  stopEngine() {
    this.engineOsc?.stop(); this.engineOsc = null;
    this.nitroOsc?.stop(); this.nitroOsc = null;
  }

  // ── Сирена полиции (woo-woo) ──
  startSiren(danger: number) {
    if (this.sirenOsc1) {
      // Обновляем громкость по опасности
      if (this.sirenGain) this.sirenGain.gain.setTargetAtTime(danger * 0.12, this.ctx.currentTime, 0.2);
      return;
    }
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenGain.connect(this.masterGain);

    // LFO для колебания частоты (woo-woo эффект)
    this.sirenLfo = this.ctx.createOscillator();
    this.sirenLfo.type = 'sine';
    this.sirenLfo.frequency.value = 0.9;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 120;
    this.sirenLfo.connect(lfoGain);

    this.sirenOsc1 = this.ctx.createOscillator();
    this.sirenOsc1.type = 'square';
    this.sirenOsc1.frequency.value = 660;
    lfoGain.connect(this.sirenOsc1.frequency);
    this.sirenOsc1.connect(this.sirenGain);

    this.sirenLfo.start();
    this.sirenOsc1.start();
  }

  updateSiren(danger: number) {
    if (!this.sirenGain) return;
    this.sirenGain.gain.setTargetAtTime(danger * 0.1, this.ctx.currentTime, 0.3);
    if (this.sirenLfo) this.sirenLfo.frequency.setTargetAtTime(0.8 + danger * 0.8, this.ctx.currentTime, 0.2);
  }

  stopSiren() {
    this.sirenOsc1?.stop(); this.sirenOsc1 = null;
    this.sirenLfo?.stop(); this.sirenLfo = null;
    this.sirenGain = null;
  }

  // ── Удар ──
  playHit() {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.4, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
    g.connect(this.masterGain);

    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.4, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 180;
    filter.Q.value = 0.5;

    src.connect(filter);
    filter.connect(g);
    src.start();
  }

  // ── Нитро запуск ──
  playNitroStart() {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.2, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    g.connect(this.masterGain);
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.25);
    osc.connect(g);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  // ── Щит ──
  playShield() {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.15, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);
    g.connect(this.masterGain);
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.4);
    osc.connect(g);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.6);
  }

  destroy() {
    this.stopEngine();
    this.stopSiren();
    this.ctx.close();
  }
}

// ═══════════════════════════════════════
//  ИГРОВОЕ ПОЛЕ (Canvas)
// ═══════════════════════════════════════
function Game({ onGameOver }: { onGameOver: (score: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(initGame());
  const animRef = useRef<number>(0);
  const gameOverCalledRef = useRef(false);
  const soundRef = useRef<SoundEngine | null>(null);

  // HUD состояние (React side, обновляем редко)
  const [hud, setHud] = useState({ score: 0, lives: 3, speed: 0, danger: 0, shield: false });

  const keysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Инициализируем звук при первом нажатии (требование браузера)
      if (!soundRef.current) {
        soundRef.current = new SoundEngine();
        soundRef.current.startEngine();
      }
      soundRef.current.resume();
      // Нитро старт
      if (e.key === ' ' && !keysRef.current.has(' ')) {
        soundRef.current.playNitroStart();
      }
      keysRef.current.add(e.key);
      if (e.key === ' ') e.preventDefault();
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const update = useCallback((dt: number) => {
    const s = stateRef.current;
    const keys = keysRef.current;
    const f = dt / 16.67;

    s.frame++;

    // Скорость
    const maxSpeed = keys.has(' ') ? 28 : 18;
    const accel = 0.35;
    const decel = 0.15;
    if (s.speed < maxSpeed) s.speed = Math.min(maxSpeed, s.speed + accel * f);
    else if (s.speed > maxSpeed) s.speed = Math.max(maxSpeed, s.speed - decel * f);
    s.speed = Math.max(0, s.speed);

    // Движение
    s.pos += s.speed * SEG_LEN * 0.001 * f;
    s.score = Math.floor(s.pos / SEG_LEN * 2);

    // Управление
    const steer = 0.03 * f;
    const friction = 0.85;
    if (keys.has('ArrowLeft')) s.playerX -= steer;
    if (keys.has('ArrowRight')) s.playerX += steer;
    s.playerX *= friction + 0.15;
    s.playerX = Math.max(-1.4, Math.min(1.4, s.playerX));

    // Наклон
    if (keys.has('ArrowLeft')) s.tilt = Math.max(-8, s.tilt - 1.5 * f);
    else if (keys.has('ArrowRight')) s.tilt = Math.min(8, s.tilt + 1.5 * f);
    else s.tilt *= 0.85;

    // Изгиб дороги тянет
    const seg = getSeg(s.pos);
    s.playerX += seg.curve * 0.0015 * f;

    // Щит
    if (s.shieldTimer > 0) { s.shieldTimer -= dt; if (s.shieldTimer <= 0) s.shield = false; }

    // Полиция
    for (const cop of s.cops) {
      const copSpeed = s.speed * 0.75 + 6;
      cop.z += (s.speed - copSpeed) * SEG_LEN * 0.001 * f;
      cop.x += (s.playerX * 0.6 - cop.x) * 0.015 * f;

      if (cop.z > -300 && Math.abs(cop.x - s.playerX) < 0.4) {
        if (!s.shield && s.hitCooldown <= 0) {
          s.lives--;
          s.hitCooldown = 3000;
          cop.z = -900 - Math.random() * 500;
          soundRef.current?.playHit();
          if (s.lives <= 0 && !gameOverCalledRef.current) {
            gameOverCalledRef.current = true;
            onGameOver(s.score);
          }
        }
      }
    }

    if (s.hitCooldown > 0) s.hitCooldown -= dt;

    // Трафик
    for (const t of s.traffic) {
      t.z += s.speed * SEG_LEN * 0.001 * f;
      if (t.z > s.pos + 12000) {
        t.z = s.pos + 2000 + Math.random() * 6000;
        t.lane = [-1, 0, 1][Math.floor(Math.random() * 3)];
        t.color = TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)];
      }
      const tz = t.z - s.pos;
      if (tz > -SEG_LEN * 0.5 && tz < SEG_LEN * 0.5) {
        const tx = t.lane * 0.65;
        if (Math.abs(tx - s.playerX) < 0.35 && s.hitCooldown <= 0) {
          if (!s.shield) {
            s.lives--;
            s.hitCooldown = 2000;
            soundRef.current?.playHit();
            if (s.lives <= 0 && !gameOverCalledRef.current) {
              gameOverCalledRef.current = true;
              onGameOver(s.score);
            }
          }
        }
      }
    }

    // Дождь
    for (const drop of s.rain) {
      drop.y += drop.speed * f;
      drop.x += s.playerX * 2;
      if (drop.y > H) { drop.y = -20; drop.x = Math.random() * W; }
      if (drop.x < 0) drop.x += W;
      if (drop.x > W) drop.x -= W;
    }

    // Уровень опасности
    const minCopZ = Math.min(...s.cops.map(c => Math.abs(c.z)));
    s.danger = Math.max(0, Math.min(1, 1 - minCopZ / 1200));

    // Звук двигателя и сирены
    const snd = soundRef.current;
    if (snd) {
      const nitroOn = keys.has(' ') && s.speed > 20;
      snd.updateEngine(s.speed, nitroOn);
      snd.updateSiren(s.danger);
      snd.startSiren(s.danger);
    }

    // Щит-бонус
    if (s.frame % 600 === 0 && !s.shield) {
      s.shield = true;
      s.shieldTimer = 5000;
      soundRef.current?.playShield();
    }
  }, [onGameOver]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    const s = stateRef.current;
    ctx.clearRect(0, 0, W, H);

    // ── Небо (верхняя часть до горизонта) ──
    const skyGrad = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
    skyGrad.addColorStop(0, '#020210');
    skyGrad.addColorStop(0.6, '#060320');
    skyGrad.addColorStop(1, '#0a0530');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, HORIZON_Y);

    // Земля под дорогой (нижняя часть) — тёмная
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, HORIZON_Y, W, H - HORIZON_Y);

    // Звёзды
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 80; i++) {
      const sx = ((i * 137 + s.frame * 0.2) % W);
      const sy = ((i * 97) % (H * 0.45));
      const br = 0.2 + Math.sin(s.frame * 0.03 + i) * 0.3;
      ctx.globalAlpha = br;
      ctx.fillRect(sx, sy, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
    }
    ctx.globalAlpha = 1;

    // Неоновый горизонт
    const horizY = HORIZON_Y;
    const hGrad = ctx.createLinearGradient(0, horizY - 30, 0, horizY + 10);
    hGrad.addColorStop(0, 'transparent');
    hGrad.addColorStop(0.5, s.danger > 0.5 ? `rgba(255,0,80,${s.danger * 0.6})` : 'rgba(0,100,255,0.3)');
    hGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, horizY - 30, W, 40);

    // ── Дорога (псевдо-3D) ──
    // Логика: экран разбит на строки от HORIZON_Y (верх=даль) до H (низ=близко).
    // Каждая строка экрана соответствует одному сегменту.
    // Чем ниже строка — тем шире дорога и крупнее объекты.
    const camZ = s.pos;
    const startSeg = Math.floor(camZ / SEG_LEN);
    const roadH = H - HORIZON_Y; // высота дорожной зоны в пикселях

    type SegEntry = { seg: Seg; yTop: number; yBot: number; xTop: number; xBot: number; wTop: number; wBot: number; depth: number };
    const segData: SegEntry[] = [];

    let curveX = 0; // накопленный сдвиг от изгибов

    for (let n = 0; n < VISIBLE; n++) {
      const segIdx = (startSeg + n) % NUM_SEGS;
      const seg = TRACK[segIdx];

      // depth: 0=ближний (низ экрана), 1=дальний (горизонт)
      const d0 = n / VISIBLE;
      const d1 = (n + 1) / VISIBLE;

      // Перспектива: используем 1/z — чем дальше, тем меньше
      // Экранная Y: ближний → H, дальний → HORIZON_Y
      const yBot = HORIZON_Y + roadH * (1 - d0);   // нижняя граница сегмента
      const yTop = HORIZON_Y + roadH * (1 - d1);   // верхняя граница сегмента

      // Ширина дороги: перспектива 1/z → пропорционально расстоянию от горизонта
      const scaleBot = (yBot - HORIZON_Y) / roadH;  // 1 у низа, 0 у горизонта
      const scaleTop = (yTop - HORIZON_Y) / roadH;

      const wBot = scaleBot * W * 0.75;
      const wTop = scaleTop * W * 0.75;

      // Изгиб: накапливается с глубиной, влияет на X центра дороги
      const xBot = W / 2 + curveX * scaleBot - s.playerX * scaleBot * 200;
      curveX += seg.curve * 3;
      const xTop = W / 2 + curveX * scaleTop - s.playerX * scaleTop * 200;

      segData.push({ seg, yTop, yBot, xTop, xBot, wTop, wBot, depth: d0 });
    }

    // Рисуем от ДАЛЬНИХ (n=VISIBLE, горизонт) к БЛИЖНИМ (n=0, низ)
    // → segData[VISIBLE-1] = дальний, segData[0] = ближний
    // → рисуем segData от конца к началу
    for (let i = segData.length - 1; i >= 0; i--) {
      const { seg, yTop, yBot, xTop, xBot, wTop, wBot, depth } = segData[i];
      const isLight = seg.color === 'light';

      // Обочина (трава)
      drawQuad(ctx, isLight ? C.grass1 : C.grass2,
        xTop, yTop, wTop * 1.6,
        xBot, yBot, wBot * 1.6);

      // Бордюр (румбл)
      drawQuad(ctx, isLight ? C.rumble : C.rumbleAlt,
        xTop, yTop, wTop * 1.15,
        xBot, yBot, wBot * 1.15);

      // Асфальт
      drawQuad(ctx, isLight ? C.roadLight : C.road,
        xTop, yTop, wTop,
        xBot, yBot, wBot);

      // Разметка центральная
      if (isLight) {
        drawQuad(ctx, C.line,
          xTop, yTop, wTop * 0.03,
          xBot, yBot, wBot * 0.03);
      }

      // Боковые полосы
      if (isLight) {
        for (const side of [-1, 1]) {
          drawQuad(ctx, 'rgba(255,255,255,0.2)',
            xTop + side * wTop * 0.6, yTop, wTop * 0.012,
            xBot + side * wBot * 0.6, yBot, wBot * 0.012);
        }
      }

      // Туман (дальние сегменты затухают)
      if (depth > 0.1) {
        drawQuad(ctx, C.fog + (depth * 0.85) + ')',
          xTop, yTop, wTop * 1.6,
          xBot, yBot, wBot * 1.6);
      }
    }

    // ── Трафик впереди ──
    const roadH2 = H - HORIZON_Y;
    for (const t of s.traffic) {
      const tz = t.z - s.pos;
      if (tz <= 0 || tz > VISIBLE * SEG_LEN) continue;
      const depth = Math.min(1, (tz / SEG_LEN) / VISIBLE);
      // depth=0 → внизу (близко), depth=1 → у горизонта
      const screenY = HORIZON_Y + roadH2 * (1 - depth);
      const scaleH = (screenY - HORIZON_Y) / roadH2; // 0..1, 1=низ
      const roadW = scaleH * W * 0.75;
      const screenX = W / 2 + t.lane * roadW * 0.55 - s.playerX * scaleH * 200;
      const sc = Math.max(0.05, scaleH * 0.85);
      drawTrafficCar(ctx, screenX, screenY, sc, t.color);
    }

    // ── Полицейские позади (между игроком и низом) ──
    for (const cop of s.cops) {
      const dist = Math.abs(cop.z);
      if (cop.z >= 0 || dist > 2200) continue;
      const proximity = Math.max(0, 1 - dist / 2000); // 1=вплотную, 0=далеко
      // Копы рисуются ниже игрока — чуть «за» ним
      const screenY = H - 10 - proximity * 60;
      const scale = 0.2 + proximity * 0.7;
      const screenX = W / 2 + cop.x * 180 * scale;
      drawCopCar(ctx, screenX, screenY, scale, cop.siren);
    }

    // ── Игрок (низ экрана, по центру) ──
    drawPlayerCar(ctx, W / 2, s.tilt, s.shield);

    // ── Дождь ──
    ctx.strokeStyle = 'rgba(180,220,255,0.25)';
    ctx.lineWidth = 1;
    for (const drop of s.rain) {
      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - 1, drop.y + drop.len);
      ctx.stroke();
    }

    // ── Мигание при ударе ──
    if (s.hitCooldown > 2500) {
      const flash = Math.sin(s.frame * 0.5) > 0;
      if (flash) {
        ctx.fillStyle = 'rgba(255,0,0,0.2)';
        ctx.fillRect(0, 0, W, H);
      }
    }

    // ── Нитро-эффект ──
    if (keysRef.current.has(' ') && s.speed > 20) {
      const nGrad = ctx.createRadialGradient(W / 2, H, 0, W / 2, H, 200);
      nGrad.addColorStop(0, 'rgba(0,255,255,0.12)');
      nGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = nGrad;
      ctx.fillRect(0, 0, W, H);
      // Полосы скорости
      ctx.strokeStyle = 'rgba(0,255,255,0.15)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 20; i++) {
        const lx = Math.random() * W;
        ctx.beginPath();
        ctx.moveTo(lx, 0);
        ctx.lineTo(lx + (lx - W / 2) * 0.1, H);
        ctx.stroke();
      }
    }

    // ── Виньетка ──
    const vGrad = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
    vGrad.addColorStop(0, 'transparent');
    vGrad.addColorStop(1, 'rgba(0,0,10,0.5)');
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, W, H);

    // Сканлайны
    for (let y = 0; y < H; y += 3) {
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(0, y, W, 1);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(now - last, 50);
      last = now;
      update(dt);
      draw(ctx);

      // Обновляем HUD раз в 10 кадров
      if (stateRef.current.frame % 10 === 0) {
        const s = stateRef.current;
        setHud({ score: s.score, lives: s.lives, speed: Math.round(s.speed * 12), danger: s.danger, shield: s.shield });
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animRef.current);
      soundRef.current?.destroy();
      soundRef.current = null;
    };
  }, [update, draw]);

  return (
    <div style={{ position: 'relative', width: W, height: H }}>
      <canvas ref={canvasRef} width={W} height={H} style={{ display: 'block' }} />

      {/* HUD */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        padding: '12px 20px',
        fontFamily: 'Orbitron, monospace',
        pointerEvents: 'none',
      }}>
        {/* Слева: скорость */}
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.3em', color: '#00ffff', opacity: 0.6 }}>СКОРОСТЬ</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#00ffff', textShadow: '0 0 15px #00ffff', lineHeight: 1 }}>
            {hud.speed} <span style={{ fontSize: 11 }}>км/ч</span>
          </div>
        </div>

        {/* Центр: жизни + уровень угрозы */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.3em', color: '#ff0040', opacity: 0.8, marginBottom: 4 }}>УРОВЕНЬ УГРОЗЫ</div>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 6 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{
                width: 18, height: 8, borderRadius: 2,
                background: i / 8 < hud.danger
                  ? `hsl(${120 - hud.danger * 120}, 100%, 50%)`
                  : 'rgba(255,255,255,0.1)',
                boxShadow: i / 8 < hud.danger
                  ? `0 0 6px hsl(${120 - hud.danger * 120}, 100%, 50%)`
                  : 'none',
                transition: 'all 0.1s',
              }} />
            ))}
          </div>
          <div style={{ fontSize: 10, letterSpacing: '0.3em', color: '#ff00ff', opacity: 0.6 }}>ЖИЗНИ</div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} style={{ fontSize: 18, opacity: i < hud.lives ? 1 : 0.15, filter: i < hud.lives ? 'drop-shadow(0 0 6px #ff00ff)' : 'none' }}>❤️</span>
            ))}
          </div>
        </div>

        {/* Справа: счёт */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.3em', color: '#ffff00', opacity: 0.6 }}>ПРОБЕГ</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#ffff00', textShadow: '0 0 12px #ffff00', lineHeight: 1 }}>
            {hud.score.toLocaleString()} м
          </div>
          {hud.shield && (
            <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#00ffff', marginTop: 4 }}>🛡️ ЩИТ</div>
          )}
        </div>
      </div>

      {/* Нитро подсказка */}
      <div style={{
        position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
        fontFamily: 'Orbitron', fontSize: 10, letterSpacing: '0.3em',
        color: '#00ffff', opacity: 0.35, pointerEvents: 'none',
      }}>
        SPACE — НИТРО &nbsp;|&nbsp; ← → РУЛИТЬ
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
//  ROOT
// ═══════════════════════════════════════
export default function Index() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [finalScore, setFinalScore] = useState(0);
  const [gameKey, setGameKey] = useState(0);

  const handleGameOver = (score: number) => {
    setFinalScore(score);
    setScreen('gameover');
  };

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#050510',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ position: 'relative' }}>
        {/* Сканлайн-оверлей на весь блок */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 999, pointerEvents: 'none',
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.015) 2px, rgba(0,255,255,0.015) 4px)',
        }} />

        {screen === 'menu' && <Menu onStart={() => { setGameKey(k => k + 1); setScreen('game'); }} />}
        {screen === 'game' && <Game key={gameKey} onGameOver={handleGameOver} />}
        {screen === 'gameover' && (
          <GameOver
            score={finalScore}
            onRestart={() => { setGameKey(k => k + 1); setScreen('game'); }}
            onMenu={() => setScreen('menu')}
          />
        )}
      </div>
    </div>
  );
}