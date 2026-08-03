import { describe, expect, it } from 'vitest'
import { createWarehouseConfig } from './config'
import { NavigationEngine } from './engine'
import type { EngineSnapshot } from './types'

function advanceTicks(engine: NavigationEngine, count: number): void {
  const tickMs = engine.getConfig().tickMs
  for (let index = 0; index < count; index++) engine.advance(tickMs)
}

function cellKey(cell: { x: number; z: number }): string {
  return `${cell.x},${cell.z}`
}

function assertConflictFree(previous: EngineSnapshot, current: EngineSnapshot): void {
  const occupied = current.robots.map((robot) => cellKey(robot.cell))
  expect(new Set(occupied).size).toBe(occupied.length)

  const previousById = new Map(previous.robots.map((robot) => [robot.id, robot]))
  for (let firstIndex = 0; firstIndex < current.robots.length; firstIndex++) {
    for (let secondIndex = firstIndex + 1; secondIndex < current.robots.length; secondIndex++) {
      const first = current.robots[firstIndex]
      const second = current.robots[secondIndex]
      const previousFirst = previousById.get(first.id)
      const previousSecond = previousById.get(second.id)
      if (!previousFirst || !previousSecond) continue

      const swapped =
        cellKey(previousFirst.cell) === cellKey(second.cell) &&
        cellKey(previousSecond.cell) === cellKey(first.cell)
      expect(swapped).toBe(false)
    }
  }
}

function assertUniqueClaims(snapshot: EngineSnapshot): void {
  const shelfClaims = snapshot.robots.flatMap((robot) => robot.shelfId === undefined ? [] : [robot.shelfId])
  const dockClaims = snapshot.robots.flatMap((robot) => robot.dockId === undefined ? [] : [robot.dockId])
  expect(new Set(shelfClaims).size).toBe(shelfClaims.length)
  expect(new Set(dockClaims).size).toBe(dockClaims.length)
}

describe('NavigationEngine timing and controls', () => {
  it('advances in whole fixed ticks, respects pause and speed, and caps catch-up', () => {
    const config = createWarehouseConfig('open', 1)
    config.maxCatchUpSteps = 3
    const engine = new NavigationEngine(config)

    engine.advance(config.tickMs - 1)
    expect(engine.getSnapshot().tick).toBe(0)
    expect(engine.getRenderSnapshot().progress).toBeCloseTo((config.tickMs - 1) / config.tickMs)

    engine.advance(1)
    expect(engine.getSnapshot().tick).toBe(1)

    engine.setPaused(true)
    engine.advance(config.tickMs * 20)
    expect(engine.getSnapshot().tick).toBe(1)
    engine.setPaused(false)

    engine.setSpeed(2)
    engine.advance(config.tickMs / 2)
    expect(engine.getSnapshot().tick).toBe(2)

    engine.advance(config.tickMs * 100)
    expect(engine.getSnapshot().tick).toBe(5)
    expect(engine.getRenderSnapshot().progress).toBe(0)
  })

  it('resets deterministically while preserving speed and increasing generation', () => {
    const engine = new NavigationEngine(createWarehouseConfig('open', 4))
    engine.setSpeed(2)
    const initial = engine.getSnapshot()
    advanceTicks(engine, 20)
    engine.reset()
    const reset = engine.getSnapshot()

    expect(reset.generation).toBe(initial.generation + 1)
    expect({ ...reset, generation: initial.generation }).toEqual(initial)
    expect(engine.getEvents()).toEqual([])
  })

  it('atomically changes layouts while retaining speed and desired fleet size', () => {
    const engine = new NavigationEngine()
    engine.setSpeed(2)
    engine.setRobotCount(12)
    advanceTicks(engine, 5)
    engine.setLayout('dense')
    const snapshot = engine.getSnapshot()

    expect(snapshot.layoutId).toBe('dense')
    expect(snapshot.speed).toBe(2)
    expect(snapshot.tick).toBe(0)
    expect(snapshot.robots).toHaveLength(12)
    expect(snapshot.completedOrders).toBe(0)
  })

  it('adds parked robots immediately and retires moving robots at their next destination', () => {
    const engine = new NavigationEngine(createWarehouseConfig('open', 2))
    engine.setRobotCount(5)
    expect(engine.getSnapshot().robots).toHaveLength(5)

    advanceTicks(engine, 2)
    engine.setRobotCount(1)
    const pending = engine.getSnapshot()
    expect(pending.desiredRobotCount).toBe(1)
    expect(pending.robots.some((robot) => robot.retireWhenParked)).toBe(true)

    advanceTicks(engine, 100)
    expect(engine.getSnapshot().robots).toHaveLength(1)
  })

  it('rejects robot counts outside configured capacity', () => {
    const engine = new NavigationEngine()
    expect(() => engine.setRobotCount(0)).toThrow(RangeError)
    expect(() => engine.setRobotCount(13)).toThrow(RangeError)
  })
})

