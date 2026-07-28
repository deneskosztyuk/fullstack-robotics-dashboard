import { describe, expect, it } from 'vitest'
import { ClaimRegistry } from './claims'
import { DEFAULT_CONFIG } from './config'

describe('ClaimRegistry', () => {
  it('allows an owner to reclaim a shelf but rejects a competing robot', () => {
    const claims = new ClaimRegistry()
    expect(claims.claimShelf('A', 1)).toBe(true)
    expect(claims.claimShelf('A', 1)).toBe(true)
    expect(claims.claimShelf('A', 2)).toBe(false)
    expect(claims.shelfOwner('A')).toBe(1)
  })

  it('applies the same exclusivity to docks', () => {
    const claims = new ClaimRegistry()
    expect(claims.claimDock(1, 1)).toBe(true)
    expect(claims.claimDock(1, 2)).toBe(false)
    expect(claims.dockOwner(1)).toBe(1)
  })

  it('only lets the owner release a claim', () => {
    const claims = new ClaimRegistry()
    claims.claimShelf('A', 1)
    expect(claims.releaseShelf('A', 2)).toBe(false)
    expect(claims.releaseShelf('A', 1)).toBe(true)
    expect(claims.shelfOwner('A')).toBeUndefined()
  })

  it('releases all resources owned by a removed robot', () => {
    const claims = new ClaimRegistry()
    claims.claimShelf('A', 1)
    claims.claimDock(1, 1)
    claims.claimShelf('B', 2)
    claims.releaseRobot(1)
    expect(claims.shelfOwner('A')).toBeUndefined()
    expect(claims.dockOwner(1)).toBeUndefined()
    expect(claims.shelfOwner('B')).toBe(2)
  })

  it('lists free resources in configuration order', () => {
    const claims = new ClaimRegistry()
    claims.claimShelf(DEFAULT_CONFIG.shelves[1].id, 1)
    claims.claimDock(DEFAULT_CONFIG.docks[1].id, 1)
    expect(claims.availableShelves(DEFAULT_CONFIG.shelves).map((shelf) => shelf.id)).toEqual(
      DEFAULT_CONFIG.shelves.filter((_, index) => index !== 1).map((shelf) => shelf.id)
    )
    expect(claims.availableDocks(DEFAULT_CONFIG.docks).map((dock) => dock.id)).toEqual([1, 3, 4])
  })
})