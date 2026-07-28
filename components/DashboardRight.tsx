'use client'

import { useState, useEffect } from 'react'
import { useWarehouse, WarehouseEvent } from '@/lib/WarehouseContext'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Download, Minus, Pause, Play, Plus, RotateCcw } from 'lucide-react'
import type { LayoutId, SimulationSpeed } from '@/lib/nav'

const BATTERY_HIGH_THRESHOLD = 70
const BATTERY_MEDIUM_THRESHOLD = 40
const MAX_DISPLAYED_ALERTS = 3
const MAX_DISPLAYED_ACTIVITIES = 4
const RELATIVE_TIME_TICK_MS = 1000

interface AlertItemProps {
  alert: WarehouseEvent
  now: number
}

interface RobotCardProps {
  robot: {
    id: number
    status: string
    task: string
    location: string
    battery: number
  }
}

interface ActivityItemProps {
  activity: WarehouseEvent
  now: number
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

function formatRelativeTime(timestamp: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function DashboardRight() {
  const {
    robots,
    events,
    stats,
    efficiencyHistory,
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
  } = useWarehouse()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), RELATIVE_TIME_TICK_MS)
    return () => clearInterval(timer)
  }, [])

  const alerts = events
    .filter(e => e.kind === 'alert')
    .slice(-MAX_DISPLAYED_ALERTS)
    .reverse()
  const activities = events
    .filter(e => e.kind === 'activity')
    .slice(-MAX_DISPLAYED_ACTIVITIES)
    .reverse()

  const handleGenerateReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      stats,
      robots,
      efficiencyHistory,
      simulation: {
        layout,
        speed,
        desiredRobotCount: robotCount,
        actualRobotCount,
      },
      recentEvents: events.slice(-10),
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `warehouse-report-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-full overflow-y-auto px-4 pt-4 pb-4 space-y-4">

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

      <section>
        <h3 className="font-semibold mb-2 text-foreground text-sm">
          System Alerts
        </h3>
        <div className="space-y-1">
          {alerts.length === 0 ? (
            <div className="p-2 rounded border text-xs border-border text-muted-foreground bg-muted/30">
              No alerts
            </div>
          ) : (
            alerts.map(alert => (
              <AlertItem key={alert.id} alert={alert} now={now} />
            ))
          )}
        </div>
      </section>

      <section>
        <h3 className="font-semibold mb-2 text-foreground text-sm">Robot Fleet Status</h3>
        <div className="space-y-1.5">
          {robots.map(robot => (
            <RobotCard key={robot.id} robot={robot} />
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-semibold mb-2 text-foreground text-sm">Recent Activity</h3>
        <div className="space-y-1 text-xs">
          {activities.length === 0 ? (
            <div className="p-2 rounded text-muted-foreground bg-muted/30">
              No recent activity
            </div>
          ) : (
            activities.map(activity => (
              <ActivityItem key={activity.id} activity={activity} now={now} />
            ))
          )}
        </div>
      </section>

      <ControlButtons
        onPause={togglePause}
        onReset={reset}
        onGenerateReport={handleGenerateReport}
        paused={paused}
      />

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
    <section>
      <h3 className="font-semibold mb-2 text-foreground text-sm">Fleet Controls</h3>
      <div className="space-y-3 bg-muted/30 border border-border rounded-lg p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-foreground">Robots</div>
            <div className="text-xs text-muted-foreground">
              {actualRobotCount === robotCount
                ? `${actualRobotCount} active`
                : `${actualRobotCount} active · target ${robotCount}`}
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

function RobotCard({ robot }: RobotCardProps) {
  const getBatteryColor = (battery: number) => {
    if (battery > BATTERY_HIGH_THRESHOLD) return 'bg-success'
    if (battery > BATTERY_MEDIUM_THRESHOLD) return 'bg-warning'
    return 'bg-destructive'
  }

  return (
    <div className="bg-muted/30 p-2.5 rounded-lg border border-border hover:border-primary/50 transition-colors">
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
    </div>
  )
}

function ActivityItem({ activity, now }: ActivityItemProps) {
  return (
    <div className="bg-muted/30 p-2 rounded flex justify-between items-center">
      <div>
        <span className="text-primary font-semibold">R{activity.robot}</span>
        <span className="text-foreground ml-2">{activity.message}</span>
      </div>
      <span className="text-muted-foreground text-xs">{formatRelativeTime(activity.timestamp, now)}</span>
    </div>
  )
}

function ControlButtons({
  onPause,
  onReset,
  onGenerateReport,
  paused
}: {
  onPause: () => void
  onReset: () => void
  onGenerateReport: () => void
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
      <Button variant="default" onClick={onGenerateReport} className="w-full mt-3">
        <Download data-icon="inline-start" />
        Generate Report
      </Button>
    </section>
  )
}

function AlertItem({ alert, now }: AlertItemProps) {
  return (
    <div className={`p-2 rounded border text-xs ${ALERT_BORDER[alert.severity]}`}>
      <div className="flex items-start gap-2">
        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${ALERT_TEXT[alert.severity].replace('text-', 'bg-')}`} />
        <div className="flex-1">
          <div className={`font-medium ${ALERT_TEXT[alert.severity]}`}>{alert.message}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{formatRelativeTime(alert.timestamp, now)}</div>
        </div>
      </div>
    </div>
  )
}