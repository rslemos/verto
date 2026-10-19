import { ipcMain } from "electron";
import { handlers } from "./handlers";

export function registerIpcHandlers(): void {
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, handler);
  }
}
