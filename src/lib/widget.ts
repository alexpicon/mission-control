// Controls the always-on-top widget window (defined in tauri.conf.json, label "widget").

import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

async function widget(): Promise<WebviewWindow | null> {
  return WebviewWindow.getByLabel("widget");
}

export async function isWidgetVisible(): Promise<boolean> {
  const w = await widget();
  if (!w) return false;
  try {
    return await w.isVisible();
  } catch {
    return false;
  }
}

export async function showWidget(): Promise<void> {
  const w = await widget();
  if (!w) return;
  await w.show();
  await w.setFocus();
}

export async function hideWidget(): Promise<void> {
  const w = await widget();
  if (!w) return;
  await w.hide();
}

// Returns the new visibility state.
export async function toggleWidget(): Promise<boolean> {
  const visible = await isWidgetVisible();
  if (visible) {
    await hideWidget();
    return false;
  }
  await showWidget();
  return true;
}
