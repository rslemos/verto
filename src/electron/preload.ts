import { contextBridge } from "electron";
import { ipcRenderer } from "electron";
import type { ElectronApi } from "./api";

/**
 * O TypeScript valida nos 2 sentidos:
 * - Não compila se faltar qualquer método definido em ElectronApi.
 * - Não compila se contiver métodos adicionais não declarados em ElectronApi.
 */
const api: ElectronApi = {
  hello: (name: string) => ipcRenderer.invoke("hello", name),
};

contextBridge.exposeInMainWorld("api", api);
