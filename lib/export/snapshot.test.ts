import { describe, expect, it } from 'vitest'
import {
  createSimulationSnapshot,
  serializeFleetCsv,
  serializeSnapshotJson,
  snapshotFileName,
  type SimulationSnapshotExport,
} from './snapshot'

function createFixture(): SimulationSnapshotExport {
  return createSimulationSnapshot({
    stats: { completedOrders: 7 },
    robots: [{
      id: 2,
      status: 'executing',
      task: 'Picking, "fragile"\nitems',
      battery: 82,
      location: '=1+1',
      retireWhenParked: false,
    }],
    metrics: {
      deliveriesLast60SimulationSeconds: 4,
      meanCycleSeconds: 9.25,
      cycleSampleCount: 7,
    },
    simulation: {
      tick: 42,
      paused: false,
      layout: 'open',
      layoutName: 'Open floor',
      speed: 1,
      desiredRobotCount: 4,
      actualRobotCount: 4,
    },
    recentEvents: [{
      id: 3,
      kind: 'activity',
      severity: 'info',
      robot: 2,
      message: 'Robot #2 started picking',
      tick: 40,
    }],
  }, '2026-08-03T12:34:56.789Z')
}

describe('snapshot exports', () => {
  it('preserves the complete snapshot in JSON', () => {
    const snapshot = createFixture()
    expect(JSON.parse(serializeSnapshotJson(snapshot))).toEqual(snapshot)
  })

  it('creates an Excel-friendly fleet CSV with escaped cells', () => {
    const csv = serializeFleetCsv(createFixture())

    expect(csv.startsWith('\uFEFFGenerated at,Synthetic data,Layout')).toBe(true)
    expect(csv).toContain('"Picking, ""fragile""\nitems"')
    expect(csv).toContain("'=1+1")
    expect(csv.split('\r\n')).toHaveLength(2)
  })

  it('uses the snapshot timestamp and selected extension in filenames', () => {
    const snapshot = createFixture()
    expect(snapshotFileName(snapshot, 'xlsx')).toBe(
      'amr-simulation-snapshot-2026-08-03T12-34-56-789Z.xlsx'
    )
  })
})