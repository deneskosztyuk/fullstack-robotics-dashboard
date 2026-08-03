'use client'

import { useWarehouse } from '@/lib/WarehouseContext'

const WAITING_TASKS = new Set(['idle', 'wait_dock', 'wait_path'])
const CHARGING_TASKS = new Set(['to_charge', 'charging'])

export function DashboardLeft() {
  const { navigationSnapshot } = useWarehouse()
  const { robots } = navigationSnapshot
  const waitingCount = robots.filter((robot) => WAITING_TASKS.has(robot.kind)).length
  const chargingCount = robots.filter((robot) => CHARGING_TASKS.has(robot.kind)).length
  const executingCount = robots.length - waitingCount - chargingCount
  const meanBattery = robots.length === 0
    ? 0
    : robots.reduce((sum, robot) => sum + robot.battery, 0) / robots.length
  const cycleDetail = navigationSnapshot.cycleSampleCount === 0
    ? 'No completed cycles'
    : `${navigationSnapshot.cycleSampleCount} completed cycles`

  return (
    <section aria-labelledby="fleet-metrics-heading" className="px-4 py-3">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 id="fleet-metrics-heading" className="text-xs font-semibold uppercase text-muted-foreground">
          Current fleet
        </h2>
        <span className="font-mono text-[11px] text-muted-foreground">SIM TICK {navigationSnapshot.tick}</span>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-4 xl:grid-cols-7">
        <Metric label="Executing" value={executingCount} detail="Current state" tone="success" />
        <Metric label="Waiting" value={waitingCount} detail="Route or resource" tone="warning" />
        <Metric label="Charging" value={chargingCount} detail="Travel or charge" />
        <Metric label="Delivered" value={navigationSnapshot.completedOrders} detail="Since reset" />
        <Metric label="Last 60 sim s" value={navigationSnapshot.deliveriesLast60Seconds} detail="Completed deliveries" />
        <Metric label="Mean cycle" value={`${navigationSnapshot.avgCycleSeconds.toFixed(1)}s`} detail={cycleDetail} />
        <Metric label="Mean battery" value={`${meanBattery.toFixed(0)}%`} detail={`${robots.length} robots`} />
      </div>
    </section>
  )
}

function Metric({
  label,
  value,
  detail,
  tone = 'default',
}: {
  label: string
  value: string | number
  detail: string
  tone?: 'default' | 'success' | 'warning'
}) {
  const valueColor = tone === 'success'
    ? 'text-success'
    : tone === 'warning'
      ? 'text-warning'
      : 'text-foreground'

  return (
    <div className="min-w-0 bg-background px-3 py-3">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-xl font-semibold tabular-nums ${valueColor}`}>{value}</div>
      <div className="mt-1 truncate text-[10px] text-muted-foreground" title={detail}>{detail}</div>
    </div>
  )
}