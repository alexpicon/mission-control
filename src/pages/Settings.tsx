import { useEffect, useState } from "react";
import { getApiKey, setApiKey, MODEL } from "../ai/provider";
import { setSetting } from "../db";

export function Settings({ onKeyChange }: { onKeyChange?: () => void }) {
  const [hasKey, setHasKey] = useState(false);
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);

  async function refresh() {
    setHasKey((await getApiKey()) !== null);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function save() {
    if (!value.trim()) return;
    await setApiKey(value.trim());
    setValue("");
    setSaved(true);
    await refresh();
    onKeyChange?.();
    setTimeout(() => setSaved(false), 2000);
  }

  async function clear() {
    await setSetting("anthropic_api_key", "");
    await refresh();
    onKeyChange?.();
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-zinc-900">Settings</h1>
        <p className="text-sm text-zinc-500">Local only. Nothing is uploaded.</p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-zinc-900">Anthropic API key</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Used for Chat and Audit. Stored locally in your SQLite database, never
          committed. Status:{" "}
          <span
            className={hasKey ? "font-medium text-emerald-600" : "font-medium text-zinc-500"}
          >
            {hasKey ? "set" : "not set"}
          </span>
          .
        </p>

        <div className="mt-3 flex gap-2">
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="sk-ant-…"
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
          />
          <button
            onClick={save}
            disabled={!value.trim()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
          >
            Save
          </button>
        </div>

        <div className="mt-2 flex items-center gap-3 text-xs text-zinc-400">
          {saved && <span className="text-emerald-600">Saved.</span>}
          {hasKey && (
            <button onClick={clear} className="underline hover:text-zinc-600">
              Clear key
            </button>
          )}
        </div>

        <p className="mt-4 text-xs text-zinc-400">
          Model: <code className="rounded bg-zinc-100 px-1">{MODEL}</code>. You
          can also set <code className="rounded bg-zinc-100 px-1">VITE_ANTHROPIC_API_KEY</code>{" "}
          in a local <code className="rounded bg-zinc-100 px-1">.env</code> file
          as a dev fallback (see <code>.env.example</code>).
        </p>
      </section>
    </div>
  );
}
