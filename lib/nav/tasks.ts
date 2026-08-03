import type {
  Cell,
  RobotId,
  RobotTaskKind,
  TimedPath,
  WarehouseConfig,
} from './types'

export type PlanIntent = 'shelf' | 'dock_delivery' | 'dock_charge'
export type RobotStatus = 'executing' | 'waiting' | 'charging'

export interface RobotRuntimeState {
  id: RobotId
  kind: RobotTaskKind
  cell: Cell
  prevCell: Cell
  heading: number
  battery: number
  hasCargo: boolean
  needsCharge: boolean
  retireWhenParked: boolean
  shelfId?: string
  dockId?: number
  route: TimedPath
  arrivalTick?: number
  remainingTaskTicks: number
  planIntent?: PlanIntent
  waitingSinceTick: number
  retryAtTick: number
  retryDelayTicks: number
  planFailureWarned: boolean
  cycleStartTick: number
}

export function createRobotRuntimeState(
  id: RobotId,
  cell: Cell,
  battery: number,
  tick: number,
  retryDelayTicks: number
): RobotRuntimeState {
  return {
    id,
    kind: 'idle',
    cell: { ...cell },
    prevCell: { ...cell },
    heading: 0,
    battery,
    hasCargo: false,
    needsCharge: false,
    retireWhenParked: false,
    route: [],
    remainingTaskTicks: 0,
    waitingSinceTick: tick,
    retryAtTick: tick,
    retryDelayTicks,
    planFailureWarned: false,
    cycleStartTick: tick,
  }
}

export function isMovingTask(kind: RobotTaskKind): boolean {
  return kind === 'to_shelf' || kind === 'to_dock' || kind === 'to_charge'
}

export function taskLabel(kind: RobotTaskKind): string {
  const labels: Record<RobotTaskKind, string> = {
    idle: 'Awaiting assignment',
    to_shelf: 'En route to shelf',
    picking: 'Picking',
    to_dock: 'En route to dock',
    delivering: 'Unloading at dock',
    wait_dock: 'Waiting for dock',
    to_charge: 'En route to charge',
    charging: 'Charging',
    wait_path: 'Waiting for route',
  }
  return labels[kind]
}

export function statusForTask(kind: RobotTaskKind): RobotStatus {
  if (kind === 'charging' || kind === 'to_charge') return 'charging'
  if (kind === 'idle' || kind === 'wait_path' || kind === 'wait_dock') return 'waiting'
  return 'executing'
}

export function locationForCell(config: WarehouseConfig, cell: Cell): string {
  const dock = config.docks.find((candidate) => candidate.cell.x === cell.x && candidate.cell.z === cell.z)
  if (dock) return `Dock D${dock.id}`

  const pickFace = config.shelves.find((shelf) => shelf.pickCell.x === cell.x && shelf.pickCell.z === cell.z)
  if (pickFace) return `Shelf ${pickFace.id} pick face`

  const shelf = config.shelves.find((candidate) => candidate.cell.x === cell.x && candidate.cell.z === cell.z)
  if (shelf) return `Shelf ${shelf.id}`

  return `Cell ${cell.x}, ${cell.z}`
}

export function headingBetween(from: Cell, to: Cell, fallback: number): number {
  const deltaX = to.x - from.x
  const deltaZ = to.z - from.z
  if (deltaX === 0 && deltaZ === 0) return fallback
  return Math.atan2(deltaX, deltaZ)
}

export function routeStepAt(route: TimedPath, tick: number): TimedPath[number] | undefined {
  if (route.length === 0) return undefined
  const index = tick - route[0].tick
  if (index < 0 || index >= route.length) return undefined
  const step = route[index]
  return step.tick === tick ? step : undefined
}