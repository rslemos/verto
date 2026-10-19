import { contextBridge } from "electron";
import { ipcRenderer } from "electron";
import type { ElectronApi } from "./api";

const api: ElectronApi = {
};

contextBridge.exposeInMainWorld("api", api);
