import { describe, expect, it } from 'vitest'
import { cooldownSecondsRemaining } from './environment-cooldown'

describe('environment cooldown', () => {
  it('rounds partial seconds up and reaches zero at expiry', () => {
    expect(cooldownSecondsRemaining(5_000, 0)).toBe(5)
    expect(cooldownSecondsRemaining(5_000, 1)).toBe(5)
    expect(cooldownSecondsRemaining(5_000, 4_001)).toBe(1)
    expect(cooldownSecondsRemaining(5_000, 5_000)).toBe(0)
    expect(cooldownSecondsRemaining(5_000, 6_000)).toBe(0)
  })
})