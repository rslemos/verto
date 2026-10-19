import type { ElectronApi } from "../../api";
import type { IpcHandlers } from "../types";
import { helloHandler } from "./hello";

export const handlers: IpcHandlers<ElectronApi> = {
  hello: helloHandler,
};
