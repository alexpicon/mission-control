import { useEffect, useState } from "react";
import type { ShipResult } from "../types";
import { ACHIEVEMENTS_BY_KEY } from "../xp/achievements";

// A queued ship celebration — pops in, counts the XP up, and (with the
// confetti fired from App) makes shipping feel like an event.
export interface Toast extends ShipResult {
  toastId: number;
}

// Counts from 0 up to `target` over ~600ms. Pure UI sugar.
function useCountUp(target: number): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (target <= 0) return;
    const steps = Math.min(target, 20);
    const stepMs = 600 / steps;
    let current = 0;
    const id = setInterval(() => {
      current += 1;
      setN(Math.round((current / steps) * target));
      if (current >= steps) {
        setN(target);
        clearInterval(id);
      }
    }, stepMs);
    return () => clearInterval(id);
  }, [target]);
  return n;
}

function ToastCard({ toast, onDone }: { toast: Toast; onDone: (id: number) => void }) {
  const xp = useCountUp(toast.xpAwarded);
  useEffect(() => {
    const t = setTimeout(() => onDone(toast.toastId), 5000);
    return () => clearTimeout(t);
  }, [toast.toastId, onDone]);

  return (
    <div className="mc-pop pointer-events-auto w-72 rounded-xl border border-emerald-200 bg-white p-3 shadow-lg ring-1 ring-emerald-100">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          🚀 Shipped
        </span>
        {toast.xpAwarded > 0 && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-sm font-bold tabular-nums text-emerald-700">
            +{xp} XP
          </span>
        )}
      </div>
      <p className="mt-1 truncate text-sm font-medium text-zinc-900" title={toast.title}>
        {toast.title}
      </p>
      {toast.leveledUp && (
        <p className="mt-1 text-sm font-bold text-emerald-700">⬆ Level {toast.levelAfter}!</p>
      )}
      {toast.newAchievements.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {toast.newAchievements.map((k) => (
            <p key={k} className="text-xs font-semibold text-violet-700">
              🏆 {ACHIEVEMENTS_BY_KEY[k]?.title ?? k} unlocked
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function CelebrationToasts({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastCard key={t.toastId} toast={t} onDone={onDismiss} />
      ))}
    </div>
  );
}
