import { contextBridge } from "electron";
import { ipcRenderer } from "electron";
import type { ElectronApi } from "./api";

const api: ElectronApi = {
  "db:query": (sql, params, tx) => ipcRenderer.invoke("db:query", sql, params, tx),
  "db:begin": () => ipcRenderer.invoke("db:begin"),
  "db:end": (tx, action) => ipcRenderer.invoke("db:end", tx, action),
};

contextBridge.exposeInMainWorld("api", api);
