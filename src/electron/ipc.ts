import { ipcMain } from "electron";
import { IpcMainInvokeEvent } from "electron";
import { postgres } from "./postgres";
import { ElectronApi } from "./api";


type IpcHandler<T> = T extends (...args: infer A) => Promise<infer R> | infer R
  ? (event: IpcMainInvokeEvent, ...args: A) => Promise<R> | R
  : never;

type IpcHandlers<T> = {
  [K in keyof T]: IpcHandler<T[K]>;
};

const handlers: IpcHandlers<ElectronApi> = {
  "db:query": (event, sql, params, tx) => postgres.query(event.sender.id, sql, params, tx),
  "db:begin": (event) => postgres.begin(event.sender.id),
  "db:end": (event, tx, action) => postgres.end(event.sender.id, tx, action),
};

export function registerIpcHandlers(): void {
  Object.entries(handlers).forEach(([channel, handler]) => ipcMain.handle(channel, handler))
}
