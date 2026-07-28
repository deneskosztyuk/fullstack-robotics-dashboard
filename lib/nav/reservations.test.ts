import { describe, expect, it } from 'vitest'
import { ReservationTable } from './reservations'
import type { TimedPath } from './types'

const corridorPath: TimedPath = [
  { x: 0, z: 0, tick: 0 },
  { x: 1, z: 0, tick: 1 },
  { x: 2, z: 0, tick: 2 },
]

describe('ReservationTable paths', () => {
  it('commits absolute-tick vertices and directed edges without implicitly parking', () => {
    const table = new ReservationTable()
    expect(table.commitPath(corridorPath, 1)).toBe(true)
    expect(table.vertexOccupant({ x: 1, z: 0 }, 1)).toBe(1)
    expect(table.edgeOccupant({ x: 0, z: 0 }, { x: 1, z: 0 }, 1)).toBe(1)
    expect(table.isParkedAt({ x: 2, z: 0 })).toBe(false)
  })

  it('rejects a vertex conflict without partially committing the path', () => {
    const table = new ReservationTable()
    expect(table.commitPath(corridorPath, 1)).toBe(true)
    const conflict: TimedPath = [
      { x: 0, z: 2, tick: 0 },
      { x: 1, z: 1, tick: 1 },
      { x: 2, z: 0, tick: 2 },
    ]
    expect(table.commitPath(conflict, 2)).toBe(false)
    expect(table.vertexOccupant({ x: 0, z: 2 }, 0)).toBeUndefined()
    expect(table.vertexOccupant({ x: 2, z: 0 }, 2)).toBe(1)
  })

  it('prevents a head-on edge swap', () => {
    const table = new ReservationTable()
    expect(table.commitPath([
      { x: 0, z: 0, tick: 0 },
      { x: 1, z: 0, tick: 1 },
    ], 1)).toBe(true)
    expect(table.commitPath([
      { x: 1, z: 0, tick: 0 },
      { x: 0, z: 0, tick: 1 },
    ], 2)).toBe(false)
  })

  it('allows same-direction following after the leader clears each cell', () => {
    const table = new ReservationTable()
    expect(table.commitPath(corridorPath, 1)).toBe(true)
    expect(table.commitPath([
      { x: -1, z: 0, tick: 0 },
      { x: 0, z: 0, tick: 1 },
      { x: 1, z: 0, tick: 2 },
    ], 2)).toBe(true)
  })

  it('reserves explicit wait steps at their ticks', () => {
    const table = new ReservationTable()
    expect(table.commitPath([
      { x: 0, z: 0, tick: 4 },
      { x: 0, z: 0, tick: 5 },
      { x: 1, z: 0, tick: 6 },
    ], 1)).toBe(true)
    expect(table.vertexOccupant({ x: 0, z: 0 }, 5)).toBe(1)
    expect(table.edgeOccupant({ x: 0, z: 0 }, { x: 0, z: 0 }, 5)).toBeUndefined()
  })

  it('atomically replaces a future tail', () => {
    const table = new ReservationTable()
    expect(table.commitPath(corridorPath, 1)).toBe(true)
    expect(table.commitPath([
      { x: 1, z: 0, tick: 1 },
      { x: 1, z: -1, tick: 2 },
      { x: 2, z: -1, tick: 3 },
    ], 1)).toBe(true)
    expect(table.vertexOccupant({ x: 0, z: 0 }, 0)).toBe(1)
    expect(table.vertexOccupant({ x: 2, z: 0 }, 2)).toBeUndefined()
    expect(table.vertexOccupant({ x: 1, z: -1 }, 2)).toBe(1)
  })

  it('preserves the old tail when replacement conflicts', () => {
    const table = new ReservationTable()
    expect(table.commitPath(corridorPath, 1)).toBe(true)
    expect(table.parkRobot({ x: 1, z: -1 }, 2, 0)).toBe(true)
    expect(table.commitPath([
      { x: 1, z: 0, tick: 1 },
      { x: 1, z: -1, tick: 2 },
    ], 1)).toBe(false)
    expect(table.vertexOccupant({ x: 2, z: 0 }, 2)).toBe(1)
  })

  it('extends from an already reserved endpoint', () => {
    const table = new ReservationTable()
    expect(table.commitPath(corridorPath, 1)).toBe(true)
    expect(table.commitPath([
      { x: 2, z: 0, tick: 2 },
      { x: 2, z: 0, tick: 3 },
      { x: 3, z: 0, tick: 4 },
    ], 1)).toBe(true)
    expect(table.lastReservedTick(1)).toBe(4)
  })

  it('rejects malformed paths', () => {
    const table = new ReservationTable()
    expect(table.commitPath([], 1)).toBe(false)
    expect(table.commitPath([
      { x: 0, z: 0, tick: 0 },
      { x: 1, z: 0, tick: 2 },
    ], 1)).toBe(false)
    expect(table.commitPath([
      { x: 0, z: 0, tick: 0 },
      { x: 1, z: 1, tick: 1 },
    ], 1)).toBe(false)
  })
})

