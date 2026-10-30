import { randomUUID } from "node:crypto";
import { DatabaseError } from "pg";
import { Pool } from "pg";
import { types } from "pg";
import type { PoolClient } from "pg";
import type { PoolConfig } from "pg";
import type { DbBeginResult } from "./api";
import type { DbEndResult } from "./api";
import type { DbErrorInfo } from "./api";
import type { DbResult } from "./api";
import type { DbValue } from "./api";
import type { TxId } from "./api";

// DATE vira string "YYYY-MM-DD". O padrão do pg cria um Date no fuso local (dia errado, fácil de passar batido).
// NUMERIC e INT8 já chegam como string, o que é o desejado.
types.setTypeParser(types.builtins.DATE, (value) => value);

export interface DbOptions extends PoolConfig {
  /** Uma transação sem nenhuma chamada por este tempo é desfeita (rede de segurança contra transação esquecida). */
  idleTxMs?: number;
}

interface OpenTx {
  client: PoolClient;
  /** Quem abriu (webContents.id). Só o dono pode usar, e se o dono morre a transação é desfeita. */
  owner: number;
  timer: NodeJS.Timeout;
  /** Fim da fila de comandos desta transação. O pg 9 vai remover a fila interna da conexão, então serializamos aqui. */
  tail: Promise<unknown>;
}

function toErrorInfo(e: unknown): DbErrorInfo {
  if (e instanceof DatabaseError) {
    return {
      code: e.code,
      message: e.message,
      detail: e.detail,
      constraint: e.constraint,
      table: e.table,
      column: e.column,
    };
  }
  return {message: e instanceof Error ? e.message : String(e)};
}

function fail(code: string, message: string): {ok: false; error: DbErrorInfo} {
  return {ok: false, error: {code, message}};
}

export function createDb(options: DbOptions = {}) {
  const { idleTxMs = 30_000, ...poolConfig } = options;
  const pool = new Pool({
    max: 5,
    // begin() falha rápido se o pool estiver esgotado, em vez de ficar pendurado
    connectionTimeoutMillis: 5_000,
    // rede de segurança do lado do banco, independente do app
    idle_in_transaction_session_timeout: 60_000,
    ...poolConfig,
  });
  // sem isto, um erro numa conexão ociosa derruba o processo principal
  pool.on("error", (e) => console.error("[postgres] erro numa conexão ociosa do pool:", e.message));

  const txs = new Map<TxId, OpenTx>();

  function arm(id: TxId): NodeJS.Timeout {
    return setTimeout(() => abandon(id), idleTxMs).unref();
  }

  /** Descarta a conexão (o servidor desfaz a transação ao ver a conexão cair). */
  function abandon(id: TxId): void {
    const tx = txs.get(id);
    if (!tx) return;
    txs.delete(id);
    clearTimeout(tx.timer);
    tx.client.release(true);
  }

  /**
   * Enfileira um comando na transação. O encadeamento é feito de forma síncrona (antes de qualquer await), então a
   * ordem de chegada das mensagens do IPC vira a ordem de execução, mesmo que o frontend dispare várias sem esperar.
   */
  function enqueue<T>(tx: OpenTx, command: () => Promise<T>): Promise<T> {
    const run = tx.tail.then(command);
    tx.tail = run.catch(() => undefined);
    return run;
  }

  async function query(owner: number, sql: string, params: readonly DbValue[], id: TxId | null): Promise<DbResult> {
    try {
      let result;
      if (id === null) {
        result = await pool.query(sql, [...params]);
      } else {
        const tx = txs.get(id);
        if (!tx || tx.owner !== owner) return fail("VERTO_TX", `Transação desconhecida ou encerrada: ${id}`);
        clearTimeout(tx.timer);
        tx.timer = arm(id);
        result = await enqueue(tx, () => tx.client.query(sql, [...params]));
      }
      return {ok: true, rows: result.rows, rowCount: result.rowCount};
    } catch (e) {
      return {ok: false, error: toErrorInfo(e)};
    }
  }

  async function begin(owner: number): Promise<DbBeginResult> {
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      const id: TxId = randomUUID();
      txs.set(id, {client, owner, timer: arm(id), tail: Promise.resolve()});
      return {ok: true, tx: id};
    } catch (e) {
      client?.release(true);
      return {ok: false, error: toErrorInfo(e)};
    }
  }

  async function end(owner: number, id: TxId, action: "commit" | "rollback"): Promise<DbEndResult> {
    const tx = txs.get(id);
    if (!tx || tx.owner !== owner) return fail("VERTO_TX", `Transação desconhecida ou encerrada: ${id}`);
    txs.delete(id);
    clearTimeout(tx.timer);
    try {
      const result = await enqueue(tx, () => tx.client.query(action === "commit" ? "COMMIT" : "ROLLBACK"));
      tx.client.release();
      // COMMIT de transação já abortada NÃO dá erro no Postgres: ele faz ROLLBACK em silêncio.
      if (action === "commit" && result.command === "ROLLBACK") {
        return fail("VERTO_TX_ABORTED", "A transação já estava abortada; o COMMIT virou ROLLBACK");
      }
      return {ok: true};
    } catch (e) {
      tx.client.release(true);
      return {ok: false, error: toErrorInfo(e)};
    }
  }

  /** Desfaz tudo o que um dono deixou aberto (janela recarregada, fechada ou travada). */
  function releaseOwner(owner: number): void {
    for (const [id, tx] of [...txs]) {
      if (tx.owner === owner) abandon(id);
    }
  }

  async function close(): Promise<void> {
    for (const id of [...txs.keys()]) abandon(id);
    await pool.end();
  }

  return {query, begin, end, releaseOwner, close, openTransactions: () => txs.size};
}

export const postgres = createDb({
  host: process.env["PGHOST"] ?? "/var/run/postgresql",
  database: process.env["VERTO_DB"] ?? "verto",
});
