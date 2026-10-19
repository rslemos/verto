import { BrowserWindow } from "electron";
import { app } from "electron";
import * as path from "node:path";
import { postgres } from "./postgres";
import { registerIpcHandlers } from "./ipc";


app.whenReady().then(() => {
  registerIpcHandlers();

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.webContents.on("console-message", ({ level, message, lineNumber, sourceId }) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${lineNumber})`);
  });

  const owner = win.webContents.id;
  win.webContents.on("did-start-navigation", ({ isMainFrame, isSameDocument }) => {
    if (isMainFrame && !isSameDocument) postgres.releaseOwner(owner);
  });
  win.webContents.on("render-process-gone", () => postgres.releaseOwner(owner));
  win.on("closed", () => postgres.releaseOwner(owner));

  win.loadURL("http://localhost:4200");
});
