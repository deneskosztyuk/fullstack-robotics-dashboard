import { describe, expect, it } from 'vitest'
import { createSnapshotWorkbook } from './excel'
import { createSimulationSnapshot } from './snapshot'

describe('Excel snapshot export', () => {
  it('creates a readable workbook with summary, fleet and event data', async () => {
    const snapshot = createSimulationSnapshot({
      stats: { completedOrders: 7, completedTransfers: 2 },
      robots: [{
        id: 2,
        status: 'executing',
        task: 'Picking',
        battery: 82,
        location: 'Shelf B pick face',
        retireWhenParked: false,
        shelfId: 'A',
        destinationShelfId: 'B',
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
        gridWidth: 21,
        gridDepth: 21,
        shelfCount: 6,
        dockCount: 4,
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

    const bytes = await createSnapshotWorkbook(snapshot)
    expect([...new Uint8Array(bytes).slice(0, 2)]).toEqual([0x50, 0x4b])

    const XLSX = await import('xlsx')
    const workbook = XLSX.read(bytes, { type: 'array' })
    expect(workbook.SheetNames).toEqual(['Summary', 'Fleet', 'Events'])

    const summaryRows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets.Summary, { header: 1 })
    const fleetRows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets.Fleet, { header: 1 })
    const eventRows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets.Events, { header: 1 })

    expect(summaryRows).toContainEqual(['Completed dock orders', 7])
    expect(summaryRows).toContainEqual(['Completed shelf transfers', 2])
    expect(summaryRows).toContainEqual(['Grid dimensions', '21 x 21 cells'])
    expect(fleetRows[1]).toEqual([2, 'executing', 'Picking', 'A', 'B', 'Shelf B pick face', 82, false])
    expect(eventRows[1]).toEqual([3, 40, 'activity', 'info', 2, 'Robot #2 started picking'])
  })
})