'use client'

import { useState, useEffect } from 'react'
import { useWarehouse } from '@/lib/WarehouseContext'

const STATS_UPDATE_INTERVAL = 2000
const MIN_THROUGHPUT = 140
const MAX_THROUGHPUT_RANGE = 30
const MIN_CYCLE_TIME = 2.8
const MAX_CYCLE_TIME_RANGE = 1.2
const CHART_GRID_LINES = 5
const CHART_HEIGHT_BASELINE = 15
const CHART_HEIGHT_RANGE = 80

interface StatCardProps {
  label: string
  value: string | number
  color: string
  icon: string
}

interface MetricBarProps {
  label: string
  value: number
  unit: string
  color: string
}

const COLOR_CLASSES = {
  blue: 'from-blue-600 to-blue-500',
  green: 'from-green-600 to-green-500',
  purple: 'from-purple-600 to-purple-500',
  cyan: 'from-cyan-600 to-cyan-500',
  yellow: 'from-yellow-600 to-yellow-500',
  orange: 'from-orange-600 to-orange-500',
}

const METRIC_COLOR_CLASSES = {
  green: 'from-green-500 to-green-400',
  blue: 'from-blue-500 to-blue-400',
  purple: 'from-purple-500 to-purple-400',
}

export function DashboardLeft() {
  const { robots, stats, efficiencyHistory } = useWarehouse()
  
  const [localStats, setLocalStats] = useState({
    activeRobots: 4,
    idleRobots: 0,
    chargingRobots: 0,
    completedOrders: stats.completedOrders,
    pendingOrders: 18,
    efficiency: 94.2,
    uptime: 99.7,
    throughput: 156,
    avgCycleTime: 3.2,
  })
  
  useEffect(() => {
    setLocalStats(prev => ({
      ...prev,
      completedOrders: stats.completedOrders
    }))
  }, [stats.completedOrders])
  
  useEffect(() => {
    const interval = setInterval(() => {
      setLocalStats(prev => ({
        ...prev,
        efficiency: efficiencyHistory[efficiencyHistory.length - 1] || 90,
        throughput: MIN_THROUGHPUT + Math.floor(Math.random() * MAX_THROUGHPUT_RANGE),
        avgCycleTime: MIN_CYCLE_TIME + Math.random() * MAX_CYCLE_TIME_RANGE,
      }))
    }, STATS_UPDATE_INTERVAL)
    
    return () => clearInterval(interval)
  }, [efficiencyHistory])

  const activeRobotsCount = robots.filter(r => r.status === 'active').length
  const chargingRobotsCount = robots.filter(r => r.status === 'charging').length
  
  return (
    <div className="h-full overflow-y-auto px-4 pt-4 pb-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
      
      <section>
        <h2 className="text-lg font-bold mb-3 text-blue-400 flex items-center gap-2">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          System Overview
        </h2>
        
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Active" value={activeRobotsCount} color="blue" icon="🤖" />
          <StatCard label="Charging" value={chargingRobotsCount} color="yellow" icon="⚡" />
          <StatCard label="Completed" value={localStats.completedOrders} color="green" icon="✓" />
          <StatCard label="Pending" value={localStats.pendingOrders} color="orange" icon="⏳" />
        </div>
      </section>
      
      <section className="bg-gray-700/30 p-3 rounded-lg border border-gray-600">
        <h3 className="font-semibold mb-3 text-gray-200 text-sm">Performance Metrics</h3>
        <div className="space-y-3">
          <MetricBar label="Efficiency" value={localStats.efficiency} unit="%" color="green" />
          <MetricBar label="Uptime" value={localStats.uptime} unit="%" color="blue" />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-800/50 p-2 rounded">
              <div className="text-gray-400">Throughput</div>
              <div className="text-lg font-bold text-cyan-400">{localStats.throughput}/hr</div>
            </div>
            <div className="bg-gray-800/50 p-2 rounded">
              <div className="text-gray-400">Avg Cycle</div>
              <div className="text-lg font-bold text-purple-400">{localStats.avgCycleTime.toFixed(1)}m</div>
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
    <section className="bg-gray-700/30 p-3 rounded-lg border border-gray-600">
      <h3 className="font-semibold mb-3 text-gray-200 text-sm">Fleet Utilization</h3>
      
      <div className="relative h-40 bg-gray-900/60 rounded-lg p-3 border border-gray-700 overflow-hidden">
        <BackgroundGrid />
        
        <div className="relative flex items-end justify-between gap-3 h-full">
          {efficiencyHistory.map((value, i) => (
            <EfficiencyBar
              key={i}
              value={value}
              index={i}
              min={min}
              max={max}
              range={range}
              isNewest={i === efficiencyHistory.length - 1}
              previousValue={i > 0 ? efficiencyHistory[i - 1] : null}
            />
          ))}
        </div>
        
        <ChartBadges min={min} max={max} delta={delta} hasHistory={efficiencyHistory.length > 1} />
      </div>
      
      <div className="flex justify-between text-xs text-gray-500 mt-2">
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
          className="absolute left-0 right-0 border-b border-cyan-500"
          style={{ bottom: `${i * 20}%` }}
        />
      ))}
    </div>
  )
}