describe('NavigationEngine tasks and safety', () => {
  it('completes deterministic shelf-to-dock task cycles from zero metrics', () => {
    const engine = new NavigationEngine(createWarehouseConfig('open', 1))
    const initial = engine.getSnapshot()
    expect(initial.completedOrders).toBe(0)
    expect(initial.cycleSampleCount).toBe(0)
    expect(initial.robots[0]).toEqual(expect.objectContaining({
      waitingSinceTick: 0,
    }))

    advanceTicks(engine, 200)
    const snapshot = engine.getSnapshot()
    expect(snapshot.completedOrders).toBeGreaterThan(0)
    expect(snapshot.deliveriesLast60Seconds).toBeGreaterThan(0)
    expect(snapshot.avgCycleSeconds).toBeGreaterThan(0)
    expect(snapshot.cycleSampleCount).toBeGreaterThan(0)
    expect(snapshot.cycleSampleCount).toBeLessThanOrEqual(engine.getConfig().maxCycleSamples)
  })

  it('sends a low-battery robot without cargo to charge', () => {
    const config = createWarehouseConfig('open', 1)
    config.battery.initialMin = 9
    config.battery.initialMax = 9
    config.battery.lowThreshold = 10
    config.battery.fullThreshold = 20
    const engine = new NavigationEngine(config)

    advanceTicks(engine, 1)
    expect(engine.getSnapshot().robots[0]).toMatchObject({
      needsCharge: true,
      kind: 'to_charge',
    })
    let observedChargingWithoutCargo = false
    for (let index = 0; index < 30; index++) {
      advanceTicks(engine, 1)
      const robot = engine.getSnapshot().robots[0]
      if (robot.kind === 'charging' && !robot.hasCargo) {
        observedChargingWithoutCargo = true
        break
      }
    }
    expect(observedChargingWithoutCargo).toBe(true)
  })

  it('delivers existing cargo before charging', () => {
    const config = createWarehouseConfig('open', 1)
    config.shelves = [config.shelves[0]]
    config.docks = [config.docks[0]]
    config.spawnCells = [{ x: 2, z: 2 }]
    config.battery.initialMin = 56.5
    config.battery.initialMax = 56.5
    config.battery.lowThreshold = 50
    config.battery.fullThreshold = 90
    config.battery.drainPerSecond = 1 / (config.tickMs / 1000)
    const engine = new NavigationEngine(config)

    let observedCargoPreemption = false
    for (let index = 0; index < 100; index++) {
      advanceTicks(engine, 1)
      const robot = engine.getSnapshot().robots[0]
      if (robot.hasCargo && robot.needsCharge && robot.kind === 'to_dock') {
        observedCargoPreemption = true
        break
      }
    }
    expect(observedCargoPreemption).toBe(true)

    for (let index = 0; index < 100 && engine.getSnapshot().completedOrders === 0; index++) {
      advanceTicks(engine, 1)
    }
    const snapshot = engine.getSnapshot()
    expect(snapshot.completedOrders).toBe(1)
    expect(snapshot.robots[0].kind).toBe('charging')
  })

  it('handles four robots contending for two docks without duplicate claims', () => {
    const config = createWarehouseConfig('open', 4)
    config.docks = config.docks.slice(0, 2)
    const engine = new NavigationEngine(config)
    let previous = engine.getSnapshot()

    for (let tick = 0; tick < 300; tick++) {
      advanceTicks(engine, 1)
      const current = engine.getSnapshot()
      assertConflictFree(previous, current)
      assertUniqueClaims(current)
      previous = current
    }
    expect(engine.getSnapshot().completedOrders).toBeGreaterThan(0)
  })

  it('runs twelve robots for 500 ticks without cell, edge, or claim conflicts', () => {
    const engine = new NavigationEngine(createWarehouseConfig('open', 12))
    let previous = engine.getSnapshot()

    for (let tick = 0; tick < 500; tick++) {
      advanceTicks(engine, 1)
      const current = engine.getSnapshot()
      assertConflictFree(previous, current)
      assertUniqueClaims(current)
      for (const robot of current.robots) {
        expect(Number.isFinite(robot.battery)).toBe(true)
        expect(robot.battery).toBeGreaterThanOrEqual(0)
        expect(robot.battery).toBeLessThanOrEqual(100)
      }
      previous = current
    }

    expect(engine.getSnapshot().completedOrders).toBeGreaterThan(0)
  })
})