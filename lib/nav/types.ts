export interface Cell {
  x: number
  z: number
}

export interface TimedStep extends Cell {
  tick: number
}

export type TimedPath = TimedStep[]
export type RobotId = number
export type LayoutId = 'open' | 'aisles' | 'dense'
export type SimulationSpeed = 0.5 | 1 | 2

export interface GridBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface ShelfConfig {
  id: string
  cell: Cell
  pickCell: Cell
}

export interface DockConfig {
  id: number
  cell: Cell
}

export interface BatteryConfig {
  initialMin: number
  initialMax: number
  drainPerSecond: number
  chargePerSecond: number
  lowThreshold: number
  fullThreshold: number
}

export interface RetryBackoffConfig {
  initialTicks: number
  maxTicks: number
}

export interface WarehouseConfig {
  layoutId: LayoutId
  layoutName: string
  grid: GridBounds
  shelves: ShelfConfig[]
  docks: DockConfig[]
  spawnCells: Cell[]
  tickMs: number
  horizon: number
  replanWindow: number
  maxPlansPerTick: number
  maxCatchUpSteps: number
  retryBackoff: RetryBackoffConfig
  battery: BatteryConfig
  pickDurationTicks: number
  deliverDurationTicks: number
  throughputWindowTicks: number
  metricsSampleTicks: number
  efficiencyHistoryLength: number
  maxCompletedOrdersHistory: number
  maxCycleSamples: number
  seed: number
  robotCount: number
}

export type RobotTaskKind =
  | 'idle'
  | 'to_shelf'
  | 'picking'
  | 'to_dock'
  | 'delivering'
  | 'wait_dock'
  | 'to_charge'
  | 'charging'
  | 'wait_path'

export interface RobotSnapshot {
  id: RobotId
  kind: RobotTaskKind
  shelfId?: string
  dockId?: number
  battery: number
  hasCargo: boolean
  needsCharge: boolean
  retireWhenParked: boolean
  prevCell: Cell
  cell: Cell
  heading: number
  taskLabel: string
}

export interface EngineSnapshot {
  generation: number
  tick: number
  robots: RobotSnapshot[]
  completedOrders: number
  throughputMinute: number
  avgCycleSeconds: number
  efficiencyPercent: number
  efficiencyHistory: number[]
  paused: boolean
  speed: SimulationSpeed
  layoutId: LayoutId
  desiredRobotCount: number
  canAddRobot: boolean
}

export interface RenderRobotPose {
  id: RobotId
  prevCell: Cell
  cell: Cell
  heading: number
}

export interface RobotRenderPose extends RenderRobotPose {
  progress: number
}

export interface EngineRenderSnapshot {
  progress: number
  robots: RenderRobotPose[]
}

export type EngineEventKind = 'alert' | 'activity'

export interface EngineEvent {
  id: number
  kind: EngineEventKind
  severity: 'info' | 'warning' | 'error'
  robot?: RobotId
  message: string
  tick: number
}

export type EngineListener = (snapshot: EngineSnapshot) => void
export type EngineEventListener = (event: EngineEvent) => void