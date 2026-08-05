import type { View, Nav } from "../nav";
import type { LevelInfo } from "../xp/model";
import { LevelBadge } from "./LevelBadge";
import {
  IconDashboard,
  IconChat,
  IconAudit,
  IconSettings,
  IconPlus,
  IconLayers,
} from "./icons";

const NAV: {
  label: string;
  view: View;
  Icon: (p: { className?: string }) => React.ReactElement;
}[] = [
  { label: "Dashboard", view: { name: "dashboard" }, Icon: IconDashboard },
  { label: "Chat", view: { name: "chat" }, Icon: IconChat },
  { label: "Audit", view: { name: "audit" }, Icon: IconAudit },
  { label: "Settings", view: { name: "settings" }, Icon: IconSettings },
];

// Dark rail against the light workspace. The contrast is what makes the app
// read as designed rather than as a default light-on-light layout, and it
// gives the level bar — the one number that should always be visible — a
// surface where it actually stands out.
export function Sidebar({
  current,
  navigate,
  onNewProject,
  onToggleLeaderboard,
  leaderboardOn,
  level,
  pulseKey,
}: {
  current: View["name"];
  navigate: Nav;
  onNewProject: () => void;
  onToggleLeaderboard: () => void;
  leaderboardOn: boolean;
  level: LevelInfo;
  pulseKey: number;
}) {
  return (
    <aside className="relative z-30 flex w-60 shrink-0 flex-col overflow-visible bg-zinc-900 px-3 py-4 text-zinc-300">
      <div className="flex items-center gap-2.5 px-1.5 pb-5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-base shadow-lg shadow-emerald-500/20">
          🚀
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold tracking-tight text-white">
            Mission Control
          </div>
          <div className="text-[11px] text-zinc-500">Ship more. Guess less.</div>
        </div>
      </div>

      <button
        onClick={onNewProject}
        className="mb-4 flex items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-100 active:scale-[0.98]"
      >
        <IconPlus />
        New project
      </button>

      <nav className="flex flex-col gap-1">
        {NAV.map(({ label, view, Icon }) => {
          const active = current === view.name;
          return (
            <button
              key={label}
              onClick={() => navigate(view)}
              className={`group flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                active
                  ? "bg-white/10 text-white shadow-sm ring-1 ring-inset ring-white/10"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
              }`}
            >
              <Icon
                className={active ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-300"}
              />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-2 pt-4">
        <LevelBadge level={level} pulseKey={pulseKey} />

        <button
          onClick={onToggleLeaderboard}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100"
          title="Always-on-top overlay. Appears when you leave Mission Control."
        >
          <IconLayers className={leaderboardOn ? "text-emerald-400" : "text-zinc-500"} />
          <span className="flex-1 text-left">Overlay</span>
          <span
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              leaderboardOn
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-white/5 text-zinc-500"
            }`}
          >
            {leaderboardOn ? "On" : "Off"}
          </span>
        </button>
      </div>
    </aside>
  );
}
