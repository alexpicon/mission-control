import { useEffect, useRef, useState } from "react";
import type { LevelInfo } from "../xp/model";

const PALETTE = ["#10b981", "#34d399", "#14b8a6", "#7c3aed", "#f59e0b", "#0ea5e9"];

interface Piece {
  id: number;
  left: number; // %
  top: number; // %
  dx: number; // px
  dy: number; // px
  r: number; // deg
  dur: number; // ms
  size: number; // px
  w: number; // px (width, for confetti-strip shapes)
  color: string;
  radius: string;
}

// Deterministic-enough randomness for a visual effect (app code — Math.random ok).
function makePieces(count: number, power: number, seed: number): Piece[] {
  const pieces: Piece[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = (30 + Math.random() * 80) * power;
    const size = 4 + Math.random() * 4;
    pieces.push({
      id: seed * 1000 + i,
      left: 20 + Math.random() * 60,
      top: 48 + Math.random() * 24,
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist - 10, // slight upward bias
      r: Math.random() * 720 - 360,
      dur: 600 + Math.random() * 300,
      size,
      w: Math.random() < 0.5 ? size : size * 2, // mix squares and strips
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      radius: Math.random() < 0.4 ? "9999px" : "1px",
    });
  }
  return pieces;
}

// Always-visible portfolio level + XP bar. On a ship the bar fills; on a
// level-up the full bar SHATTERS into pieces that scatter around the level
// area (localized — not the whole screen) as it clears to the next level.
export function LevelBadge({ level, pulseKey }: { level: LevelInfo; pulseKey: number }) {
  const [dispLevel, setDispLevel] = useState(level.level);
  const [dispPct, setDispPct] = useState(level.pctToNext);
  const [instant, setInstant] = useState(false);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const prevLevel = useRef(level.level);
  const prevXp = useRef(level.totalXp);
  const seed = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function explode(count: number, power: number) {
    seed.current += 1;
    setPieces(makePieces(count, power, seed.current));
    timers.current.push(window.setTimeout(() => setPieces([]), 1000));
  }

  useEffect(() => {
    const leveledUp = level.level > prevLevel.current;
    const gained = level.totalXp > prevXp.current;
    prevLevel.current = level.level;
    prevXp.current = level.totalXp;

    if (leveledUp) {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setInstant(false);
      setDispPct(100); // 1) fill the old level's bar to full
      timers.current.push(
        window.setTimeout(() => {
          explode(22, 1.25); // 2) the full bar shatters into pieces...
          setInstant(true); // ...and clears to the new level in the same instant
          setDispLevel(level.level);
          setDispPct(0);
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              setInstant(false);
              setDispPct(level.pctToNext); // 3) fill to the remainder
            })
          );
        }, 780)
      );
      return;
    }

    // Same level, more XP: animate the bar up and pop a few pieces at the tip.
    setDispLevel(level.level);
    setDispPct(level.pctToNext);
    if (gained) explode(9, 0.8);
  }, [level]);

  return (
    <div className="relative rounded-xl bg-white/5 p-3 ring-1 ring-inset ring-white/10">
      <span
        key={`glow-${pulseKey}`}
        className="mc-glow pointer-events-none absolute inset-0 rounded-xl"
        aria-hidden
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-emerald-500 to-teal-500 text-[11px] font-bold text-white shadow-sm">
            {dispLevel}
          </span>
          <span className="text-sm font-semibold text-white">Level {dispLevel}</span>
        </div>
        <span className="text-xs font-medium tabular-nums text-zinc-500">
          {level.totalXp} XP
        </span>
      </div>

      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuenow={level.pctToNext}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progress to next level"
      >
        <div
          className={`h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 ${
            instant ? "" : "transition-[width] duration-700 ease-out"
          }`}
          style={{ width: `${dispPct}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-zinc-500">
        {level.xpForNextLevel - level.xpIntoLevel} XP to level {dispLevel + 1}
      </p>

      {/* shatter pieces — scatter locally around the bar, never full-screen */}
      {pieces.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-20">
          {pieces.map((p) => (
            <span
              key={p.id}
              className="mc-piece absolute block"
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: p.w,
                height: p.size,
                background: p.color,
                borderRadius: p.radius,
                // custom props consumed by the mc-piece keyframe
                ["--dx" as string]: `${p.dx}px`,
                ["--dy" as string]: `${p.dy}px`,
                ["--r" as string]: `${p.r}deg`,
                ["--dur" as string]: `${p.dur}ms`,
              }}
              aria-hidden
            />
          ))}
        </div>
      )}
    </div>
  );
}
