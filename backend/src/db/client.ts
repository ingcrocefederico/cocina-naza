import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

export const query = <T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[] }> => pool.query(text, params) as unknown as Promise<{ rows: T[] }>

export type QueryFn = typeof query

/**
 * Runs `fn` inside a single transaction on one pooled connection.
 * On any error the transaction is rolled back, so multi-statement mutations
 * (e.g. DELETE-then-INSERT) can never leave partially-applied state — a failed
 * INSERT will not survive a committed DELETE.
 */
export async function withTransaction<T>(fn: (q: QueryFn) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  const txQuery = ((text: string, params?: unknown[]) =>
    client.query(text, params)) as unknown as QueryFn
  try {
    await client.query('BEGIN')
    const result = await fn(txQuery)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
