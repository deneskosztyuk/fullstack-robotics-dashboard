import type { EngineEvent, LayoutId, SimulationSpeed } from '@/lib/nav'

export type SnapshotExportFormat = 'json' | 'csv' | 'xlsx'

export interface SnapshotRobot {
  id: number
  status: 'executing' | 'waiting' | 'charging'
  task: string
  battery: number
  location: string
  retireWhenParked: boolean
}

export interface SimulationSnapshotExport {
  generatedAt: string
  syntheticData: true
  stats: {
    completedOrders: number
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
  'Speed',
  'Simulation tick',
  'Paused',
  'Desired robot count',
  'Actual robot count',
  'Completed orders',
  'Deliveries last 60 sim s',
  'Mean cycle seconds',
  'Cycle sample count',
  'Robot ID',
  'Status',
  'Task',
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
    `${snapshot.simulation.speed}x`,
    snapshot.simulation.tick,
    snapshot.simulation.paused,
    snapshot.simulation.desiredRobotCount,
    snapshot.simulation.actualRobotCount,
    snapshot.stats.completedOrders,
    snapshot.metrics.deliveriesLast60SimulationSeconds,
    snapshot.metrics.meanCycleSeconds,
    snapshot.metrics.cycleSampleCount,
    robot.id,
    robot.status,
    robot.task,
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