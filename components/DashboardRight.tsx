'use client'

import { useState } from 'react'
import { useWarehouse, WarehouseEvent } from '@/lib/WarehouseContext'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Download, Minus, Pause, Play, Plus, RotateCcw } from 'lucide-react'
import {
  createSimulationSnapshot,
  serializeFleetCsv,
  serializeSnapshotJson,
  snapshotFileName,
  type SimulationSnapshotExport,
  type SnapshotExportFormat,
} from '@/lib/export/snapshot'
import type { LayoutId, RobotSnapshot, SimulationSpeed } from '@/lib/nav'

const BATTERY_HIGH_THRESHOLD = 70
const BATTERY_MEDIUM_THRESHOLD = 40
const MAX_DISPLAYED_EVENTS = 8
const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const EXPORT_FORMATS: readonly { value: SnapshotExportFormat; label: string }[] = [
  { value: 'json', label: 'JSON (full)' },
  { value: 'csv', label: 'CSV (fleet)' },
  { value: 'xlsx', label: 'Excel (.xlsx)' },
]

interface EventItemProps {
  event: WarehouseEvent
  currentTick: number
  tickMs: number
}

interface RobotCardProps {
  robot: {
    id: number
    status: string
    task: string
    location: string
    battery: number
  }
  selected: boolean
  onSelect: (id: number) => void
}

const ALERT_BORDER = {
  warning: 'border-warning',
  info: 'border-primary',
  error: 'border-destructive',
}

const ALERT_TEXT = {
  warning: 'text-warning',
  info: 'text-primary',
  error: 'text-destructive',
}

function formatSimulationAge(eventTick: number, currentTick: number, tickMs: number): string {
  const seconds = Math.max(0, Math.floor((currentTick - eventTick) * tickMs / 1000))
  if (seconds < 60) return `${seconds} sim s ago`
  const minutes = Math.floor(seconds / 60)
  return `${minutes} sim min ago`
}

export function DashboardRight() {
  const {
    robots,
    events,
    stats,
    navigationSnapshot,
    config,
    paused,
    togglePause,
    reset,
    robotCount,
    actualRobotCount,
    maxRobotCount,
    canAddRobot,
    setRobotCount,
    layout,
    layouts,
    setLayout,
    speed,
    setSpeed,
    selectedRobot,
    selectedRobotId,
    selectRobot,
  } = useWarehouse()
  const [exportFormat, setExportFormat] = useState<SnapshotExportFormat>('json')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const selectedRobotStatus = robots.find((robot) => robot.id === selectedRobotId)?.status ?? 'waiting'
  const recentEvents = events.slice(-MAX_DISPLAYED_EVENTS).reverse()

  const handleExportSnapshot = async () => {
    const snapshot = createSimulationSnapshot({
      stats,
      robots,
      metrics: {
        deliveriesLast60SimulationSeconds: navigationSnapshot.deliveriesLast60Seconds,
        meanCycleSeconds: navigationSnapshot.avgCycleSeconds,
        cycleSampleCount: navigationSnapshot.cycleSampleCount,
      },
      simulation: {
        tick: navigationSnapshot.tick,
        paused: navigationSnapshot.paused,
        layout,
        layoutName: config.layoutName,
        speed,
        desiredRobotCount: robotCount,
        actualRobotCount,
      },
      recentEvents: events.slice(-10),
    })

    setExporting(true)
    setExportError(null)

    try {
      const blob = await createExportBlob(snapshot, exportFormat)
      downloadBlob(blob, snapshotFileName(snapshot, exportFormat))
    } catch {
      setExportError('Snapshot export failed. Try another format.')
    } finally {
      setExporting(false)
    }
  }

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-full overflow-y-auto px-4 pt-4 pb-4 space-y-4">

      {selectedRobot && (
        <RobotInspector
          robot={selectedRobot}
          status={selectedRobotStatus}
          currentTick={navigationSnapshot.tick}
          tickMs={config.tickMs}
        />
      )}

      <FleetControls
        robotCount={robotCount}
        actualRobotCount={actualRobotCount}
        maxRobotCount={maxRobotCount}
        canAddRobot={canAddRobot}
        onRobotCountChange={setRobotCount}
        layout={layout}
        layouts={layouts}
        onLayoutChange={setLayout}
        speed={speed}
        onSpeedChange={setSpeed}
      />

      <ControlButtons
        onPause={togglePause}
        onReset={reset}
        onExportSnapshot={handleExportSnapshot}
        exportFormat={exportFormat}
        onExportFormatChange={setExportFormat}
        exporting={exporting}
        exportError={exportError}
        paused={paused}
      />

      <section>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Fleet</h3>
        <div className="space-y-1.5">
          {robots.map(robot => (
            <RobotCard
              key={robot.id}
              robot={robot}
              selected={robot.id === selectedRobotId}
              onSelect={selectRobot}
            />
          ))}
        </div>
      </section>

      <section className="border-t border-border pt-4">
        <h3 className="mb-2 text-sm font-semibold text-foreground">Event log</h3>
        <div className="space-y-1 text-xs">
          {recentEvents.length === 0 ? (
            <div className="py-2 text-muted-foreground">No events yet</div>
          ) : (
            recentEvents.map((event) => (
              <EventItem
                key={event.id}
                event={event}
                currentTick={navigationSnapshot.tick}
                tickMs={config.tickMs}
              />
            ))
          )}
        </div>
      </section>

    </div>
  )
}

