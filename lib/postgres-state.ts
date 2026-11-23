import { Pool } from "pg";
import type { StoreData } from "@/lib/types";

declare global {
  var blackHolePool: Pool | undefined;
}

function pool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  global.blackHolePool ||= new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: 8,
  });
  return global.blackHolePool;
}

let initialized: Promise<void> | null = null;

async function initialize() {
  if (initialized) return initialized;
  initialized = (async () => {
    const client = await pool().connect();
    try {
      await client.query("CREATE EXTENSION IF NOT EXISTS vector");
      await client.query(`
        CREATE TABLE IF NOT EXISTS blackhole_state (
          id integer PRIMARY KEY CHECK (id = 1),
          payload jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS memory_vectors (
          memory_id text PRIMARY KEY,
          owner_id text NOT NULL DEFAULT 'owner',
          title text NOT NULL,
          content text NOT NULL,
          category text NOT NULL,
          embedding vector,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await client.query("CREATE INDEX IF NOT EXISTS memory_vectors_owner_idx ON memory_vectors(owner_id)");
    } finally {
      client.release();
    }
  })();
  return initialized;
}

export async function readPostgresStore(fallback: StoreData) {
  await initialize();
  const result = await pool().query<{ payload: StoreData }>("SELECT payload FROM blackhole_state WHERE id = 1");
  if (result.rows[0]) return result.rows[0].payload;
  await writePostgresStore(fallback);
  return fallback;
}

export async function writePostgresStore(data: StoreData) {
  await initialize();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO blackhole_state (id, payload, updated_at) VALUES (1, $1::jsonb, now()) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()",
      [JSON.stringify(data)],
    );
    await client.query("DELETE FROM memory_vectors WHERE owner_id = 'owner'");
    for (const memory of data.memories) {
      const vector = memory.embedding?.length ? `[${memory.embedding.join(",")}]` : null;
      await client.query(
        "INSERT INTO memory_vectors (memory_id, title, content, category, embedding) VALUES ($1, $2, $3, $4, $5::vector)",
        [memory.id, memory.title, memory.content, memory.category, vector],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

