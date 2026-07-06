import { useEffect, useState } from "react";
import type { Project, ProjectInput } from "./types";
import type { View } from "./nav";
import { listProjects, createProject, updateProject } from "./db";
import { Sidebar } from "./components/Sidebar";
import { ProjectForm } from "./components/ProjectForm";
import { Dashboard } from "./pages/Dashboard";
import { ProjectDetail } from "./pages/ProjectDetail";
import { Chat } from "./pages/Chat";
import { Audit } from "./pages/Audit";
import { Settings } from "./pages/Settings";
import { isWidgetVisible, toggleWidget } from "./lib/widget";
import { ingestInbox } from "./cc/ingest";
import { loadMvpProgressMap } from "./mvp/sync";
import type { MvpProgress } from "./mvp/diff";

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<View>({ name: "dashboard" });
  const [loading, setLoading] = useState(true);

  // Project form (add/edit) modal state.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  const [widgetOn, setWidgetOn] = useState(false);
  const [mvpProgress, setMvpProgress] = useState<Record<number, MvpProgress>>({});

  async function reload() {
    const p = await listProjects();
    setProjects(p);
    setMvpProgress(await loadMvpProgressMap(p));
  }

  useEffect(() => {
    (async () => {
      await reload();
      setLoading(false);
      setWidgetOn(await isWidgetVisible());
    })();
  }, []);

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

  async function handleToggleWidget() {
    const on = await toggleWidget();
    setWidgetOn(on);
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
    <div className="flex h-screen bg-[#f6f6f7]">
      <Sidebar
        current={view.name}
        navigate={setView}
        onNewProject={openNew}
        onToggleWidget={handleToggleWidget}
        widgetOn={widgetOn}
      />

      <main className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <p className="text-sm text-zinc-400">Loading…</p>
        ) : view.name === "dashboard" ? (
          <Dashboard
            projects={projects}
            mvpProgress={mvpProgress}
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
    </div>
  );
}
