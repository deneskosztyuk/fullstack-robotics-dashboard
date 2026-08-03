import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONFIG,
  LAYOUT_PRESETS,
  MAX_ROBOT_COUNT,
  assertConfig,
  createWarehouseConfig,
  validateConfig,
} from './config'
import { GridMap } from './grid'
import type { WarehouseConfig } from './types'

function withOverrides(update: (config: WarehouseConfig) => void): WarehouseConfig {
  const config = structuredClone(DEFAULT_CONFIG)
  update(config)
  return config
}

describe('warehouse layout presets', () => {
  it.each(LAYOUT_PRESETS)('$name passes validation', ({ id }) => {
    expect(validateConfig(createWarehouseConfig(id)).errors).toEqual([])
  })

  it('keeps four docks and capacity for twelve robots in every preset', () => {
    for (const preset of LAYOUT_PRESETS) {
      const config = createWarehouseConfig(preset.id, 12)
      expect(config.docks).toHaveLength(4)
      expect(config.spawnCells).toHaveLength(12)
      expect(validateConfig(config).errors).toEqual([])
    }
  })

  it.each([1, 12, 24, 36, 48])('generates a valid scaled environment for %i robots', (robotCount) => {
    for (const preset of LAYOUT_PRESETS) {
      const config = createWarehouseConfig(preset.id, robotCount)
      expect(config.robotCount).toBe(robotCount)
      expect(config.spawnCells).toHaveLength(robotCount)
      expect(validateConfig(config).errors).toEqual([])
    }
  })

  it('grows bounds and resources monotonically with fleet size', () => {
    const configs = [1, 12, 24, 36, 48]
      .map((robotCount) => createWarehouseConfig('dense', robotCount))

    for (let index = 1; index < configs.length; index++) {
      const previous = configs[index - 1]
      const current = configs[index]
      expect(current.grid.maxX).toBeGreaterThanOrEqual(previous.grid.maxX)
      expect(current.shelves.length).toBeGreaterThanOrEqual(previous.shelves.length)
      expect(current.docks.length).toBeGreaterThanOrEqual(previous.docks.length)
      expect(current.maxPlansPerTick).toBeGreaterThanOrEqual(previous.maxPlansPerTick)
    }
  })

  it('caps generated environments at forty-eight robots', () => {
    expect(MAX_ROBOT_COUNT).toBe(48)
    expect(() => createWarehouseConfig('dense', 0)).toThrow(RangeError)
    expect(() => createWarehouseConfig('dense', MAX_ROBOT_COUNT + 1)).toThrow(RangeError)
    expect(() => createWarehouseConfig('dense', 1.5)).toThrow(RangeError)
  })

  it('uses the locked 340 ms tick and dense twelve-robot default', () => {
    expect(DEFAULT_CONFIG.tickMs).toBe(340)
    expect(DEFAULT_CONFIG.layoutId).toBe('dense')
    expect(DEFAULT_CONFIG.robotCount).toBe(12)
    expect(DEFAULT_CONFIG.transferProbability).toBe(0.4)
  })

  it('returns fresh preset copies', () => {
    const first = createWarehouseConfig('open')
    first.spawnCells[0].x = 99
    expect(createWarehouseConfig('open').spawnCells[0].x).toBe(2)
  })
})

