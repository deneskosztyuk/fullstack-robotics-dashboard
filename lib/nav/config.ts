import { GridMap } from './grid'
import type { Cell, DockConfig, LayoutId, ShelfConfig, WarehouseConfig } from './types'

export type {
  BatteryConfig,
  DockConfig,
  GridBounds,
  LayoutId,
  RetryBackoffConfig,
  ShelfConfig,
  WarehouseConfig,
} from './types'

export interface LayoutPreset {
  id: LayoutId
  name: string
}

export interface ValidationResult {
  errors: string[]
  warnings: string[]
}

export const LAYOUT_PRESETS: readonly LayoutPreset[] = [
  { id: 'open', name: 'Open floor' },
  { id: 'aisles', name: 'Parallel aisles' },
  { id: 'dense', name: 'High density' },
]

export const DEFAULT_LAYOUT_ID: LayoutId = 'dense'

const GRID = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }
const DOCKS: readonly DockConfig[] = [
  { id: 1, cell: { x: 0, z: 0 } },
  { id: 2, cell: { x: 1, z: 0 } },
  { id: 3, cell: { x: 0, z: 1 } },
  { id: 4, cell: { x: -1, z: 0 } },
]
const SPAWN_CELLS: readonly Cell[] = [
  { x: 2, z: 2 },
  { x: -2, z: 2 },
  { x: 2, z: -2 },
  { x: -2, z: -2 },
  { x: 3, z: 2 },
  { x: -3, z: 2 },
  { x: 3, z: -2 },
  { x: -3, z: -2 },
  { x: 2, z: 3 },
  { x: -2, z: 3 },
  { x: 2, z: -3 },
  { x: -2, z: -3 },
]
const SHELF_IDS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function copyCell(cell: Cell): Cell {
  return { x: cell.x, z: cell.z }
}

function buildShelves(columns: readonly number[], zValues: readonly number[]): ShelfConfig[] {
  const shelves: ShelfConfig[] = []
  for (const x of columns) {
    for (const z of zValues) {
      const index = shelves.length
      shelves.push({
        id: SHELF_IDS[index],
        cell: { x, z },
        pickCell: { x: x - Math.sign(x) * 2, z },
      })
    }
  }
  return shelves
}

function layoutDefinition(layoutId: LayoutId): { name: string; shelves: ShelfConfig[] } {
  switch (layoutId) {
    case 'open':
      return { name: 'Open floor', shelves: buildShelves([8, -8], [0, 3, -3]) }
    case 'aisles':
      return { name: 'Parallel aisles', shelves: buildShelves([8, -8], [-6, -3, 0, 3, 6]) }
    case 'dense':
      return { name: 'High density', shelves: buildShelves([8, 5, -5, -8], [-6, -3, 0, 3, 6]) }
  }
}

export function createWarehouseConfig(
  layoutId: LayoutId = DEFAULT_LAYOUT_ID,
  robotCount = 12
): WarehouseConfig {
  const layout = layoutDefinition(layoutId)
  const tickMs = 340

  return {
    layoutId,
    layoutName: layout.name,
    grid: { ...GRID },
    shelves: layout.shelves,
    docks: DOCKS.map((dock) => ({ id: dock.id, cell: copyCell(dock.cell) })),
    spawnCells: SPAWN_CELLS.map(copyCell),
    tickMs,
    horizon: 80,
    replanWindow: 16,
    maxPlansPerTick: 4,
    maxCatchUpSteps: 5,
    retryBackoff: { initialTicks: 2, maxTicks: 32 },
    battery: {
      initialMin: 70,
      initialMax: 100,
      drainPerSecond: 1.5,
      chargePerSecond: 8,
      lowThreshold: 10,
      fullThreshold: 95,
    },
    pickDurationTicks: 6,
    deliverDurationTicks: 6,
    throughputWindowTicks: Math.ceil(60_000 / tickMs),
    maxCompletedOrdersHistory: 60,
    maxCycleSamples: 20,
    seed: 12345,
    robotCount,
  }
}

export const DEFAULT_CONFIG = createWarehouseConfig()

function cellKey(cell: Cell): string {
  return `${cell.x},${cell.z}`
}