function EfficiencyBar({ 
  value, 
  index, 
  min, 
  max, 
  range, 
  isNewest, 
  previousValue 
}: {
  value: number
  index: number
  min: number
  max: number
  range: number
  isNewest: boolean
  previousValue: number | null
}) {
  const normalizedValue = range > 0 ? (value - min) / range : 0.5
  const heightPercent = normalizedValue * CHART_HEIGHT_RANGE + CHART_HEIGHT_BASELINE
  const isHighest = value === max
  const isLowest = value === min
  
  const getBarColor = () => {
    if (isHighest) return 'bg-gradient-to-t from-green-600 via-green-400 to-green-300'
    if (isLowest) return 'bg-gradient-to-t from-red-600 via-orange-400 to-yellow-300'
    if (isNewest) return 'bg-gradient-to-t from-cyan-600 via-cyan-400 to-cyan-200'
    return 'bg-gradient-to-t from-blue-700 via-blue-500 to-cyan-400'
  }
  
  const getLabelColor = () => {
    if (isNewest) return 'text-white scale-125 drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]'
    if (isHighest) return 'text-green-300'
    if (isLowest) return 'text-red-300'
    return 'text-cyan-300'
  }
  
  const getTrendArrow = () => {
    if (!previousValue) return null
    if (value > previousValue) return <span className="text-green-400">▲</span>
    if (value < previousValue) return <span className="text-red-400">▼</span>
    return <span className="text-gray-500">━</span>
  }
  
  return (
    <div className="flex-1 flex flex-col justify-end items-center relative">
      <div className={`text-xs mb-1 font-bold transition-all duration-300 ${getLabelColor()}`}>
        {value.toFixed(0)}
      </div>
      
      <div 
        className={`w-full rounded-t transition-all duration-700 relative overflow-hidden ${
          isNewest ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-gray-900' : ''
        }`}
        style={{ height: `${heightPercent}%`, minHeight: '20px' }}
      >
        <div className={`absolute inset-0 ${getBarColor()}`} />
        
        {isNewest && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
        )}
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
  const getDeltaColor = () => {
    if (delta > 0) return 'text-green-400'
    if (delta < 0) return 'text-red-400'
    return 'text-gray-400'
  }
  
  return (
    <>
      <div className="absolute top-2 right-3 bg-green-900/80 px-2 py-1 rounded text-[10px] font-bold text-green-200 border border-green-600">
        MAX: {max.toFixed(1)}%
      </div>
      <div className="absolute bottom-2 right-3 bg-red-900/80 px-2 py-1 rounded text-[10px] font-bold text-red-200 border border-red-600">
        MIN: {min.toFixed(1)}%
      </div>
      
      {hasHistory && (
        <div className="absolute top-2 left-3 bg-gray-900/90 px-2 py-1 rounded text-[10px] font-mono border border-gray-600">
          <span className="text-gray-400">Δ </span>
          <span className={`font-bold ${getDeltaColor()}`}>
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
          </span>
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
  const getTrendEmoji = () => {
    if (currentEfficiency > previousEfficiency) return '📈'
    if (currentEfficiency < previousEfficiency) return '📉'
    return '➡️'
  }
  
  return (
    <div className="mt-2 flex items-center justify-center gap-3">
      <div className="text-center">
        <div className="text-xs text-gray-400">Current</div>
        <div className="text-lg font-bold text-cyan-400">
          {currentEfficiency?.toFixed(1) || '0'}%
        </div>
      </div>
      
      {hasHistory && (
        <>
          <div className="text-2xl">
            {getTrendEmoji()}
          </div>
          
          <div className="text-center">
            <div className="text-xs text-gray-400">Range</div>
            <div className="text-sm font-semibold text-purple-400">
              {range.toFixed(1)}%
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, color, icon }: StatCardProps) {
  return (
    <div className={`bg-gradient-to-br ${COLOR_CLASSES[color as keyof typeof COLOR_CLASSES]} p-3 rounded-lg shadow-lg`}>
      <div className="flex justify-between items-start mb-1">
        <div className="text-white/80 text-xs font-medium">{label}</div>
        <span className="text-lg">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  )
}

function MetricBar({ label, value, unit, color }: MetricBarProps) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-100 font-semibold">{value.toFixed(1)}{unit}</span>
      </div>
      <div className="bg-gray-800 rounded-full h-2 overflow-hidden">
        <div 
          className={`h-2 bg-gradient-to-r ${METRIC_COLOR_CLASSES[color as keyof typeof METRIC_COLOR_CLASSES]} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  )
}
