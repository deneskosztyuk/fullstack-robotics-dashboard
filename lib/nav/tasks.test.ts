import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from './config'
import {
  createRobotRuntimeState,
  headingBetween,
  locationForCell,
  routeStepAt,
  statusForTask,
  taskLabel,
} from './tasks'

describe('task helpers', () => {
  it('creates independent robot cells and deterministic retry state', () => {
    const spawn = { x: 2, z: 2 }
    const robot = createRobotRuntimeState(1, spawn, 80, 3, 2)
    spawn.x = 99
    expect(robot.cell).toEqual({ x: 2, z: 2 })
    expect(robot.retryAtTick).toBe(3)
    expect(robot.retryDelayTicks).toBe(2)
  })

  it('maps task labels and fleet statuses', () => {
    expect(taskLabel('wait_dock')).toBe('Waiting for dock')
    expect(taskLabel('to_shelf_drop')).toBe('En route to destination shelf')
    expect(taskLabel('dropping_off')).toBe('Dropping off at shelf')
    expect(statusForTask('to_charge')).toBe('charging')
    expect(statusForTask('wait_dock')).toBe('waiting')
    expect(statusForTask('wait_path')).toBe('waiting')
    expect(statusForTask('picking')).toBe('executing')
  })

  it('maps exact resources and grid cells', () => {
    expect(locationForCell(DEFAULT_CONFIG, { x: 0, z: 0 })).toBe('Dock D1')
    expect(locationForCell(DEFAULT_CONFIG, DEFAULT_CONFIG.shelves[0].pickCell)).toBe('Shelf A pick face')
    expect(locationForCell(DEFAULT_CONFIG, DEFAULT_CONFIG.shelves[0].cell)).toBe('Shelf A')
    expect(locationForCell(DEFAULT_CONFIG, { x: 7, z: 4 })).toBe('Cell 7, 4')
  })

  it('preserves heading while waiting and turns toward movement', () => {
    expect(headingBetween({ x: 0, z: 0 }, { x: 0, z: 0 }, 1.25)).toBe(1.25)
    expect(headingBetween({ x: 0, z: 0 }, { x: 1, z: 0 }, 0)).toBe(Math.PI / 2)
  })

  it('looks up a route step by its absolute tick', () => {
    const route = [
      { x: 0, z: 0, tick: 5 },
      { x: 1, z: 0, tick: 6 },
    ]
    expect(routeStepAt(route, 6)).toEqual({ x: 1, z: 0, tick: 6 })
    expect(routeStepAt(route, 4)).toBeUndefined()
  })
})