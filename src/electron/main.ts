import { BrowserWindow } from "electron";
import { app } from "electron";
import * as path from "node:path";
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

  win.loadURL("http://localhost:4200");
});
