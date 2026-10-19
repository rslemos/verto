import { ipcMain } from "electron";
import { IpcMainInvokeEvent } from "electron";
import { ElectronApi } from "./api";


type IpcHandler<T> = T extends (...args: infer A) => Promise<infer R> | infer R
  ? (event: IpcMainInvokeEvent, ...args: A) => Promise<R> | R
  : never;

type IpcHandlers<T> = {
  [K in keyof T]: IpcHandler<T[K]>;
};

const handlers: IpcHandlers<ElectronApi> = {
};

export function registerIpcHandlers(): void {
  Object.entries(handlers).forEach(([channel, handler]) => ipcMain.handle(channel, handler))
}
