import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Widget } from "./windows/Widget";
import "./styles.css";

// Both the main window and the widget window load this same bundle.
// The widget window is opened with ?window=widget (see tauri.conf.json).
const isWidget =
  new URLSearchParams(window.location.search).get("window") === "widget";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{isWidget ? <Widget /> : <App />}</React.StrictMode>
);
