import type { SimulationSnapshotExport } from './snapshot'

export async function createSnapshotWorkbook(
  snapshot: SimulationSnapshotExport
): Promise<ArrayBuffer> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()

  workbook.Props = {
    Title: 'AMR Traffic Simulator Snapshot',
    Subject: 'Synthetic autonomous mobile robot simulation data',
    Author: 'AMR Traffic Simulator',
    CreatedDate: new Date(snapshot.generatedAt),
  }

  const summary = XLSX.utils.aoa_to_sheet([
    ['Field', 'Value'],
    ['Generated at', snapshot.generatedAt],
    ['Synthetic data', snapshot.syntheticData],
    ['Layout', snapshot.simulation.layoutName],
    ['Grid dimensions', `${snapshot.simulation.gridWidth} x ${snapshot.simulation.gridDepth} cells`],
    ['Shelf count', snapshot.simulation.shelfCount],
    ['Dock count', snapshot.simulation.dockCount],
    ['Simulation tick', snapshot.simulation.tick],
    ['Paused', snapshot.simulation.paused],
    ['Speed', `${snapshot.simulation.speed}x`],
    ['Desired robot count', snapshot.simulation.desiredRobotCount],
    ['Actual robot count', snapshot.simulation.actualRobotCount],
    ['Completed dock orders', snapshot.stats.completedOrders],
    ['Completed shelf transfers', snapshot.stats.completedTransfers],
    ['Deliveries last 60 sim s', snapshot.metrics.deliveriesLast60SimulationSeconds],
    ['Mean cycle seconds', snapshot.metrics.meanCycleSeconds],
    ['Cycle sample count', snapshot.metrics.cycleSampleCount],
  ])
  summary['!cols'] = [{ wch: 28 }, { wch: 32 }]

  const fleet = XLSX.utils.aoa_to_sheet([
    ['Robot ID', 'Status', 'Task', 'Origin shelf', 'Destination shelf', 'Location', 'Battery percent', 'Retiring'],
    ...snapshot.robots.map((robot) => [
      robot.id,
      robot.status,
      robot.task,
      robot.shelfId ?? '',
      robot.destinationShelfId ?? '',
      robot.location,
      robot.battery,
      robot.retireWhenParked,
    ]),
  ])
  fleet['!cols'] = [
    { wch: 12 },
    { wch: 14 },
    { wch: 24 },
    { wch: 16 },
    { wch: 20 },
    { wch: 24 },
    { wch: 18 },
    { wch: 12 },
  ]
  fleet['!autofilter'] = { ref: `A1:H${snapshot.robots.length + 1}` }

  const events = XLSX.utils.aoa_to_sheet([
    ['Event ID', 'Simulation tick', 'Type', 'Severity', 'Robot ID', 'Message'],
    ...snapshot.recentEvents.map((event) => [
      event.id,
      event.tick,
      event.kind,
      event.severity,
      event.robot ?? '',
      event.message,
    ]),
  ])
  events['!cols'] = [
    { wch: 12 },
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 44 },
  ]
  events['!autofilter'] = { ref: `A1:F${snapshot.recentEvents.length + 1}` }

  XLSX.utils.book_append_sheet(workbook, summary, 'Summary')
  XLSX.utils.book_append_sheet(workbook, fleet, 'Fleet')
  XLSX.utils.book_append_sheet(workbook, events, 'Events')

  return XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
    compression: true,
  })
}