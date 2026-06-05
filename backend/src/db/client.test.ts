import { describe, it, expect, vi, beforeEach } from 'vitest'

const { clientQuery, release, connect, poolQuery } = vi.hoisted(() => {
  const clientQuery = vi.fn().mockResolvedValue({ rows: [] })
  const release = vi.fn()
  const connect = vi.fn().mockResolvedValue({ query: clientQuery, release })
  const poolQuery = vi.fn().mockResolvedValue({ rows: [{ result: 1 }] })
  return { clientQuery, release, connect, poolQuery }
})

vi.mock('pg', () => ({
  Pool: class {
    query(...args: unknown[]) { return poolQuery(...args) }
    connect() { return connect() }
  },
}))

import { query, withTransaction } from './client'

describe('db/client', () => {
  beforeEach(() => {
    clientQuery.mockClear()
    release.mockClear()
  })

  it('query resolves with rows', async () => {
    const result = await query('SELECT 1 AS result')
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toEqual({ result: 1 })
  })

  it('withTransaction wraps work in BEGIN/COMMIT and releases the client', async () => {
    await withTransaction(async (q) => {
      await q('DELETE FROM recipe_items WHERE flavor_id = $1', ['f-1'])
    })
    const statements = clientQuery.mock.calls.map(c => String(c[0]))
    expect(statements[0]).toBe('BEGIN')
    expect(statements).toContain('DELETE FROM recipe_items WHERE flavor_id = $1')
    expect(statements[statements.length - 1]).toBe('COMMIT')
    expect(release).toHaveBeenCalledOnce()
  })

  it('withTransaction ROLLs BACK and rethrows when the callback fails — no partial commit', async () => {
    await expect(
      withTransaction(async (q) => {
        await q('DELETE FROM recipe_items WHERE flavor_id = $1', ['f-1'])
        throw new Error('unique violation')
      })
    ).rejects.toThrow('unique violation')
    const statements = clientQuery.mock.calls.map(c => String(c[0]))
    expect(statements[0]).toBe('BEGIN')
    expect(statements).toContain('ROLLBACK')
    expect(statements).not.toContain('COMMIT')
    expect(release).toHaveBeenCalledOnce()
  })
})
