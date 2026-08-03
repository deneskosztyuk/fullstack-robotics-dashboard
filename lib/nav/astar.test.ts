import { describe, expect, it } from 'vitest'
import { spaceTimeAStar } from './astar'
import { DEFAULT_CONFIG } from './config'
import { GridMap } from './grid'
import { ReservationTable } from './reservations'

const grid = new GridMap(DEFAULT_CONFIG)

describe('spaceTimeAStar', () => {
  it('detours around static shelf obstacles', () => {
    const plan = spaceTimeAStar({
      grid,
      reservations: new ReservationTable(),
      robot: 1,
      start: { x: 7, z: 0 },
      goal: { x: 9, z: 0 },
      startTick: 0,
      horizon: 8,
    })
    expect(plan?.arrivalTick).toBe(4)
    expect(plan?.path.some((step) => step.x === 8 && step.z === 0)).toBe(false)
  })

  it('waits when the shortest next cell is reserved', () => {
    const reservations = new ReservationTable()
    expect(reservations.commitPath([
      { x: 1, z: 0, tick: 1 },
      { x: 1, z: 1, tick: 2 },
    ], 1)).toBe(true)
    const plan = spaceTimeAStar({
      grid,
      reservations,
      robot: 2,
      start: { x: 0, z: 0 },
      goal: { x: 2, z: 0 },
      startTick: 0,
      horizon: 6,
    })
    expect(plan?.path.find((step) => step.tick === 1)).toMatchObject({ x: 0, z: 0 })
    expect(plan?.arrivalTick).toBe(3)
  })

  it('routes around a reserved reverse edge instead of swapping head-on', () => {
    const reservations = new ReservationTable()
    expect(reservations.commitPath([
      { x: 0, z: 0, tick: 0 },
      { x: 1, z: 0, tick: 1 },
    ], 1)).toBe(true)
    const plan = spaceTimeAStar({
      grid,
      reservations,
      robot: 2,
      start: { x: 1, z: 0 },
      goal: { x: 0, z: 0 },
      startTick: 0,
      horizon: 6,
    })
    expect(plan?.arrivalTick).toBe(3)
    expect(plan?.path.find((step) => step.tick === 1)).not.toMatchObject({ x: 0, z: 0 })
  })

  it('delays arrival until a goal can be held through the horizon', () => {
    const reservations = new ReservationTable()
    expect(reservations.commitPath([{ x: 2, z: 0, tick: 3 }], 1)).toBe(true)
    const plan = spaceTimeAStar({
      grid,
      reservations,
      robot: 2,
      start: { x: 0, z: 0 },
      goal: { x: 2, z: 0 },
      startTick: 0,
      horizon: 6,
    })
    expect(plan?.arrivalTick).toBe(4)
    expect(plan?.path.at(-1)).toEqual({ x: 2, z: 0, tick: 4 })
  })

  it('returns null for a parked goal', () => {
    const reservations = new ReservationTable()
    expect(reservations.parkRobot({ x: 2, z: 0 }, 1, 0)).toBe(true)
    expect(spaceTimeAStar({
      grid,
      reservations,
      robot: 2,
      start: { x: 0, z: 0 },
      goal: { x: 2, z: 0 },
      startTick: 0,
      horizon: 8,
    })).toBeNull()
  })

  it('returns an immediate path when already at the goal', () => {
    const plan = spaceTimeAStar({
      grid,
      reservations: new ReservationTable(),
      robot: 1,
      start: { x: 0, z: 0 },
      goal: { x: 0, z: 0 },
      startTick: 5,
      horizon: 3,
    })
    expect(plan?.arrivalTick).toBe(5)
    expect(plan?.path).toEqual([{ x: 0, z: 0, tick: 5 }])
  })

  it('returns null when the goal exceeds the horizon or is blocked', () => {
    expect(spaceTimeAStar({
      grid,
      reservations: new ReservationTable(),
      robot: 1,
      start: { x: 0, z: 0 },
      goal: { x: 4, z: 0 },
      startTick: 0,
      horizon: 2,
    })).toBeNull()
    expect(spaceTimeAStar({
      grid,
      reservations: new ReservationTable(),
      robot: 1,
      start: { x: 7, z: 0 },
      goal: { x: 8, z: 0 },
      startTick: 0,
      horizon: 4,
    })).toBeNull()
  })

  it('uses deterministic tie breaking', () => {
    const options = {
      grid,
      robot: 1,
      start: { x: 0, z: 0 },
      goal: { x: 2, z: 2 },
      startTick: 0,
      horizon: 8,
    }
    const first = spaceTimeAStar({ ...options, reservations: new ReservationTable() })
    const second = spaceTimeAStar({ ...options, reservations: new ReservationTable() })
    expect(first).toEqual(second)
  })
})