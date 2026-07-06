// Lightweight in-app navigation. No router library — the app is small enough
// that a single view union in App state is simpler and lighter.

export type View =
  | { name: "dashboard" }
  | { name: "project"; id: number }
  | { name: "chat" }
  | { name: "audit" }
  | { name: "settings" };

export type Nav = (view: View) => void;
