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

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<View>({ name: "dashboard" });
  const [loading, setLoading] = useState(true);

  // Project form (add/edit) modal state.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  const [widgetOn, setWidgetOn] = useState(false);

  async function reload() {
    setProjects(await listProjects());
  }

  useEffect(() => {
    (async () => {
      await reload();
      setLoading(false);
      setWidgetOn(await isWidgetVisible());
    })();
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