describe('validateConfig', () => {
  it('rejects a dock that overlaps a shelf cell', () => {
    const config = withOverrides((value) => {
      value.docks[0].cell = { ...value.shelves[0].cell }
    })
    expect(validateConfig(config).errors.some((error) => error.includes('overlaps a shelf cell'))).toBe(true)
  })

  it('rejects duplicate resource ids and cells', () => {
    const config = withOverrides((value) => {
      value.shelves[1].id = value.shelves[0].id
      value.docks[1].id = value.docks[0].id
      value.spawnCells[1] = { ...value.spawnCells[0] }
    })
    const { errors } = validateConfig(config)
    expect(errors.some((error) => error.includes('duplicate shelf id'))).toBe(true)
    expect(errors.some((error) => error.includes('duplicate dock id'))).toBe(true)
    expect(errors.some((error) => error.includes('duplicate spawn cell'))).toBe(true)
  })

  it('rejects non-integer resource coordinates', () => {
    const config = withOverrides((value) => {
      value.spawnCells[0].x = 1.5
    })
    expect(validateConfig(config).errors.some((error) => error.includes('integer coordinates'))).toBe(true)
  })

  it('rejects a pick cell that overlaps any shelf cell', () => {
    const config = withOverrides((value) => {
      value.shelves[0].pickCell = { ...value.shelves[1].cell }
    })
    expect(validateConfig(config).errors.some((error) => error.includes('pickCell overlaps a shelf cell'))).toBe(true)
  })

  it('rejects a dock that overlaps a spawn cell', () => {
    const config = withOverrides((value) => {
      value.docks[0].cell = { ...value.spawnCells[0] }
    })
    expect(validateConfig(config).errors.some((error) => error.includes('overlaps a spawn cell'))).toBe(true)
  })

  it('rejects missing resources', () => {
    const config = withOverrides((value) => {
      value.docks = []
      value.shelves = []
      value.spawnCells = []
    })
    const { errors } = validateConfig(config)
    expect(errors.some((error) => error.includes('at least one dock'))).toBe(true)
    expect(errors.some((error) => error.includes('at least one shelf'))).toBe(true)
    expect(errors.some((error) => error.includes('at least one spawn'))).toBe(true)
  })

  it('rejects invalid timing and history limits', () => {
    const config = withOverrides((value) => {
      value.tickMs = 0
      value.replanWindow = value.horizon + 1
      value.maxPlansPerTick = 0
      value.maxCycleSamples = 0
      value.transferProbability = 2
    })
    const { errors } = validateConfig(config)
    expect(errors.some((error) => error.includes('tickMs'))).toBe(true)
    expect(errors.some((error) => error.includes('replanWindow'))).toBe(true)
    expect(errors.some((error) => error.includes('maxPlansPerTick'))).toBe(true)
    expect(errors.some((error) => error.includes('maxCycleSamples'))).toBe(true)
    expect(errors.some((error) => error.includes('transferProbability'))).toBe(true)
  })

  it('rejects robot counts outside spawn capacity', () => {
    const noRobots = withOverrides((value) => {
      value.robotCount = 0
    })
    const tooMany = withOverrides((value) => {
      value.robotCount = value.spawnCells.length + 1
    })
    expect(validateConfig(noRobots).errors.some((error) => error.includes('greater than zero'))).toBe(true)
    expect(validateConfig(tooMany).errors.some((error) => error.includes('exceeds spawn capacity'))).toBe(true)
  })

  it('rejects robot counts above the global maximum', () => {
    const config = withOverrides((value) => {
      value.robotCount = MAX_ROBOT_COUNT + 1
      value.spawnCells = Array.from({ length: value.robotCount }, (_, index) => ({
        x: index,
        z: value.grid.minZ,
      }))
    })
    expect(validateConfig(config).errors.some((error) => error.includes('must not exceed'))).toBe(true)
  })

  it('rejects statically disconnected operational cells', () => {
    const config = withOverrides((value) => {
      value.grid = { minX: 0, maxX: 4, minZ: 0, maxZ: 4 }
      value.shelves = [0, 1, 2, 3, 4].map((z) => ({
        id: `S${z}`,
        cell: { x: 2, z },
        pickCell: { x: 3, z },
      }))
      value.docks = [{ id: 1, cell: { x: 0, z: 4 } }]
      value.spawnCells = [{ x: 0, z: 0 }]
      value.robotCount = 1
    })
    expect(validateConfig(config).errors.some((error) => error.includes('unreachable'))).toBe(true)
  })

  it('assertConfig throws with the validation errors', () => {
    const config = withOverrides((value) => {
      value.docks = []
    })
    expect(() => assertConfig(config)).toThrow('at least one dock')
  })
})

describe('GridMap', () => {
  const grid = new GridMap(DEFAULT_CONFIG)

  it('treats shelf cells and out-of-bounds cells as non-traversable', () => {
    expect(grid.isTraversable({ x: 8, z: 0 })).toBe(false)
    expect(grid.isTraversable({ x: 11, z: 0 })).toBe(false)
  })

  it('returns deterministic cardinal neighbors without blocked cells', () => {
    expect(grid.neighbors({ x: 7, z: 0 })).toEqual([
      { x: 6, z: 0 },
      { x: 7, z: 1 },
      { x: 7, z: -1 },
    ])
  })

  it('reports reachability across open terrain', () => {
    expect(grid.reachable({ x: 0, z: 0 }, { x: 10, z: 10 })).toBe(true)
  })

  it('rejects blocked starts and goals', () => {
    expect(grid.reachable({ x: 8, z: 0 }, { x: 0, z: 0 })).toBe(false)
    expect(grid.reachable({ x: 0, z: 0 }, { x: 8, z: 0 })).toBe(false)
  })
})