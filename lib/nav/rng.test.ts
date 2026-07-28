import { describe, expect, it } from 'vitest'
import { Rng } from './rng'

describe('Rng', () => {
  it('produces the same sequence for the same seed', () => {
    const first = new Rng(12345)
    const second = new Rng(12345)
    expect(Array.from({ length: 8 }, () => first.next())).toEqual(
      Array.from({ length: 8 }, () => second.next())
    )
  })

  it('keeps ranged values inside the requested half-open interval', () => {
    const rng = new Rng(7)
    for (let index = 0; index < 50; index++) {
      const value = rng.range(10, 20)
      expect(value).toBeGreaterThanOrEqual(10)
      expect(value).toBeLessThan(20)
    }
  })

  it('returns undefined when selecting from an empty collection', () => {
    expect(new Rng(1).pick([])).toBeUndefined()
  })
})