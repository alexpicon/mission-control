import { useState } from "react";
import type { Project } from "../types";
import { complete, MissingApiKeyError, type ChatMessage } from "../ai/provider";
import { chatSystem } from "../ai/prompts";
import { portfolioContext } from "../ai/context";

export function Chat({
  projects,
  onGoToSettings,
}: {
  projects: Project[];
  onGoToSettings: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [needKey, setNeedKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const reply = await complete({
        system: chatSystem(portfolioContext(projects)),
        messages: next,
        maxTokens: 700,
      });
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (err) {
      if (err instanceof MissingApiKeyError) {
        setNeedKey(true);
        setMessages(messages); // roll back the un-answered user turn
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      <header className="pb-4">
        <h1 className="text-xl font-semibold text-zinc-900">Chat</h1>
        <p className="text-sm text-zinc-500">
          Ask about your projects. Answers use your local project data only.
        </p>
      </header>

      {needKey && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-medium">No API key set.</p>
          <p className="mt-1">
            Chat needs your Anthropic API key. The rest of the app works without
            it.
          </p>
          <button
            onClick={onGoToSettings}
            className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
          >
            Add API key in Settings
          </button>
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto pb-4">
        {messages.length === 0 && !needKey && (
          <div className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-400">
            Try: "What's blocked?" · "Which project is stale?" · "What should I
            do next?"
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-200 bg-white text-zinc-800"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-400">
              Thinking…
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-zinc-200 pt-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your projects…"
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
