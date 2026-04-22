import { useState, useEffect, useCallback, useRef } from 'react';

// ═══════════════ ТИПЫ ═══════════════
type GameScreen = 'menu' | 'game' | 'settings' | 'gameover';
type BonusType = 'speed' | 'shield' | 'clear';

interface CarPiece {
  shape: number[][];
  color: string;
  bonusType?: BonusType;
  emoji: string;
}

interface ActivePiece {
  piece: CarPiece;
  x: number;
  y: number;
}

interface BonusEffect {
  type: BonusType;
  remaining: number;
  label: string;
  icon: string;
}

interface FloatingScore {
  id: number;
  x: number;
  y: number;
  value: string;
}

// ═══════════════ МАШИНКИ (Тетромино) ═══════════════
const CAR_PIECES: CarPiece[] = [
  { emoji: '🚗', color: '#00ffff', shape: [[1, 1], [1, 1]] },
  { emoji: '🚕', color: '#ff00ff', shape: [[0, 1, 0], [1, 1, 1]], bonusType: 'shield' },
  { emoji: '🚙', color: '#ffff00', shape: [[1, 1, 0], [0, 1, 1]] },
  { emoji: '🏎️', color: '#ff6600', shape: [[1, 0], [1, 0], [1, 1]], bonusType: 'speed' },
  { emoji: '🚓', color: '#00ff41', shape: [[1, 1, 1], [0, 1, 0]], bonusType: 'clear' },
  { emoji: '🚑', color: '#ff1493', shape: [[0, 1], [1, 1], [1, 0]] },
  { emoji: '🚒', color: '#7b00ff', shape: [[1, 1, 1, 1]] },
];

const COLS = 10;
const ROWS = 18;
const CELL = 36;

function createEmptyGrid(): (string | null)[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPiece(): CarPiece {
  return CAR_PIECES[Math.floor(Math.random() * CAR_PIECES.length)];
}

function rotatePiece(shape: number[][]): number[][] {
  const rows = shape.length;
  const cols = shape[0].length;
  const rotated: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rotated[c][rows - 1 - r] = shape[r][c];
    }
  }
  return rotated;
}

// ═══════════════ ГЛАВНОЕ МЕНЮ ═══════════════
function MainMenu({ onStart, onSettings }: { onStart: () => void; onSettings: () => void }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 80);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative w-full h-screen flex flex-col items-center justify-center cyber-grid overflow-hidden" style={{ background: 'var(--dark-bg)' }}>
      {/* Частицы */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="absolute rounded-full" style={{
            width: Math.random() * 3 + 1,
            height: Math.random() * 3 + 1,
            background: i % 3 === 0 ? '#00ffff' : i % 3 === 1 ? '#ff00ff' : '#ffff00',
            left: `${(i * 5.3) % 100}%`,
            top: `${((tick * 0.3 + i * 17) % 110) - 5}%`,
            filter: 'blur(1px)',
            opacity: 0.25,
          }} />
        ))}
      </div>

      {/* Декоративные линии */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right, transparent, #00ffff, transparent)', opacity: 0.5 }} />
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right, transparent, #ff00ff, transparent)', opacity: 0.5 }} />
      <div className="absolute left-8 top-0 bottom-0 w-px" style={{ background: 'linear-gradient(to bottom, transparent, #00ffff, transparent)', opacity: 0.3 }} />
      <div className="absolute right-8 top-0 bottom-0 w-px" style={{ background: 'linear-gradient(to bottom, transparent, #ff00ff, transparent)', opacity: 0.3 }} />

      {/* Заголовок */}
      <div className="menu-slide-in mb-16 text-center">
        <div style={{ fontFamily: 'Rajdhani', fontSize: 13, letterSpacing: '0.5em', color: '#00ffff', opacity: 0.7, marginBottom: 8 }}>
          УРОВЕНЬ 01 // ЗАПУСК СИСТЕМЫ
        </div>
        <h1
          className="glitch-text neon-cyan"
          data-text="CYBER DRIFT"
          style={{ fontFamily: 'Orbitron', fontSize: 'clamp(40px, 8vw, 72px)', fontWeight: 900, letterSpacing: '0.1em' }}
        >
          CYBER DRIFT
        </h1>
        <div className="neon-magenta mt-2" style={{ fontFamily: 'Orbitron', fontSize: 14, letterSpacing: '0.4em', fontWeight: 700 }}>
          ◈ НЕОНОВЫЕ ГОНКИ ◈
        </div>
      </div>

      {/* Кнопки */}
      <div className="menu-slide-in flex flex-col gap-5 items-center" style={{ animationDelay: '0.15s' }}>
        <button className="btn-cyber" onClick={onStart} style={{ minWidth: 260 }}>▶ НАЧАТЬ ИГРУ</button>
        <button className="btn-cyber btn-cyber-magenta" onClick={onSettings} style={{ minWidth: 260 }}>⚙ НАСТРОЙКИ</button>
      </div>

      {/* Подсказка */}
      <div className="menu-slide-in absolute bottom-12 text-center" style={{ animationDelay: '0.3s' }}>
        <div style={{ fontFamily: 'Rajdhani', fontSize: 12, letterSpacing: '0.3em', color: '#00ffff', opacity: 0.5 }}>
          ← → ДВИЖЕНИЕ &nbsp;|&nbsp; ↑ ПОВОРОТ &nbsp;|&nbsp; ↓ УСКОРИТЬ &nbsp;|&nbsp; ПРОБЕЛ — СБРОС
        </div>
      </div>

      {/* Версия */}
      <div className="absolute top-6 right-8" style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#00ffff', opacity: 0.3, letterSpacing: '0.2em' }}>v1.0.0</div>

      {/* Машинки */}
      <div className="absolute left-12 bottom-20 text-5xl" style={{ transform: `translateX(${Math.sin(tick * 0.05) * 10}px)`, filter: 'drop-shadow(0 0 10px #00ffff)', opacity: 0.3 }}>🏎️</div>
      <div className="absolute right-12 bottom-32 text-4xl" style={{ transform: `translateX(${Math.cos(tick * 0.04) * 8}px)`, filter: 'drop-shadow(0 0 10px #ff00ff)', opacity: 0.25 }}>🚗</div>
    </div>
  );
}

