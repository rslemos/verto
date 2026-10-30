import { BrowserWindow } from "electron";
import { app } from "electron";
import * as path from "node:path";
import { postgres } from "./postgres";
import { registerIpcHandlers } from "./ipc";

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

  // Transação aberta pelo JS desta janela morre junto com ele (recarga, fechamento ou travamento).
  const owner = win.webContents.id;
  win.webContents.on("did-start-navigation", ({ isMainFrame, isSameDocument }) => {
    if (isMainFrame && !isSameDocument) postgres.releaseOwner(owner);
  });
  win.webContents.on("render-process-gone", () => postgres.releaseOwner(owner));
  win.on("closed", () => postgres.releaseOwner(owner));

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
