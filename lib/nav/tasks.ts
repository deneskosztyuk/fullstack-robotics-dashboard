import type {
  Cell,
  RobotId,
  RobotTaskKind,
  TimedPath,
  WarehouseConfig,
} from './types'

export type PlanIntent = 'shelf' | 'dock_delivery' | 'dock_charge'
export type RobotStatus = 'active' | 'charging' | 'idle'

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
    idle: 'Idle',
    to_shelf: 'Moving to Shelf',
    picking: 'Picking Items',
    to_dock: 'Returning to Dock',
    delivering: 'Delivering',
    wait_dock: 'Waiting for Dock',
    to_charge: 'Low Battery - Returning',
    charging: 'Charging',
    wait_path: 'Waiting for Route',
  }
  return labels[kind]
}

export function statusForTask(kind: RobotTaskKind): RobotStatus {
  if (kind === 'charging' || kind === 'to_charge' || kind === 'wait_dock') return 'charging'
  if (kind === 'idle' || kind === 'wait_path') return 'idle'
  return 'active'
}

export function locationForCell(config: WarehouseConfig, cell: Cell): string {
  if (config.docks.some((dock) => dock.cell.x === cell.x && dock.cell.z === cell.z)) return 'Dock'
  if (cell.x > 5) return 'Zone A'
  if (cell.x < -5) return 'Zone B'
  return 'Zone C'
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