import type { EngineEvent, LayoutId, SimulationSpeed } from '@/lib/nav'

export type SnapshotExportFormat = 'json' | 'csv' | 'xlsx'

export interface SnapshotRobot {
  id: number
  status: 'executing' | 'waiting' | 'charging'
  task: string
  battery: number
  location: string
  retireWhenParked: boolean
  shelfId?: string
  destinationShelfId?: string
}

export interface SimulationSnapshotExport {
  generatedAt: string
  syntheticData: true
  stats: {
    completedOrders: number
    completedTransfers: number
  }
  robots: SnapshotRobot[]
  metrics: {
    deliveriesLast60SimulationSeconds: number
    meanCycleSeconds: number
    cycleSampleCount: number
  }
  simulation: {
    tick: number
    paused: boolean
    layout: LayoutId
    layoutName: string
    gridWidth: number
    gridDepth: number
    shelfCount: number
    dockCount: number
    speed: SimulationSpeed
    desiredRobotCount: number
    actualRobotCount: number
  }
  recentEvents: EngineEvent[]
}

export type SimulationSnapshotInput = Omit<
  SimulationSnapshotExport,
  'generatedAt' | 'syntheticData'
>

const CSV_HEADERS = [
  'Generated at',
  'Synthetic data',
  'Layout',
  'Grid width',
  'Grid depth',
  'Shelf count',
  'Dock count',
  'Speed',
  'Simulation tick',
  'Paused',
  'Desired robot count',
  'Actual robot count',
  'Completed orders',
  'Completed shelf transfers',
  'Deliveries last 60 sim s',
  'Mean cycle seconds',
  'Cycle sample count',
  'Robot ID',
  'Status',
  'Task',
  'Origin shelf',
  'Destination shelf',
  'Location',
  'Battery percent',
  'Retiring',
] as const

export function createSimulationSnapshot(
  input: SimulationSnapshotInput,
  generatedAt = new Date().toISOString()
): SimulationSnapshotExport {
  return {
    generatedAt,
    syntheticData: true,
    ...input,
  }
}

export function serializeSnapshotJson(snapshot: SimulationSnapshotExport): string {
  return JSON.stringify(snapshot, null, 2)
}

export function serializeFleetCsv(snapshot: SimulationSnapshotExport): string {
  const rows = snapshot.robots.map((robot) => [
    snapshot.generatedAt,
    snapshot.syntheticData,
    snapshot.simulation.layoutName,
    snapshot.simulation.gridWidth,
    snapshot.simulation.gridDepth,
    snapshot.simulation.shelfCount,
    snapshot.simulation.dockCount,
    `${snapshot.simulation.speed}x`,
    snapshot.simulation.tick,
    snapshot.simulation.paused,
    snapshot.simulation.desiredRobotCount,
    snapshot.simulation.actualRobotCount,
    snapshot.stats.completedOrders,
    snapshot.stats.completedTransfers,
    snapshot.metrics.deliveriesLast60SimulationSeconds,
    snapshot.metrics.meanCycleSeconds,
    snapshot.metrics.cycleSampleCount,
    robot.id,
    robot.status,
    robot.task,
    robot.shelfId ?? '',
    robot.destinationShelfId ?? '',
    robot.location,
    robot.battery,
    robot.retireWhenParked,
  ])

  return `\uFEFF${[CSV_HEADERS, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n')}`
}

export function snapshotFileName(
  snapshot: SimulationSnapshotExport,
  format: SnapshotExportFormat
): string {
  const timestamp = snapshot.generatedAt.replace(/[:.]/g, '-')
  return `amr-simulation-snapshot-${timestamp}.${format}`
}

function escapeCsvCell(value: string | number | boolean): string {
  let text = String(value)
  if (typeof value === 'string' && /^[=+\-@]/.test(text)) text = `'${text}`
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`
  return text
}