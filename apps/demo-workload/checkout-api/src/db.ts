import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "ERROR",
      message: "Unexpected error on idle PostgreSQL client",
      error: err.message,
    })
  );
});

export async function checkDbHealth(): Promise<boolean> {
  try {
    const res = await pool.query("SELECT 1 AS alive");
    return res.rows.length > 0 && res.rows[0].alive === 1;
  } catch (err) {
    return false;
  }
}

export async function executeInTransaction<T>(
  action: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
