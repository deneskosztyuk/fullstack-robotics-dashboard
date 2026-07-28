'use client'

import { useWarehouse } from '@/lib/WarehouseContext'
import { StatCard } from '@/components/ui/stat-card'
import { MetricBar } from '@/components/ui/metric-bar'
import { Badge } from '@/components/ui/badge'

const CHART_GRID_LINES = 5
const CHART_HEIGHT_BASELINE = 15
const CHART_HEIGHT_RANGE = 80

export function DashboardLeft() {
  const { robots, stats, efficiencyHistory, throughput, avgCycleTime } = useWarehouse()

  const activeRobotsCount = robots.filter(r => r.status === 'active').length
  const chargingRobotsCount = robots.filter(r => r.status === 'charging').length
  const currentEfficiency = efficiencyHistory[efficiencyHistory.length - 1] || 0

  return (
    <div className="h-full overflow-y-auto px-4 pt-4 pb-4 space-y-4">
      <section>
        <h2 className="text-lg font-bold mb-3 text-foreground flex items-center gap-2">
          <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
          System Overview
        </h2>

        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Active" value={activeRobotsCount} />
          <StatCard label="Charging" value={chargingRobotsCount} />
          <StatCard label="Completed" value={stats.completedOrders} />
        </div>
      </section>

      <section className="bg-muted/30 p-3 rounded-lg border border-border">
        <h3 className="font-semibold mb-3 text-foreground text-sm">Performance Metrics</h3>
        <div className="space-y-3">
          <MetricBar label="Efficiency" value={currentEfficiency} unit="%" />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-muted/50 p-2 rounded">
              <div className="text-muted-foreground">Throughput</div>
              <div className="text-lg font-bold text-foreground">{throughput}/min</div>
            </div>
            <div className="bg-muted/50 p-2 rounded">
              <div className="text-muted-foreground">Avg Cycle</div>
              <div className="text-lg font-bold text-foreground">{avgCycleTime.toFixed(1)}s</div>
            </div>
          </div>
        </div>
      </section>

      <FleetUtilizationChart efficiencyHistory={efficiencyHistory} />
    </div>
  )
}

function FleetUtilizationChart({ efficiencyHistory }: { efficiencyHistory: number[] }) {
  const min = Math.min(...efficiencyHistory)
  const max = Math.max(...efficiencyHistory)
  const range = max - min
  const currentEfficiency = efficiencyHistory[efficiencyHistory.length - 1]
  const previousEfficiency = efficiencyHistory[efficiencyHistory.length - 2]
  const delta = currentEfficiency - previousEfficiency

  return (
    <section className="bg-muted/30 p-3 rounded-lg border border-border">
      <h3 className="font-semibold mb-3 text-foreground text-sm">Fleet Utilization</h3>

      <div className="relative h-40 bg-muted/50 rounded-lg p-3 border border-border overflow-hidden">
        <BackgroundGrid />

        <div className="relative flex items-end justify-between gap-3 h-full">
          {efficiencyHistory.map((value, i) => (
            <EfficiencyBar
              key={i}
              value={value}
              min={min}
              range={range}
              isNewest={i === efficiencyHistory.length - 1}
              previousValue={i > 0 ? efficiencyHistory[i - 1] : null}
            />
          ))}
        </div>

        <ChartBadges min={min} max={max} delta={delta} hasHistory={efficiencyHistory.length > 1} />
      </div>

      <div className="flex justify-between text-xs text-muted-foreground mt-2">
        <span>14s ago</span>
        <span className="font-mono">Now</span>
      </div>

      <ChartSummary
        currentEfficiency={currentEfficiency}
        previousEfficiency={previousEfficiency}
        range={range}
        hasHistory={efficiencyHistory.length > 1}
      />
    </section>
  )
}

function BackgroundGrid() {
  return (
    <div className="absolute inset-0 opacity-10">
      {[...Array(CHART_GRID_LINES)].map((_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 border-b border-border"
          style={{ bottom: `${i * 20}%` }}
        />
      ))}
    </div>
  )
}

function EfficiencyBar({
  value,
  min,
  range,
  isNewest,
  previousValue
}: {
  value: number
  min: number
  range: number
  isNewest: boolean
  previousValue: number | null
}) {
  const normalizedValue = range > 0 ? (value - min) / range : 0.5
  const heightPercent = normalizedValue * CHART_HEIGHT_RANGE + CHART_HEIGHT_BASELINE

  const getTrendArrow = () => {
    if (!previousValue) return null
    if (value > previousValue) return <span className="text-success">▲</span>
    if (value < previousValue) return <span className="text-destructive">▼</span>
    return <span className="text-muted-foreground">━</span>
  }

  return (
    <div className="flex-1 flex flex-col justify-end items-center relative">
      <div className="text-xs mb-1 font-bold text-muted-foreground">
        {value.toFixed(0)}
      </div>

      <div
        className={`w-full rounded-t transition-all duration-700 relative overflow-hidden ${
          isNewest ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
        }`}
        style={{ height: `${heightPercent}%`, minHeight: '20px' }}
      >
        <div className="absolute inset-0 bg-primary" />
      </div>

      {previousValue !== null && (
        <div className="absolute -top-4 text-xs">
          {getTrendArrow()}
        </div>
      )}
    </div>
  )
}

function ChartBadges({ min, max, delta, hasHistory }: {
  min: number
  max: number
  delta: number
  hasHistory: boolean
}) {
  const deltaSign = delta >= 0 ? '+' : ''
  const deltaVariant = delta > 0 ? 'default' : delta < 0 ? 'destructive' : 'secondary'

  return (
    <>
      <div className="absolute top-2 right-3">
        <Badge variant="default">MAX: {max.toFixed(1)}%</Badge>
      </div>
      <div className="absolute bottom-2 right-3">
        <Badge variant="destructive">MIN: {min.toFixed(1)}%</Badge>
      </div>

      {hasHistory && (
        <div className="absolute top-2 left-3">
          <Badge variant={deltaVariant as "default" | "destructive" | "secondary"}>
            Δ {deltaSign}{delta.toFixed(1)}%
          </Badge>
        </div>
      )}
    </>
  )
}

function ChartSummary({
  currentEfficiency,
  previousEfficiency,
  range,
  hasHistory
}: {
  currentEfficiency: number
  previousEfficiency: number
  range: number
  hasHistory: boolean
}) {
  const trendArrow = currentEfficiency > previousEfficiency ? '▲' : currentEfficiency < previousEfficiency ? '▼' : '━'
  const trendColor = currentEfficiency > previousEfficiency ? 'text-success' : currentEfficiency < previousEfficiency ? 'text-destructive' : 'text-muted-foreground'

  return (
    <div className="mt-2 flex items-center justify-center gap-3">
      <div className="text-center">
        <div className="text-xs text-muted-foreground">Current</div>
        <div className="text-lg font-bold text-foreground">
          {currentEfficiency?.toFixed(1) || '0'}%
        </div>
      </div>

      {hasHistory && (
        <>
          <div className={`text-2xl ${trendColor}`}>
            {trendArrow}
          </div>

          <div className="text-center">
            <div className="text-xs text-muted-foreground">Range</div>
            <div className="text-sm font-semibold text-foreground">
              {range.toFixed(1)}%
            </div>
          </div>
        </>
      )}
    </div>
  )
}