// ═══════════════ НАСТРОЙКИ ═══════════════
function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [speed, setSpeed] = useState(1);
  const [sound, setSound] = useState(true);
  const [ghost, setGhost] = useState(true);

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center cyber-grid" style={{ background: 'var(--dark-bg)' }}>
      <div className="menu-slide-in w-full max-w-md px-8">
        <div className="mb-8 text-center">
          <div style={{ fontFamily: 'Rajdhani', fontSize: 12, letterSpacing: '0.4em', color: '#ff00ff', opacity: 0.7, marginBottom: 4 }}>КОНФИГУРАЦИЯ СИСТЕМЫ</div>
          <h2 className="neon-magenta" style={{ fontFamily: 'Orbitron', fontSize: 28, fontWeight: 900, letterSpacing: '0.15em' }}>НАСТРОЙКИ</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="border border-cyan-900 p-5" style={{ background: 'rgba(0,255,255,0.03)' }}>
            <div className="flex justify-between items-center mb-3">
              <span style={{ fontFamily: 'Rajdhani', fontSize: 14, letterSpacing: '0.2em', color: '#00ffff', fontWeight: 600 }}>НАЧАЛЬНАЯ СКОРОСТЬ</span>
              <span className="neon-cyan" style={{ fontFamily: 'Orbitron', fontSize: 18, fontWeight: 700 }}>{speed}</span>
            </div>
            <input type="range" min={1} max={5} value={speed} onChange={e => setSpeed(+e.target.value)} className="w-full accent-cyan-400" />
            <div className="flex justify-between mt-1" style={{ fontSize: 10, color: '#00ffff', opacity: 0.4, fontFamily: 'Orbitron' }}>
              <span>СЛОУ</span><span>МАХ</span>
            </div>
          </div>

          {[
            { label: 'ЗВУКОВЫЕ ЭФФЕКТЫ', value: sound, set: setSound },
            { label: 'ПРИЗРАК (ТЕНЬ)', value: ghost, set: setGhost },
          ].map(({ label, value, set }) => (
            <div key={label} className="border border-cyan-900 p-5 flex justify-between items-center" style={{ background: 'rgba(0,255,255,0.03)' }}>
              <span style={{ fontFamily: 'Rajdhani', fontSize: 14, letterSpacing: '0.2em', color: '#00ffff', fontWeight: 600 }}>{label}</span>
              <button onClick={() => set((s: boolean) => !s)} className={`w-12 h-6 rounded-full transition-all relative ${value ? 'bg-cyan-400' : 'bg-gray-700'}`}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-black transition-all ${value ? 'left-6' : 'left-0.5'}`} />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <button className="btn-cyber btn-cyber-magenta" onClick={onBack}>← НАЗАД</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════ ИГРОВОЕ ПОЛЕ ═══════════════
function GameScreen({ onGameOver }: { onGameOver: (score: number) => void }) {
  const [grid, setGrid] = useState<(string | null)[][]>(createEmptyGrid());
  const [active, setActive] = useState<ActivePiece>({ piece: randomPiece(), x: 3, y: 0 });
  const [next, setNext] = useState<CarPiece>(randomPiece());
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [bonus, setBonus] = useState<BonusEffect | null>(null);
  const [floatingScores, setFloatingScores] = useState<FloatingScore[]>([]);
  const [clearingRows, setClearingRows] = useState<number[]>([]);
  const [shieldActive, setShieldActive] = useState(false);
  const [paused, setPaused] = useState(false);

  const gridRef = useRef(grid);
  const activeRef = useRef(active);
  const nextRef = useRef(next);
  const scoreRef = useRef(score);
  const levelRef = useRef(level);
  const shieldRef = useRef(shieldActive);
  const pausedRef = useRef(paused);
  const bonusRef = useRef(bonus);
  const floatIdRef = useRef(0);
  const gameOverCalledRef = useRef(false);

  gridRef.current = grid;
  activeRef.current = active;
  nextRef.current = next;
  scoreRef.current = score;
  levelRef.current = level;
  shieldRef.current = shieldActive;
  pausedRef.current = paused;
  bonusRef.current = bonus;

  const canPlace = useCallback((piece: CarPiece, px: number, py: number, g: (string | null)[][]) => {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (!piece.shape[r][c]) continue;
        const nx = px + c;
        const ny = py + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
        if (ny >= 0 && g[ny][nx]) return false;
      }
    }
    return true;
  }, []);

  const getGhostY = useCallback((piece: CarPiece, px: number, py: number, g: (string | null)[][]) => {
    let gy = py;
    while (canPlace(piece, px, gy + 1, g)) gy++;
    return gy;
  }, [canPlace]);

  const addFloat = useCallback((value: string, x: number, y: number) => {
    const id = ++floatIdRef.current;
    setFloatingScores(fs => [...fs, { id, x, y, value }]);
    setTimeout(() => setFloatingScores(fs => fs.filter(f => f.id !== id)), 800);
  }, []);

  const applyBonus = useCallback((bonusType: BonusType) => {
    if (bonusType === 'shield') {
      setShieldActive(true);
      setBonus({ type: 'shield', remaining: 30, label: 'ЩИТ АКТИВЕН', icon: '🛡️' });
      setTimeout(() => { setShieldActive(false); setBonus(null); }, 15000);
    } else if (bonusType === 'speed') {
      setBonus({ type: 'speed', remaining: 20, label: 'УСКОРЕНИЕ', icon: '⚡' });
      setTimeout(() => setBonus(null), 8000);
    } else if (bonusType === 'clear') {
      setGrid(g => {
        const nonEmpty = g.filter(row => row.some(c => c !== null));
        const empty = Array.from({ length: ROWS - nonEmpty.length }, () => Array(COLS).fill(null));
        return [...empty, ...nonEmpty];
      });
      setBonus({ type: 'clear', remaining: 1, label: 'СТРОКИ УДАЛЕНЫ!', icon: '💥' });
      setTimeout(() => setBonus(null), 2000);
      addFloat('💥 CLEAR!', 3, 8);
    }
  }, [addFloat]);

  const lockPiece = useCallback((piece: CarPiece, px: number, py: number) => {
    const g = gridRef.current.map(r => [...r]);

    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (!piece.shape[r][c]) continue;
        const ny = py + r;
        const nx = px + c;
        if (ny < 0) {
          if (!shieldRef.current && !gameOverCalledRef.current) {
            gameOverCalledRef.current = true;
            onGameOver(scoreRef.current);
          }
          return;
        }
        g[ny][nx] = piece.color;
      }
    }

    const fullRows: number[] = [];
    g.forEach((row, i) => {
      if (row.every(c => c !== null)) fullRows.push(i);
    });

    if (fullRows.length > 0) {
      setClearingRows(fullRows);
      setTimeout(() => {
        setClearingRows([]);
        const newGrid = g.filter((_, i) => !fullRows.includes(i));
        while (newGrid.length < ROWS) newGrid.unshift(Array(COLS).fill(null));
        setGrid(newGrid);
        const pts = [0, 100, 300, 600, 1000][fullRows.length] * levelRef.current;
        setScore(s => s + pts);
        setLines(l => {
          const nl = l + fullRows.length;
          setLevel(Math.floor(nl / 10) + 1);
          return nl;
        });
        addFloat(`+${pts}`, 4, fullRows[0]);
      }, 300);
    } else {
      setGrid(g);
    }

    if (piece.bonusType) applyBonus(piece.bonusType);
    setScore(s => s + 10 * levelRef.current);

    const np = nextRef.current;
    const nn = randomPiece();
    setNext(nn);

    const startX = 3;
    if (!canPlace(np, startX, 0, g)) {
      if (!shieldRef.current && !gameOverCalledRef.current) {
        gameOverCalledRef.current = true;
        onGameOver(scoreRef.current + 10 * levelRef.current);
      }
      return;
    }
    setActive({ piece: np, x: startX, y: 0 });
  }, [applyBonus, onGameOver, canPlace, addFloat]);

  useEffect(() => {
    const speed = bonusRef.current?.type === 'speed' ? 200 : Math.max(100, 800 - (level - 1) * 70);
    const interval = setInterval(() => {
      if (pausedRef.current) return;
      const a = activeRef.current;
      const g = gridRef.current;
      if (canPlace(a.piece, a.x, a.y + 1, g)) {
        setActive(prev => ({ ...prev, y: prev.y + 1 }));
      } else {
        lockPiece(a.piece, a.x, a.y);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [level, bonus, canPlace, lockPiece]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const a = activeRef.current;
      const g = gridRef.current;

      if (e.key === 'Escape') { setPaused(p => !p); return; }
      if (pausedRef.current) return;

      if (e.key === 'ArrowLeft') {
        if (canPlace(a.piece, a.x - 1, a.y, g)) setActive(prev => ({ ...prev, x: prev.x - 1 }));
      } else if (e.key === 'ArrowRight') {
        if (canPlace(a.piece, a.x + 1, a.y, g)) setActive(prev => ({ ...prev, x: prev.x + 1 }));
      } else if (e.key === 'ArrowDown') {
        if (canPlace(a.piece, a.x, a.y + 1, g)) { setActive(prev => ({ ...prev, y: prev.y + 1 })); setScore(s => s + 1); }
      } else if (e.key === 'ArrowUp') {
        const rotated = rotatePiece(a.piece.shape);
        const rp = { ...a.piece, shape: rotated };
        if (canPlace(rp, a.x, a.y, g)) setActive(prev => ({ ...prev, piece: rp }));
      } else if (e.key === ' ') {
        e.preventDefault();
        let dropY = a.y;
        while (canPlace(a.piece, a.x, dropY + 1, g)) dropY++;
        setScore(s => s + (dropY - a.y) * 2);
        lockPiece(a.piece, a.x, dropY);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canPlace, lockPiece]);

  const ghostY = getGhostY(active.piece, active.x, active.y, grid);

  const displayGrid = grid.map(r => [...r]);
  for (let r = 0; r < active.piece.shape.length; r++) {
    for (let c = 0; c < active.piece.shape[r].length; c++) {
      if (!active.piece.shape[r][c]) continue;
      const ny = ghostY + r; const nx = active.x + c;
      if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS && !displayGrid[ny][nx]) displayGrid[ny][nx] = 'ghost';
    }
  }
  for (let r = 0; r < active.piece.shape.length; r++) {
    for (let c = 0; c < active.piece.shape[r].length; c++) {
      if (!active.piece.shape[r][c]) continue;
      const ny = active.y + r; const nx = active.x + c;
      if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) displayGrid[ny][nx] = active.piece.color + ':active';
    }
  }

  return (
    <div className="w-full h-screen flex items-center justify-center cyber-grid overflow-hidden" style={{ background: 'var(--dark-bg)' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* ЛЕВАЯ ПАНЕЛЬ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 140 }}>
          {[
            { label: 'ОЧКИ', value: score.toLocaleString(), color: '#00ffff', size: 20 },
            { label: 'УРОВЕНЬ', value: String(level), color: '#ff00ff', size: 28 },
            { label: 'ЛИНИИ', value: String(lines), color: '#ffff00', size: 20 },
          ].map(({ label, value, color, size }) => (
            <div key={label} className="border p-4" style={{ borderColor: color + '33', background: color + '08' }}>
              <div style={{ fontFamily: 'Rajdhani', fontSize: 11, letterSpacing: '0.3em', color, opacity: 0.6, marginBottom: 4 }}>{label}</div>
              <div style={{ fontFamily: 'Orbitron', fontSize: size, fontWeight: 700, color, textShadow: `0 0 10px ${color}` }}>{value}</div>
            </div>
          ))}

          {bonus && (
            <div className="bonus-pop border p-4 text-center" style={{
              borderColor: bonus.type === 'shield' ? '#00ffff' : bonus.type === 'speed' ? '#ffff00' : '#00ff41',
              background: `rgba(${bonus.type === 'shield' ? '0,255,255' : bonus.type === 'speed' ? '255,255,0' : '0,255,65'}, 0.08)`,
            }}>
              <div style={{ fontSize: 28 }}>{bonus.icon}</div>
              <div style={{ fontFamily: 'Rajdhani', fontSize: 11, letterSpacing: '0.2em', fontWeight: 700, marginTop: 4, color: bonus.type === 'shield' ? '#00ffff' : bonus.type === 'speed' ? '#ffff00' : '#00ff41' }}>{bonus.label}</div>
            </div>
          )}
        </div>

        {/* ПОЛЕ */}
        <div className="relative game-border" style={{ width: COLS * CELL, height: ROWS * CELL }}>
          {displayGrid.map((row, ri) => (
            <div key={ri} className={`flex ${clearingRows.includes(ri) ? 'row-clearing' : ''}`} style={{ height: CELL }}>
              {row.map((cell, ci) => {
                const isActive = cell?.endsWith(':active');
                const color = isActive ? cell!.replace(':active', '') : cell;
                const isGhost = cell === 'ghost';
                return (
                  <div key={ci} className="game-cell" style={{
                    width: CELL,
                    background: isGhost ? 'rgba(0,255,255,0.08)' : 'transparent',
                    borderColor: isGhost ? 'rgba(0,255,255,0.2)' : color && !isGhost ? color + '55' : 'rgba(0,255,255,0.06)',
                    boxShadow: isActive ? `0 0 8px ${color}, inset 0 0 8px ${color}44` : 'none',
                    position: 'relative',
                  }}>
                    {color && !isGhost && (
                      <div style={{ position: 'absolute', inset: 2, background: color, opacity: 0.85, boxShadow: isActive ? `0 0 6px ${color}` : 'none', borderRadius: 2 }} />
                    )}
                    {isGhost && (
                      <div style={{ position: 'absolute', inset: 2, border: '1px dashed rgba(0,255,255,0.3)', borderRadius: 2 }} />
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {shieldActive && (
            <div className="absolute inset-0 pointer-events-none shield-active" style={{ border: '3px solid #00ffff', borderRadius: 2 }} />
          )}

          {paused && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(5,5,16,0.92)', zIndex: 10 }}>
              <div className="text-center">
                <div className="neon-cyan" style={{ fontFamily: 'Orbitron', fontSize: 28, fontWeight: 900, letterSpacing: '0.2em' }}>ПАУЗА</div>
                <div style={{ fontFamily: 'Rajdhani', fontSize: 12, color: '#00ffff', opacity: 0.5, marginTop: 8, letterSpacing: '0.3em' }}>ESC — ПРОДОЛЖИТЬ</div>
              </div>
            </div>
          )}

          {floatingScores.map(f => (
            <div key={f.id} className="score-float absolute pointer-events-none neon-yellow" style={{ fontFamily: 'Orbitron', fontSize: 14, fontWeight: 900, left: f.x * CELL, top: f.y * CELL, zIndex: 20 }}>
              {f.value}
            </div>
          ))}
        </div>

        {/* ПРАВАЯ ПАНЕЛЬ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 140 }}>
          <div className="border border-cyan-900 p-4" style={{ background: 'rgba(0,255,255,0.03)' }}>
            <div style={{ fontFamily: 'Rajdhani', fontSize: 11, letterSpacing: '0.3em', color: '#00ffff', opacity: 0.6, marginBottom: 8 }}>СЛЕДУЮЩАЯ</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
              {next.shape.map((row, ri) => (
                <div key={ri} style={{ display: 'flex', gap: 2 }}>
                  {row.map((cell, ci) => (
                    <div key={ci} style={{ width: 20, height: 20, background: cell ? next.color : 'transparent', boxShadow: cell ? `0 0 4px ${next.color}` : 'none', borderRadius: 2, border: cell ? 'none' : '1px solid rgba(0,255,255,0.05)' }} />
                  ))}
                </div>
              ))}
              <div style={{ fontSize: 20, marginTop: 8 }}>{next.emoji}</div>
            </div>
          </div>

          <div className="border border-cyan-900 p-4" style={{ background: 'rgba(0,255,255,0.03)' }}>
            <div style={{ fontFamily: 'Rajdhani', fontSize: 11, letterSpacing: '0.3em', color: '#00ffff', opacity: 0.6, marginBottom: 8 }}>УПРАВЛЕНИЕ</div>
            {[['↑', 'Поворот'], ['← →', 'Движение'], ['↓', 'Вниз'], ['SPC', 'Сброс'], ['ESC', 'Пауза']].map(([key, action]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#00ffff', background: 'rgba(0,255,255,0.1)', padding: '2px 5px', borderRadius: 2 }}>{key}</span>
                <span style={{ fontFamily: 'Rajdhani', fontSize: 11, color: '#00ffff', opacity: 0.5 }}>{action}</span>
              </div>
            ))}
          </div>

          <div className="border border-cyan-900 p-4" style={{ background: 'rgba(0,255,255,0.03)' }}>
            <div style={{ fontFamily: 'Rajdhani', fontSize: 11, letterSpacing: '0.3em', color: '#00ffff', opacity: 0.6, marginBottom: 8 }}>БОНУСЫ</div>
            {[['🚕', '#ff00ff', 'Щит'], ['🏎️', '#ffff00', 'Ускор.'], ['🚓', '#00ff41', 'Очист.']].map(([icon, color, label]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span style={{ fontFamily: 'Rajdhani', fontSize: 11, color, opacity: 0.8 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════ GAME OVER ═══════════════
function GameOverScreen({ score, onRestart, onMenu }: { score: number; onRestart: () => void; onMenu: () => void }) {
  return (
    <div className="w-full h-screen flex flex-col items-center justify-center cyber-grid" style={{ background: 'var(--dark-bg)' }}>
      <div className="menu-slide-in text-center">
        <div style={{ fontFamily: 'Orbitron', fontSize: 11, letterSpacing: '0.5em', color: '#ff0000', opacity: 0.8, marginBottom: 12 }}>
          // СИСТЕМА СБОЙ //
        </div>
        <h2 style={{ fontFamily: 'Orbitron', fontSize: 'clamp(36px,6vw,60px)', fontWeight: 900, color: '#ff00ff', textShadow: '0 0 20px #ff00ff, 0 0 60px #ff00ff', letterSpacing: '0.1em', marginBottom: 8 }}>
          GAME OVER
        </h2>

        <div className="my-8 border border-cyan-900 p-6 inline-block" style={{ background: 'rgba(0,255,255,0.03)', minWidth: 240 }}>
          <div style={{ fontFamily: 'Rajdhani', fontSize: 13, letterSpacing: '0.3em', color: '#00ffff', opacity: 0.6, marginBottom: 4 }}>ФИНАЛЬНЫЙ СЧЁТ</div>
          <div className="neon-cyan" style={{ fontFamily: 'Orbitron', fontSize: 40, fontWeight: 900 }}>{score.toLocaleString()}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
          <button className="btn-cyber" onClick={onRestart} style={{ minWidth: 240 }}>↺ СНОВА ИГРАТЬ</button>
          <button className="btn-cyber btn-cyber-magenta" onClick={onMenu} style={{ minWidth: 240 }}>← ГЛАВНОЕ МЕНЮ</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════ ГЛАВНЫЙ КОМПОНЕНТ ═══════════════
export default function Index() {
  const [screen, setScreen] = useState<GameScreen>('menu');
  const [finalScore, setFinalScore] = useState(0);
  const [gameKey, setGameKey] = useState(0);

  const handleGameOver = (score: number) => {
    setFinalScore(score);
    setScreen('gameover');
  };

  return (
    <div className="scanlines">
      {screen === 'menu' && <MainMenu onStart={() => setScreen('game')} onSettings={() => setScreen('settings')} />}
      {screen === 'settings' && <SettingsScreen onBack={() => setScreen('menu')} />}
      {screen === 'game' && <GameScreen key={gameKey} onGameOver={handleGameOver} />}
      {screen === 'gameover' && <GameOverScreen score={finalScore} onRestart={() => { setGameKey(k => k + 1); setScreen('game'); }} onMenu={() => setScreen('menu')} />}
    </div>
  );
}
