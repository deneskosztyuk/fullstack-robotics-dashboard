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

export interface EnvironmentScale {
  robotCount: number
  gridSize: number
  halfExtent: number
  shelfCount: number
  dockCount: number
  spawnCount: number
  maxPlansPerTick: number
}

export const LAYOUT_PRESETS: readonly LayoutPreset[] = [
  { id: 'open', name: 'Open floor' },
  { id: 'aisles', name: 'Parallel aisles' },
  { id: 'dense', name: 'High density' },
]

export const DEFAULT_LAYOUT_ID: LayoutId = 'dense'
export const MIN_ROBOT_COUNT = 1
export const MAX_ROBOT_COUNT = 48

const BASE_HALF_EXTENT = 10
const BASE_ROBOT_COUNT = 12
const ROBOTS_PER_EXPANSION = 4
const LEGACY_DOCKS: readonly DockConfig[] = [
  { id: 1, cell: { x: 0, z: 0 } },
  { id: 2, cell: { x: 1, z: 0 } },
  { id: 3, cell: { x: 0, z: 1 } },
  { id: 4, cell: { x: -1, z: 0 } },
]
const LEGACY_SPAWN_CELLS: readonly Cell[] = [
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

function copyCell(cell: Cell): Cell {
  return { x: cell.x, z: cell.z }
}

function shelfId(index: number): string {
  let value = index + 1
  let id = ''
  while (value > 0) {
    value--
    id = String.fromCharCode(65 + value % 26) + id
    value = Math.floor(value / 26)
  }
  return id
}

function buildShelves(columns: readonly number[], zValues: readonly number[]): ShelfConfig[] {
  const shelves: ShelfConfig[] = []
  for (const x of columns) {
    for (const z of zValues) {
      const index = shelves.length
      shelves.push({
        id: shelfId(index),
        cell: { x, z },
        pickCell: { x: x - Math.sign(x) * 2, z },
      })
    }
  }
  return shelves
}

function halfExtentFor(robotCount: number): number {
  return BASE_HALF_EXTENT + Math.ceil(Math.max(0, robotCount - BASE_ROBOT_COUNT) / ROBOTS_PER_EXPANSION)
}

function symmetricRows(halfExtent: number): number[] {
  const rowExtent = Math.floor((halfExtent - 4) / 3) * 3
  const rows: number[] = []
  for (let z = -rowExtent; z <= rowExtent; z += 3) rows.push(z)
  return rows
}

function centeredRows(rows: readonly number[], count: number): number[] {
  return [...rows]
    .sort((first, second) => Math.abs(first) - Math.abs(second) || second - first)
    .slice(0, count)
}

function shelfColumns(halfExtent: number, pairCount: number): number[] {
  const positive: number[] = []
  for (let x = halfExtent - 2; x >= 5; x -= 3) positive.push(x)
  const selected = pairCount === 1
    ? [positive[0]]
    : Array.from({ length: pairCount }, (_, index) => {
        const candidateIndex = Math.round(index * (positive.length - 1) / (pairCount - 1))
        return positive[candidateIndex]
      })
  return [...selected, ...[...selected].reverse().map((x) => -x)]
}

function layoutDefinition(
  layoutId: LayoutId,
  halfExtent: number
): { name: string; shelves: ShelfConfig[] } {
  const rows = symmetricRows(halfExtent)
  const expanded = halfExtent >= 16

  switch (layoutId) {
    case 'open':
      return {
        name: 'Open floor',
        shelves: buildShelves(
          shelfColumns(halfExtent, 1),
          centeredRows(rows, Math.min(rows.length, 3 + 2 * Math.floor((halfExtent - 10) / 3)))
        ),
      }
    case 'aisles':
      return {
        name: 'Parallel aisles',
        shelves: buildShelves(shelfColumns(halfExtent, expanded ? 2 : 1), rows),
      }
    case 'dense':
      return {
        name: 'High density',
        shelves: buildShelves(shelfColumns(halfExtent, expanded ? 3 : 2), rows),
      }
  }
}

function resourceKeys(shelves: readonly ShelfConfig[]): Set<string> {
  return new Set(shelves.flatMap((shelf) => [cellKey(shelf.cell), cellKey(shelf.pickCell)]))
}

function centerOutCells(halfExtent: number, minimumRadius = 0): Cell[] {
  const cells: Cell[] = []
  for (let x = -halfExtent + 1; x < halfExtent; x++) {
    for (let z = -halfExtent + 1; z < halfExtent; z++) {
      if (Math.max(Math.abs(x), Math.abs(z)) < minimumRadius) continue
      cells.push({ x, z })
    }
  }
  return cells.sort((first, second) =>
    Math.max(Math.abs(first.x), Math.abs(first.z)) - Math.max(Math.abs(second.x), Math.abs(second.z)) ||
    Math.abs(first.x) + Math.abs(first.z) - Math.abs(second.x) - Math.abs(second.z) ||
    second.z - first.z ||
    second.x - first.x
  )
}

function generateDocks(count: number, halfExtent: number, blocked: Set<string>): DockConfig[] {
  const candidates = [
    ...LEGACY_DOCKS.map((dock) => dock.cell),
    ...centerOutCells(halfExtent),
  ]
  const docks: DockConfig[] = []
  const used = new Set<string>()
  for (const cell of candidates) {
    const key = cellKey(cell)
    if (blocked.has(key) || used.has(key)) continue
    used.add(key)
    docks.push({ id: docks.length + 1, cell: copyCell(cell) })
    if (docks.length === count) return docks
  }
  throw new RangeError(`Unable to generate ${count} docks`)
}

function generateSpawnCells(
  count: number,
  halfExtent: number,
  blocked: Set<string>
): Cell[] {
  const candidates = [
    ...LEGACY_SPAWN_CELLS,
    ...centerOutCells(halfExtent, 2),
  ]
  const spawns: Cell[] = []
  const used = new Set<string>()
  for (const cell of candidates) {
    const key = cellKey(cell)
    if (blocked.has(key) || used.has(key)) continue
    used.add(key)
    spawns.push(copyCell(cell))
    if (spawns.length === count) return spawns
  }
  throw new RangeError(`Unable to generate ${count} spawn cells`)
}

function assertRobotCount(robotCount: number): void {
  if (!Number.isInteger(robotCount) || robotCount < MIN_ROBOT_COUNT || robotCount > MAX_ROBOT_COUNT) {
    throw new RangeError(`robot count must be between ${MIN_ROBOT_COUNT} and ${MAX_ROBOT_COUNT}`)
  }
}

function createEnvironment(layoutId: LayoutId, robotCount: number) {
  assertRobotCount(robotCount)
  const halfExtent = halfExtentFor(robotCount)
  const layout = layoutDefinition(layoutId, halfExtent)
  const blocked = resourceKeys(layout.shelves)
  const dockCount = Math.max(4, Math.ceil(robotCount / 4))
  const docks = generateDocks(dockCount, halfExtent, blocked)
  const spawnBlocked = new Set([...blocked, ...docks.map((dock) => cellKey(dock.cell))])
  const spawnCells = generateSpawnCells(robotCount, halfExtent, spawnBlocked)
  return { halfExtent, layout, docks, spawnCells }
}

export function getEnvironmentScale(layoutId: LayoutId, robotCount: number): EnvironmentScale {
  const environment = createEnvironment(layoutId, robotCount)
  return {
    robotCount,
    gridSize: environment.halfExtent * 2 + 1,
    halfExtent: environment.halfExtent,
    shelfCount: environment.layout.shelves.length,
    dockCount: environment.docks.length,
    spawnCount: environment.spawnCells.length,
    maxPlansPerTick: Math.max(4, Math.ceil(robotCount / 6)),
  }
}

export function createWarehouseConfig(
  layoutId: LayoutId = DEFAULT_LAYOUT_ID,
  robotCount = 12
): WarehouseConfig {
  const environment = createEnvironment(layoutId, robotCount)
  const tickMs = 340

  return {
    layoutId,
    layoutName: environment.layout.name,
    grid: {
      minX: -environment.halfExtent,
      maxX: environment.halfExtent,
      minZ: -environment.halfExtent,
      maxZ: environment.halfExtent,
    },
    shelves: environment.layout.shelves,
    docks: environment.docks,
    spawnCells: environment.spawnCells,
    tickMs,
    horizon: 80 + (environment.halfExtent - BASE_HALF_EXTENT) * 4,
    replanWindow: 16,
    maxPlansPerTick: Math.max(4, Math.ceil(robotCount / 6)),
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
    shelfDropDurationTicks: 6,
    transferProbability: 0.4,
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
  if (!isPositiveInteger(config.shelfDropDurationTicks)) {
    errors.push('shelfDropDurationTicks must be a positive integer')
  }
  if (
    !Number.isFinite(config.transferProbability) ||
    config.transferProbability < 0 ||
    config.transferProbability > 1
  ) {
    errors.push('transferProbability must be between 0 and 1')
  }
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
  if (config.robotCount > MAX_ROBOT_COUNT) {
    errors.push(`robotCount must not exceed ${MAX_ROBOT_COUNT}`)
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