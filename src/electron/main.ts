import { BrowserWindow } from "electron";
import { app } from "electron";
import * as path from "node:path";
import { registerIpcHandlers } from "./ipc/register";

const isDev = !app.isPackaged;

let win: BrowserWindow | null;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.webContents.on("console-message", ({ level, message, lineNumber, sourceId }) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${lineNumber})`);
  });

  if (isDev) {
    win.loadURL("http://localhost:4200");
  } else {
    win.loadFile(path.join(__dirname, "../browser/index.html"));
  }
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
});
