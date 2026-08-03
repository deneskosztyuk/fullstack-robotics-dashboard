'use client'

import { Boxes } from 'lucide-react'
import { useWarehouse } from '@/lib/WarehouseContext'

function formatSimulationTime(tick: number, tickMs: number): string {
  const totalSeconds = tick * tickMs / 1000
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor(totalSeconds % 3600 / 60)
  const seconds = (totalSeconds % 60).toFixed(1).padStart(4, '0')
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${seconds}`
}

export function Navbar() {
  const { navigationSnapshot, config } = useWarehouse()
  const simulationTime = formatSimulationTime(navigationSnapshot.tick, config.tickMs)
  const stateLabel = navigationSnapshot.paused ? 'Paused' : 'Running'

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95">
      <div className="mx-auto grid max-w-[1800px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-2 sm:flex sm:min-h-16 sm:gap-4 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Boxes aria-hidden="true" className="size-6 shrink-0 text-primary" strokeWidth={1.6} />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">AMR Traffic Simulator</h1>
            <p className="mt-0.5 hidden text-xs text-muted-foreground lg:block">
              Deterministic multi-robot routing and resource contention
            </p>
          </div>
        </div>

        <div className="col-span-2 flex items-center gap-2 pl-9 sm:col-span-1 sm:shrink-0 sm:pl-0">
          <span className="border border-primary/40 px-1.5 py-0.5 font-mono text-[10px] text-primary">SIMULATION</span>
          <span className="font-mono text-[10px] text-muted-foreground">SYNTHETIC DATA</span>
        </div>

        <div className="col-start-2 row-start-1 flex shrink-0 items-center gap-3 sm:ml-auto sm:gap-5">
          <div className="hidden text-right lg:block">
            <div className="text-[10px] text-muted-foreground">Scenario</div>
            <div className="text-xs font-medium text-foreground">{config.layoutName}</div>
          </div>
          <div className="text-right">
            <div className="hidden text-[10px] text-muted-foreground sm:block">Simulation time</div>
            <time className="font-mono text-xs tabular-nums text-foreground">{simulationTime}</time>
          </div>
          <div className="flex items-center gap-2 border-l border-border pl-3 sm:pl-5" aria-label={`Simulation ${stateLabel.toLowerCase()}`}>
            <span className={`size-2 ${navigationSnapshot.paused ? 'bg-warning' : 'bg-success'}`} />
            <span className="hidden text-xs font-medium text-foreground md:inline">{stateLabel}</span>
          </div>
        </div>
      </div>
    </header>
  )
}