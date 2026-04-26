import { describe, it, expect, vi } from 'vitest'

vi.mock('./client', () => ({
  query: vi.fn().mockResolvedValue({ rows: [{ result: 1 }] }),
}))

import { query } from './client'

describe('db/client', () => {
  it('query resolves with rows', async () => {
    const result = await query('SELECT 1 AS result')
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toEqual({ result: 1 })
  })
})
