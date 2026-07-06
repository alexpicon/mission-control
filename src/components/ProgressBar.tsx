export function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100"
        role="progressbar"
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-zinc-800 transition-all"
          style={{ width: `${v}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-zinc-500">
        {v}%
      </span>
    </div>
  );
}
