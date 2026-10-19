import type { ElectronApi } from "../electron/api";

declare global {
  interface Window {
    api: ElectronApi;
  }
}