describe('ReservationTable parking and cleanup', () => {
  it('blocks a parked cell from its effective tick onward', () => {
    const table = new ReservationTable()
    expect(table.parkRobot({ x: 5, z: 5 }, 1, 10)).toBe(true)
    expect(table.canReserveVertex({ x: 5, z: 5 }, 9, 2)).toBe(true)
    expect(table.canReserveVertex({ x: 5, z: 5 }, 10, 2)).toBe(false)
  })

  it('keeps only one parked cell per robot', () => {
    const table = new ReservationTable()
    expect(table.parkRobot({ x: 0, z: 0 }, 1, 0)).toBe(true)
    expect(table.parkRobot({ x: 1, z: 0 }, 1, 5)).toBe(true)
    expect(table.isParkedAt({ x: 0, z: 0 })).toBe(false)
    expect(table.parkedOccupant({ x: 1, z: 0 })).toBe(1)
  })

  it('retains parking after a failed departure and clears it after success', () => {
    const table = new ReservationTable()
    expect(table.parkRobot({ x: 0, z: 0 }, 1, 0)).toBe(true)
    expect(table.parkRobot({ x: 1, z: 0 }, 2, 0)).toBe(true)
    const departure: TimedPath = [
      { x: 0, z: 0, tick: 3 },
      { x: 1, z: 0, tick: 4 },
    ]
    expect(table.commitPath(departure, 1)).toBe(false)
    expect(table.parkedOccupant({ x: 0, z: 0 })).toBe(1)
    table.releaseRobot(2)
    expect(table.commitPath(departure, 1)).toBe(true)
    expect(table.isParkedAt({ x: 0, z: 0 })).toBe(false)
  })

  it('refuses parking over another robots future reservation', () => {
    const table = new ReservationTable()
    expect(table.commitPath([
      { x: 0, z: 0, tick: 5 },
      { x: 1, z: 0, tick: 6 },
    ], 1)).toBe(true)
    expect(table.parkRobot({ x: 1, z: 0 }, 2, 4)).toBe(false)
  })

  it('truncates inclusively and prunes only historical ticks', () => {
    const table = new ReservationTable()
    expect(table.commitPath(corridorPath, 1)).toBe(true)
    table.truncateFrom(1, 2)
    expect(table.vertexOccupant({ x: 1, z: 0 }, 1)).toBe(1)
    expect(table.vertexOccupant({ x: 2, z: 0 }, 2)).toBeUndefined()
    table.pruneBefore(1)
    expect(table.vertexOccupant({ x: 0, z: 0 }, 0)).toBeUndefined()
    expect(table.vertexOccupant({ x: 1, z: 0 }, 1)).toBe(1)
  })

  it('releaseRobot removes paths and parking', () => {
    const table = new ReservationTable()
    expect(table.commitPath(corridorPath, 1)).toBe(true)
    expect(table.parkRobot({ x: 2, z: 0 }, 1, 2)).toBe(true)
    table.releaseRobot(1)
    expect(table.vertexOccupant({ x: 1, z: 0 }, 1)).toBeUndefined()
    expect(table.isParkedAt({ x: 2, z: 0 })).toBe(false)
  })
})