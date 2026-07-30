// Controls the always-on-top leaderboard overlay window (label "widget",
// defined in tauri.conf.json). It floats above other apps and across all
// desktops, and does not steal focus when shown.

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
  try {
    await w.setVisibleOnAllWorkspaces(true); // show on every macOS Space
  } catch {
    // permission/platform may not support it — still show the window
  }
  await w.show(); // no setFocus: it appears without stealing focus from your active app
}

export async function hideWidget(): Promise<void> {
  const w = await widget();
  if (!w) return;
  await w.hide();
}
