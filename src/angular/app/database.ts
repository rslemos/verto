import { Injectable } from "@angular/core";
import type { DbErrorInfo, DbRow, DbValue, TxId } from "../../electron/api";

/** O IPC devolve erros do banco como dados; aqui eles viram exceção, com os campos do Postgres preservados. */
export class DbError extends Error {
  readonly code: string | undefined;
  readonly constraint: string | undefined;
  readonly detail: string | undefined;

  constructor(info: DbErrorInfo) {
    super(info.message);
    this.name = "DbError";
    this.code = info.code;
    this.constraint = info.constraint;
    this.detail = info.detail;
  }

  /** 23505 = unique_violation */
  get isUniqueViolation(): boolean {
    return this.code === "23505";
  }
}

export interface Queryable {
  /** SELECT, ou qualquer comando com RETURNING. */
  query(sql: string, params?: readonly DbValue[]): Promise<DbRow[]>;
  /** INSERT/UPDATE/DELETE: devolve quantas linhas foram afetadas. */
  execute(sql: string, params?: readonly DbValue[]): Promise<number>;
}

async function run(sql: string, params: readonly DbValue[], tx: TxId | null) {
  const result = await window.api["db:query"](sql, params, tx);
  if (!result.ok) throw new DbError(result.error);
  return result;
}

class Scope implements Queryable {
  constructor(private readonly tx: TxId | null) {}

  async query(sql: string, params: readonly DbValue[] = []): Promise<DbRow[]> {
    return (await run(sql, params, this.tx)).rows;
  }

  async execute(sql: string, params: readonly DbValue[] = []): Promise<number> {
    return (await run(sql, params, this.tx)).rowCount ?? 0;
  }
}

@Injectable({ providedIn: "root" })
export class Database extends Scope {
  constructor() {
    super(null);
  }

  /**
   * Executa `work` numa transação: COMMIT se terminar, ROLLBACK se lançar.
   * Dentro de `work` use SEMPRE o `tx` recebido; usar `this` abriria outra conexão, fora da transação.
   */
  async transaction<T>(work: (tx: Queryable) => Promise<T>): Promise<T> {
    const begun = await window.api["db:begin"]();
    if (!begun.ok) throw new DbError(begun.error);

    let value: T;
    try {
      value = await work(new Scope(begun.tx));
    } catch (e) {
      await window.api["db:end"](begun.tx, "rollback"); // o erro original é o que importa; falha de rollback é ignorada
      throw e;
    }

    const ended = await window.api["db:end"](begun.tx, "commit");
    if (!ended.ok) throw new DbError(ended.error);
    return value;
  }
}
