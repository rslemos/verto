import type { ElectronApi } from "../../api";
import type { IpcHandler } from "../types";

export const helloHandler: IpcHandler<ElectronApi["hello"]> = async (_event, name) => {
  return "Hello, " + name;
};
