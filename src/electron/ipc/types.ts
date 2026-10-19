import type { IpcMainInvokeEvent } from "electron";

export type IpcHandler<T> = T extends (...args: infer A) => Promise<infer R> | infer R
  ? (event: IpcMainInvokeEvent, ...args: A) => Promise<R> | R
  : never;

export type IpcHandlers<T> = {
  [K in keyof T]: IpcHandler<T[K]>;
};
