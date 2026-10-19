import type { ElectronApi } from "../../api";
import type { IpcHandler } from "../types";
import { Client } from "pg";

export const helloHandler: IpcHandler<ElectronApi["hello"]> = async (_event, name) => {
  const client = new Client({ database: "verto", host: "/var/run/postgresql" });
  await client.connect();
  const result = await client.query< { message: string }>("SELECT 'Hello, ' || $1::text || ' (' || COUNT(*) || ' ativos)' AS message FROM ativo", [ name ]);
  return result?.rows?.[0]?.message ?? "Ocorreu um erro";
};