function isIntegerCell(cell: Cell): boolean {
  return Number.isInteger(cell.x) && Number.isInteger(cell.z)
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

function findDuplicates<T>(items: readonly T[], keyFor: (item: T) => string): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const item of items) {
    const key = keyFor(item)
    if (seen.has(key)) duplicates.add(key)
    seen.add(key)
  }
  return [...duplicates]
}

export function validateConfig(config: WarehouseConfig): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const { minX, maxX, minZ, maxZ } = config.grid
  const bounds = [minX, maxX, minZ, maxZ]

  if (!bounds.every(Number.isInteger)) errors.push('grid bounds must be integers')
  if (!(minX < maxX)) errors.push('grid.minX must be less than grid.maxX')
  if (!(minZ < maxZ)) errors.push('grid.minZ must be less than grid.maxZ')

  const inBounds = (cell: Cell) =>
    cell.x >= minX && cell.x <= maxX && cell.z >= minZ && cell.z <= maxZ
  const validateCell = (cell: Cell, label: string) => {
    if (!isIntegerCell(cell)) errors.push(`${label} must use integer coordinates`)
    if (!inBounds(cell)) errors.push(`${label} out of bounds`)
  }

  if (config.shelves.length === 0) errors.push('at least one shelf is required')
  if (config.docks.length === 0) errors.push('at least one dock is required')
  if (config.spawnCells.length === 0) errors.push('at least one spawn cell is required')

  for (const id of findDuplicates(config.shelves, (shelf) => shelf.id)) {
    errors.push(`duplicate shelf id ${id}`)
  }
  for (const id of findDuplicates(config.docks, (dock) => String(dock.id))) {
    errors.push(`duplicate dock id ${id}`)
  }
  for (const shelf of config.shelves) {
    if (shelf.id.trim().length === 0) errors.push('shelf id must not be empty')
    validateCell(shelf.cell, `shelf ${shelf.id} cell`)
    validateCell(shelf.pickCell, `shelf ${shelf.id} pickCell`)
  }
  for (const dock of config.docks) {
    if (!Number.isInteger(dock.id)) errors.push(`dock id ${dock.id} must be an integer`)
    validateCell(dock.cell, `dock ${dock.id} cell`)
  }
  for (const spawn of config.spawnCells) validateCell(spawn, `spawn cell ${cellKey(spawn)}`)

  for (const key of findDuplicates(config.shelves, (shelf) => cellKey(shelf.cell))) {
    errors.push(`duplicate shelf cell ${key}`)
  }
  for (const key of findDuplicates(config.shelves, (shelf) => cellKey(shelf.pickCell))) {
    errors.push(`duplicate pick cell ${key}`)
  }
  for (const key of findDuplicates(config.docks, (dock) => cellKey(dock.cell))) {
    errors.push(`duplicate dock cell ${key}`)
  }
  for (const key of findDuplicates(config.spawnCells, cellKey)) {
    errors.push(`duplicate spawn cell ${key}`)
  }

  const shelfCells = new Set(config.shelves.map((shelf) => cellKey(shelf.cell)))
  const pickCells = new Set(config.shelves.map((shelf) => cellKey(shelf.pickCell)))
  const dockCells = new Set(config.docks.map((dock) => cellKey(dock.cell)))
  const spawnCells = new Set(config.spawnCells.map(cellKey))

  for (const shelf of config.shelves) {
    const pickKey = cellKey(shelf.pickCell)
    if (shelfCells.has(pickKey)) errors.push(`shelf ${shelf.id} pickCell overlaps a shelf cell`)
    if (dockCells.has(pickKey)) errors.push(`shelf ${shelf.id} pickCell overlaps a dock cell`)
    if (spawnCells.has(pickKey)) errors.push(`shelf ${shelf.id} pickCell overlaps a spawn cell`)
  }
  for (const dock of config.docks) {
    const key = cellKey(dock.cell)
    if (shelfCells.has(key)) errors.push(`dock ${dock.id} overlaps a shelf cell`)
    if (pickCells.has(key)) errors.push(`dock ${dock.id} overlaps a pick cell`)
    if (spawnCells.has(key)) errors.push(`dock ${dock.id} overlaps a spawn cell`)
  }
  for (const spawn of config.spawnCells) {
    const key = cellKey(spawn)
    if (shelfCells.has(key)) errors.push(`spawn cell ${key} overlaps a shelf cell`)
    if (pickCells.has(key)) errors.push(`spawn cell ${key} overlaps a pick cell`)
  }

  if (!isPositiveInteger(config.tickMs)) errors.push('tickMs must be a positive integer')
  if (!isPositiveInteger(config.horizon)) errors.push('horizon must be a positive integer')
  if (!isPositiveInteger(config.replanWindow) || config.replanWindow > config.horizon) {
    errors.push('replanWindow must be a positive integer no greater than horizon')
  }
  if (!isPositiveInteger(config.maxPlansPerTick)) errors.push('maxPlansPerTick must be a positive integer')
  if (!isPositiveInteger(config.maxCatchUpSteps)) errors.push('maxCatchUpSteps must be a positive integer')
  if (!isPositiveInteger(config.retryBackoff.initialTicks)) {
    errors.push('retryBackoff.initialTicks must be a positive integer')
  }
  if (
    !isPositiveInteger(config.retryBackoff.maxTicks) ||
    config.retryBackoff.maxTicks < config.retryBackoff.initialTicks
  ) {
    errors.push('retryBackoff.maxTicks must be an integer no less than initialTicks')
  }
  if (!isPositiveInteger(config.pickDurationTicks)) errors.push('pickDurationTicks must be a positive integer')
  if (!isPositiveInteger(config.deliverDurationTicks)) errors.push('deliverDurationTicks must be a positive integer')
  if (!isPositiveInteger(config.throughputWindowTicks)) {
    errors.push('throughputWindowTicks must be a positive integer')
  }
  if (!isPositiveInteger(config.maxCompletedOrdersHistory)) {
    errors.push('maxCompletedOrdersHistory must be a positive integer')
  }
  if (!isPositiveInteger(config.maxCycleSamples)) errors.push('maxCycleSamples must be a positive integer')
  if (!Number.isInteger(config.seed)) errors.push('seed must be an integer')

  const battery = config.battery
  const batteryValues = [
    battery.initialMin,
    battery.initialMax,
    battery.drainPerSecond,
    battery.chargePerSecond,
    battery.lowThreshold,
    battery.fullThreshold,
  ]
  if (!batteryValues.every(Number.isFinite)) errors.push('battery values must be finite')
  if (battery.initialMin < 0 || battery.initialMin > 100) errors.push('battery.initialMin out of range')
  if (battery.initialMax < battery.initialMin || battery.initialMax > 100) {
    errors.push('battery.initialMax out of range')
  }
  if (battery.lowThreshold < 0 || battery.lowThreshold > 100) {
    errors.push('battery.lowThreshold out of range')
  }
  if (battery.fullThreshold < battery.lowThreshold || battery.fullThreshold > 100) {
    errors.push('battery.fullThreshold out of range')
  }
  if (battery.drainPerSecond < 0) errors.push('battery.drainPerSecond must be >= 0')
  if (battery.chargePerSecond <= 0) errors.push('battery.chargePerSecond must be > 0')

  if (!Number.isInteger(config.robotCount) || config.robotCount < 1) {
    errors.push('robotCount must be an integer greater than zero')
  }
  if (config.robotCount > config.spawnCells.length) {
    errors.push(`robotCount ${config.robotCount} exceeds spawn capacity (${config.spawnCells.length})`)
  }
  if (config.robotCount > config.docks.length * 2) {
    warnings.push('high robot count relative to docks; queues will form')
  }

  const operationalCells = [
    ...config.spawnCells,
    ...config.shelves.map((shelf) => shelf.pickCell),
    ...config.docks.map((dock) => dock.cell),
  ]
  const validGrid = bounds.every(Number.isInteger) && minX < maxX && minZ < maxZ
  if (validGrid && config.spawnCells.length > 0 && operationalCells.every(isIntegerCell)) {
    const grid = new GridMap(config)
    const origin = config.spawnCells[0]
    if (operationalCells.every((cell) => grid.isTraversable(cell))) {
      for (const cell of operationalCells.slice(1)) {
        if (!grid.reachable(origin, cell)) {
          errors.push(`operational cell ${cellKey(cell)} is unreachable from spawn ${cellKey(origin)}`)
        }
      }
    }
  }

  return { errors, warnings }
}

export function assertConfig(config: WarehouseConfig): WarehouseConfig {
  const { errors } = validateConfig(config)
  if (errors.length > 0) {
    throw new Error(`Invalid warehouse config:\n  - ${errors.join('\n  - ')}`)
  }
  return config
}