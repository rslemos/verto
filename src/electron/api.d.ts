/**
 * Valores que atravessam o IPC (structured clone).
 * Instâncias de classe (Decimal, etc.) NÃO cabem: converta para string antes.
 */
export type DbValue =
  | string
  | number
  | boolean
  | bigint
  | null
  | Date
  | Uint8Array
  | readonly DbValue[];

export type DbRow = Record<string, unknown>;

/** Campos do erro do Postgres que o frontend precisa para decidir o que fazer. */
export interface DbErrorInfo {
  /** SQLSTATE (ex.: "23505" = violação de unicidade) ou "VERTO_*" para erros do próprio canal. */
  code?: string | undefined;
  message: string;
  detail?: string | undefined;
  constraint?: string | undefined;
  table?: string | undefined;
  column?: string | undefined;
}

/** Erros do banco NÃO rejeitam a Promise do IPC (perderiam os campos): voltam como { ok: false }. */
export type DbOutcome<T extends object> = ({ ok: true } & T) | { ok: false; error: DbErrorInfo };

export type TxId = string;

export type DbResult = DbOutcome<{ rows: DbRow[]; rowCount: number | null }>;
export type DbBeginResult = DbOutcome<{ tx: TxId }>;
export type DbEndResult = DbOutcome<object>;

export interface ElectronApi {
  "db:query"(sql: string, params: readonly DbValue[], tx: TxId | null): Promise<DbResult>;
  "db:begin"(): Promise<DbBeginResult>;
  "db:end"(tx: TxId, action: "commit" | "rollback"): Promise<DbEndResult>;
}