async function createExportBlob(
  snapshot: SimulationSnapshotExport,
  format: SnapshotExportFormat
): Promise<Blob> {
  if (format === 'json') {
    return new Blob([serializeSnapshotJson(snapshot)], { type: 'application/json' })
  }

  if (format === 'csv') {
    return new Blob([serializeFleetCsv(snapshot)], { type: 'text/csv;charset=utf-8' })
  }

  const { createSnapshotWorkbook } = await import('@/lib/export/excel')
  const workbook = await createSnapshotWorkbook(snapshot)
  return new Blob([workbook], { type: XLSX_MIME_TYPE })
}

function RobotInspector({
  robot,
  status,
  currentTick,
  tickMs,
}: {
  robot: RobotSnapshot
  status: string
  currentTick: number
  tickMs: number
}) {
  const isWaiting = robot.kind === 'idle' || robot.kind === 'wait_path' || robot.kind === 'wait_dock'
  const waitingSeconds = Math.max(0, (currentTick - robot.waitingSinceTick) * tickMs / 1000)
  const arrivalSeconds = robot.arrivalTick === undefined
    ? null
    : Math.max(0, (robot.arrivalTick - currentTick) * tickMs / 1000)
  const assignment = robot.shelfId
    ? `Shelf ${robot.shelfId}`
    : robot.dockId !== undefined
      ? `Dock D${robot.dockId}`
      : 'No claimed resource'

  return (
    <section aria-labelledby="selected-robot-heading" className="border-b border-border pb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase text-muted-foreground">Selected unit</div>
          <h2 id="selected-robot-heading" className="mt-1 font-mono text-xl font-semibold text-foreground">
            AMR-{String(robot.id).padStart(2, '0')}
          </h2>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="mt-4 divide-y divide-border border-y border-border text-xs">
        <InspectorRow label="Task" value={robot.retireWhenParked ? 'Retiring after task' : robot.taskLabel} />
        <InspectorRow label="Assignment" value={assignment} />
        <InspectorRow label="Grid cell" value={`${robot.cell.x}, ${robot.cell.z}`} mono />
        <InspectorRow label="Battery" value={`${Math.round(robot.battery)}%`} mono />
        <InspectorRow label="Payload" value={robot.hasCargo ? 'Loaded' : 'Empty'} />
        {arrivalSeconds !== null && <InspectorRow label="Planned arrival" value={`${arrivalSeconds.toFixed(1)} sim s`} mono />}
        {isWaiting && <InspectorRow label="Waiting" value={`${waitingSeconds.toFixed(1)} sim s`} mono />}
      </div>
    </section>
  )
}

function InspectorRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`truncate text-right text-foreground ${mono ? 'font-mono tabular-nums' : ''}`} title={value}>
        {value}
      </span>
    </div>
  )
}

