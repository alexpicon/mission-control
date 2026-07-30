import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Project, ProjectInput } from "./types";
import type { View } from "./nav";
import { listProjects, createProject, updateProject, getSetting, setSetting } from "./db";
import { Sidebar } from "./components/Sidebar";
import { ProjectForm } from "./components/ProjectForm";
import { Dashboard } from "./pages/Dashboard";
import { ProjectDetail } from "./pages/ProjectDetail";
import { Chat } from "./pages/Chat";
import { Audit } from "./pages/Audit";
import { Settings } from "./pages/Settings";
import { showWidget, hideWidget } from "./lib/widget";
import { ingestInbox } from "./cc/ingest";
import { computeMvpProgress, type MvpProgress } from "./mvp/diff";
import {
  loadSnapshots,
  pickNextMoveByProject,
  type NextMove,
} from "./mvp/nextMove";
import type { ShipResult } from "./types";
import { loadXpSummary } from "./xp/summary";
import { levelInfo, type LevelInfo } from "./xp/model";
import { CelebrationToasts, type Toast } from "./components/CelebrationToasts";

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<View>({ name: "dashboard" });
  const [loading, setLoading] = useState(true);

  // Project form (add/edit) modal state.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  // Leaderboard overlay: persisted on/off. When on, it shows whenever the main
  // window is NOT focused, and hides when you're in Mission Control.
  const [leaderboardOn, setLeaderboardOn] = useState(false);
  const leaderboardOnRef = useRef(false);
  const [mvpProgress, setMvpProgress] = useState<Record<number, MvpProgress>>({});
  const [movesByProject, setMovesByProject] = useState<Record<number, NextMove>>({});
  const [xpLevel, setXpLevel] = useState<LevelInfo>(levelInfo(0));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [barPulse, setBarPulse] = useState(0); // bump to replay the bar glow

  async function reload() {
    const p = await listProjects();
    setProjects(p);

    // One pass over the items feeds progress, the next-best-move pick, and the
    // AI's context — instead of querying each project's items several times.
    const snaps = await loadSnapshots(p);
    setMovesByProject(pickNextMoveByProject(snaps));

    const mvp: Record<number, MvpProgress> = {};
    for (const s of snaps) {
      if (s.project.progress_mode === "evidence") {
        mvp[s.project.id] = computeMvpProgress(s.items);
      }
    }
    setMvpProgress(mvp);
    setXpLevel((await loadXpSummary()).level);
  }

  // Called whenever something ships. Celebrates the noteworthy ones and
  // refreshes level/progress. Uses the XP delta as a stable toast id so we
  // never call Date.now()/Math.random() during render.
  function handleShipped(r: ShipResult) {
    const noteworthy = r.shipped || r.leveledUp || r.newAchievements.length > 0;
    if (noteworthy) {
      setToasts((prev) => [
        ...prev,
        { ...r, toastId: (prev[prev.length - 1]?.toastId ?? 0) + 1 },
      ]);
      // The level bar handles its own local shatter effect (see LevelBadge).
      setBarPulse((p) => p + 1);
    }
    reload();
  }

  function dismissToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.toastId !== id));
  }

  useEffect(() => {
    (async () => {
      await reload();
      setLoading(false);
    })();
  }, []);

  // Leaderboard overlay control: load the saved on/off, and auto-show/hide it
  // based on whether the main window is focused. Uses a ref so the focus
  // listener always sees the latest on/off without re-subscribing.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      const saved = (await getSetting("leaderboard_enabled")) === "1";
      leaderboardOnRef.current = saved;
      setLeaderboardOn(saved);
      // If it's on and we're not already focused, show it now.
      const win = getCurrentWindow();
      if (saved && !(await win.isFocused())) await showWidget();
      unlisten = await win.onFocusChanged(({ payload: focused }) => {
        if (focused) hideWidget();
        else if (leaderboardOnRef.current) showWidget();
      });
    })();
    return () => unlisten?.();
  }, []);

  async function toggleLeaderboard() {
    const next = !leaderboardOn;
    setLeaderboardOn(next);
    leaderboardOnRef.current = next;
    await setSetting("leaderboard_enabled", next ? "1" : "0");
    if (!next) {
      await hideWidget();
    } else if (!(await getCurrentWindow().isFocused())) {
      await showWidget();
    }
  }

  // Ingest Claude Code hook events while the app is open. Events written while
  // it was closed are picked up here too. Reload projects if anything landed
  // (a proposed update may have appeared / staleness may change on approval).
  useEffect(() => {
    let active = true;
    async function pump() {
      try {
        const n = await ingestInbox();
        if (active && n > 0) await reload();
      } catch (e) {
        // Surface ingest errors to the devtools console; never crash the app.
        console.error("Claude Code ingest failed:", e);
      }
    }
    pump();
    const id = setInterval(pump, 8000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(p: Project) {
    setEditing(p);
    setFormOpen(true);
  }

  async function handleSave(input: ProjectInput) {
    if (editing) {
      await updateProject(editing.id, input);
    } else {
      await createProject(input);
    }
    setFormOpen(false);
    setEditing(null);
    await reload();
  }

  const currentProject =
    view.name === "project"
      ? projects.find((p) => p.id === view.id) ?? null
      : null;

  // If the open project was deleted, fall back to the dashboard.
  useEffect(() => {
    if (view.name === "project" && !loading && !currentProject) {
      setView({ name: "dashboard" });
    }
  }, [view, currentProject, loading]);

  return (
    <div className="flex h-screen">
      <Sidebar
        current={view.name}
        navigate={setView}
        onNewProject={openNew}
        onToggleLeaderboard={toggleLeaderboard}
        leaderboardOn={leaderboardOn}
        level={xpLevel}
        pulseKey={barPulse}
      />

      <main className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <p className="text-sm text-zinc-400">Loading…</p>
        ) : view.name === "dashboard" ? (
          <Dashboard
            projects={projects}
            mvpProgress={mvpProgress}
            movesByProject={movesByProject}
            onOpen={(id) => setView({ name: "project", id })}
            onNewProject={openNew}
          />
        ) : view.name === "project" && currentProject ? (
          <ProjectDetail
            project={currentProject}
            onBack={() => setView({ name: "dashboard" })}
            onEdit={openEdit}
            onDeleted={async () => {
              setView({ name: "dashboard" });
              await reload();
            }}
            onChanged={reload}
            onShipped={handleShipped}
          />
        ) : view.name === "chat" ? (
          <Chat
            projects={projects}
            onGoToSettings={() => setView({ name: "settings" })}
          />
        ) : view.name === "audit" ? (
          <Audit
            projects={projects}
            onGoToSettings={() => setView({ name: "settings" })}
          />
        ) : view.name === "settings" ? (
          <Settings />
        ) : null}
      </main>

      {formOpen && (
        <ProjectForm
          project={editing ?? undefined}
          onSave={handleSave}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}

      <CelebrationToasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
