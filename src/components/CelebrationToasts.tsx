import { useEffect } from "react";
import type { ShipResult } from "../types";
import { ACHIEVEMENTS_BY_KEY } from "../xp/achievements";

// A queued ship celebration. Deliberately calm — a clean card, no confetti —
// so it reads as founder-tool satisfying, not childish.
export interface Toast extends ShipResult {
  toastId: number;
}

function ToastCard({ toast, onDone }: { toast: Toast; onDone: (id: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDone(toast.toastId), 4500);
    return () => clearTimeout(t);
  }, [toast.toastId, onDone]);

  return (
    <div className="pointer-events-auto w-72 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          Shipped
        </span>
        {toast.xpAwarded > 0 && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            +{toast.xpAwarded} XP
          </span>
        )}
      </div>
      <p className="mt-1 truncate text-sm font-medium text-zinc-900" title={toast.title}>
        {toast.title}
      </p>
      {toast.leveledUp && (
        <p className="mt-1 text-sm font-semibold text-zinc-900">
          ⬆ Level {toast.levelAfter}
        </p>
      )}
      {toast.newAchievements.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {toast.newAchievements.map((k) => (
            <p key={k} className="text-xs font-medium text-violet-700">
              🏆 {ACHIEVEMENTS_BY_KEY[k]?.title ?? k}
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