function FleetControls({
  robotCount,
  actualRobotCount,
  maxRobotCount,
  canAddRobot,
  onRobotCountChange,
  layout,
  layouts,
  onLayoutChange,
  speed,
  onSpeedChange,
}: {
  robotCount: number
  actualRobotCount: number
  maxRobotCount: number
  canAddRobot: boolean
  onRobotCountChange: (count: number) => void
  layout: LayoutId
  layouts: readonly { id: LayoutId; name: string }[]
  onLayoutChange: (layout: LayoutId) => void
  speed: SimulationSpeed
  onSpeedChange: (speed: SimulationSpeed) => void
}) {
  const speeds: readonly SimulationSpeed[] = [0.5, 1, 2]

  return (
    <section className="border-b border-border pb-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">Simulation controls</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-foreground">Robots</div>
            <div className="text-xs text-muted-foreground">
              {actualRobotCount === robotCount
                ? `${actualRobotCount} in fleet`
                : `${actualRobotCount} present · target ${robotCount}`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onRobotCountChange(robotCount - 1)}
              disabled={robotCount <= 1}
              aria-label="Remove robot"
              title="Remove robot"
            >
              <Minus />
            </Button>
            <output className="w-8 text-center text-sm font-semibold tabular-nums">
              {robotCount}
            </output>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onRobotCountChange(robotCount + 1)}
              disabled={robotCount >= maxRobotCount || !canAddRobot}
              aria-label="Add robot"
              title="Add robot"
            >
              <Plus />
            </Button>
          </div>
        </div>

        <label className="block">
          <span className="block text-xs font-medium text-foreground mb-1">Layout</span>
          <select
            value={layout}
            onChange={(event) => onLayoutChange(event.target.value as LayoutId)}
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            {layouts.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.name}</option>
            ))}
          </select>
        </label>

        <div>
          <div className="text-xs font-medium text-foreground mb-1">Simulation Speed</div>
          <div className="grid grid-cols-3 gap-1" role="group" aria-label="Simulation speed">
            {speeds.map((option) => (
              <Button
                key={option}
                size="xs"
                variant={speed === option ? 'default' : 'outline'}
                onClick={() => onSpeedChange(option)}
                aria-pressed={speed === option}
              >
                {option}x
              </Button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function RobotCard({ robot, selected, onSelect }: RobotCardProps) {
  const getBatteryColor = (battery: number) => {
    if (battery > BATTERY_HIGH_THRESHOLD) return 'bg-success'
    if (battery > BATTERY_MEDIUM_THRESHOLD) return 'bg-warning'
    return 'bg-destructive'
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(robot.id)}
      aria-pressed={selected}
      className={`w-full p-2.5 text-left transition-colors ${
        selected
          ? 'border-l-2 border-primary bg-primary/10'
          : 'border-l-2 border-transparent bg-muted/20 hover:bg-muted/40'
      }`}
    >
      <div className="flex justify-between items-center mb-1.5">
        <span className="font-semibold text-foreground text-sm">Robot #{robot.id}</span>
        <StatusBadge status={robot.status} />
      </div>
      <div className="text-xs text-muted-foreground mb-1 flex justify-between">
        <span>{robot.task}</span>
        <span>{robot.location}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-muted rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${getBatteryColor(robot.battery)}`}
            style={{ width: `${robot.battery}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground w-10">{robot.battery}%</span>
      </div>
    </button>
  )
}

function EventItem({ event, currentTick, tickMs }: EventItemProps) {
  const isAlert = event.kind === 'alert'

  return (
    <div className={`border-l-2 py-1.5 pl-2 ${isAlert ? ALERT_BORDER[event.severity] : 'border-border'}`}>
      <div className={isAlert ? ALERT_TEXT[event.severity] : 'text-foreground'}>
        {event.message}
      </div>
      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
        {formatSimulationAge(event.tick, currentTick, tickMs)}
      </div>
    </div>
  )
}

function ControlButtons({
  onPause,
  onReset,
  onExportSnapshot,
  exportFormat,
  onExportFormatChange,
  exporting,
  exportError,
  paused
}: {
  onPause: () => void
  onReset: () => void
  onExportSnapshot: () => Promise<void>
  exportFormat: SnapshotExportFormat
  onExportFormatChange: (format: SnapshotExportFormat) => void
  exporting: boolean
  exportError: string | null
  paused: boolean
}) {
  return (
    <section className="pt-4 border-t border-border">
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={onPause} className="w-full">
          {paused ? <Play data-icon="inline-start" /> : <Pause data-icon="inline-start" />}
          {paused ? 'Resume' : 'Pause'}
        </Button>
        <Button variant="secondary" onClick={onReset} className="w-full">
          <RotateCcw data-icon="inline-start" />
          Reset
        </Button>
      </div>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <select
          aria-label="Snapshot export format"
          value={exportFormat}
          onChange={(event) => onExportFormatChange(event.target.value as SnapshotExportFormat)}
          disabled={exporting}
          className="h-8 min-w-0 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
        >
          {EXPORT_FORMATS.map((format) => (
            <option key={format.value} value={format.value}>{format.label}</option>
          ))}
        </select>
        <Button variant="default" onClick={onExportSnapshot} disabled={exporting}>
          <Download data-icon="inline-start" />
          {exporting ? 'Preparing' : 'Export'}
        </Button>
      </div>
      {exportError && (
        <p role="alert" className="mt-2 text-xs text-destructive">{exportError}</p>
      )}
    </section>
  )
}