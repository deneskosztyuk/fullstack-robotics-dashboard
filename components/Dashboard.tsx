'use client'

import { useState, useEffect } from 'react'
import { useWarehouse } from '@/lib/WarehouseContext'

interface Alert {
  id: number
  type: 'warning' | 'info' | 'error'
  message: string
  time: string
}

interface Activity {
  id: number
  robot: number
  action: string
  time: string
}

export default function Dashboard() {
  const { robots, stats, efficiencyHistory } = useWarehouse() // ADDED efficiencyHistory
  
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
  
  const [alerts, setAlerts] = useState<Alert[]>([
    { id: 1, type: 'info', message: 'System running optimally', time: '2 min ago' },
    { id: 2, type: 'warning', message: 'Robot #4 battery below 70%', time: '5 min ago' },
    { id: 3, type: 'info', message: 'Peak hours starting soon', time: '12 min ago' },
  ])
  
  const [activities, setActivities] = useState<Activity[]>([
    { id: 1, robot: 1, action: 'Completed order #2891', time: '30s ago' },
    { id: 2, robot: 3, action: 'Started picking task', time: '1m ago' },
    { id: 3, robot: 2, action: 'Returned to dock', time: '2m ago' },
    { id: 4, robot: 1, action: 'Transport initiated', time: '3m ago' },
  ])
  
  // REMOVED: const [performanceData, setPerformanceData] = useState([92, 94, 91, 95, 94, 96, 94])
  
  useEffect(() => {
    setLocalStats(prev => ({
      ...prev,
      completedOrders: stats.completedOrders
    }))
  }, [stats.completedOrders])
  
  // UPDATED: Use real efficiency from context
  useEffect(() => {
    const interval = setInterval(() => {
      setLocalStats(prev => ({
        ...prev,
        efficiency: efficiencyHistory[efficiencyHistory.length - 1] || 90,
        throughput: 140 + Math.floor(Math.random() * 30),
        avgCycleTime: 2.8 + Math.random() * 1.2,
      }))
    }, 2000)
    
    return () => clearInterval(interval)
  }, [efficiencyHistory])
  
  return (
    <div className="h-full overflow-y-auto px-4 pt-4 pb-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
      
      <section>
        <h2 className="text-lg font-bold mb-3 text-blue-400 flex items-center gap-2">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
          System Overview
        </h2>
        
        <div className="grid grid-cols-2 gap-2 mb-3">
          <StatCard label="Active" value={robots.filter(r => r.status === 'active').length} color="blue" icon="🤖" />
          <StatCard label="Charging" value={robots.filter(r => r.status === 'charging').length} color="yellow" icon="⚡" />
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
      
      {/* ULTRA-DRAMATIC VERSION WITH EXTRA VISUAL CUES */}
        <section className="bg-gray-700/30 p-3 rounded-lg border border-gray-600">
        <h3 className="font-semibold mb-3 text-gray-200 text-sm">Fleet Utilization</h3>
    
        
        <div className="relative h-40 bg-gray-900/60 rounded-lg p-3 border border-gray-700 overflow-hidden">
            {/* Animated background grid */}
            <div className="absolute inset-0 opacity-10">
            {[...Array(5)].map((_, i) => (
                <div 
                key={i} 
                className="absolute left-0 right-0 border-b border-cyan-500"
                style={{ bottom: `${i * 20}%` }}
                />
            ))}
            </div>
            
            <div className="relative flex items-end justify-between gap-3 h-full">
            {efficiencyHistory.map((value, i) => {
                const min = Math.min(...efficiencyHistory)
                const max = Math.max(...efficiencyHistory)
                const range = max - min
                
                // Calculate normalized position (0-1)
                const normalizedValue = range > 0 ? (value - min) / range : 0.5
                
                // Map to 15%-95% of chart height for maximum visibility
                const heightPercent = normalizedValue * 80 + 15
                
                const isNewest = i === efficiencyHistory.length - 1
                const isHighest = value === max
                const isLowest = value === min
                
                return (
                <div key={i} className="flex-1 flex flex-col justify-end items-center relative">
                    {/* Value label with enhanced visibility */}
                    <div className={`text-xs mb-1 font-bold transition-all duration-300 ${
                    isNewest ? 'text-white scale-125 drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]' : 
                    isHighest ? 'text-green-300' :
                    isLowest ? 'text-red-300' :
                    'text-cyan-300'
                    }`}>
                    {value.toFixed(0)}
                    </div>
                    
                    {/* Bar with extreme drama */}
                    <div 
                    className={`w-full rounded-t transition-all duration-700 relative overflow-hidden ${
                        isNewest ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-gray-900' : ''
                    }`}
                    style={{ 
                        height: `${heightPercent}%`,
                        minHeight: '20px'
                    }}
                    >
                    {/* Gradient based on value */}
                    <div className={`absolute inset-0 ${
                        isHighest ? 'bg-gradient-to-t from-green-600 via-green-400 to-green-300' :
                        isLowest ? 'bg-gradient-to-t from-red-600 via-orange-400 to-yellow-300' :
                        isNewest ? 'bg-gradient-to-t from-cyan-600 via-cyan-400 to-cyan-200' :
                        'bg-gradient-to-t from-blue-700 via-blue-500 to-cyan-400'
                    }`} />
                    
                    {/* Shine effect on newest */}
                    {isNewest && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                    )}
                    
                    {/* Glow effect */}
                    <div className={`absolute inset-0 ${
                        isNewest ? 'shadow-[0_0_20px_rgba(0,255,255,0.6)]' :
                        isHighest ? 'shadow-[0_0_10px_rgba(34,197,94,0.4)]' :
                        isLowest ? 'shadow-[0_0_10px_rgba(239,68,68,0.4)]' :
                        ''
                    }`} />
                    </div>
                    
                    {/* Change indicator arrow */}
                    {i > 0 && (
                    <div className="absolute -top-4 text-xs">
                        {value > efficiencyHistory[i - 1] ? (
                        <span className="text-green-400">▲</span>
                        ) : value < efficiencyHistory[i - 1] ? (
                        <span className="text-red-400">▼</span>
                        ) : (
                        <span className="text-gray-500">━</span>
                        )}
                    </div>
                    )}
                </div>
                )
            })}
            </div>
            
            {/* Enhanced range indicators */}
            <div className="absolute top-2 right-3 bg-green-900/80 px-2 py-1 rounded text-[10px] font-bold text-green-200 border border-green-600">
            MAX: {Math.max(...efficiencyHistory).toFixed(1)}%
            </div>
            <div className="absolute bottom-2 right-3 bg-red-900/80 px-2 py-1 rounded text-[10px] font-bold text-red-200 border border-red-600">
            MIN: {Math.min(...efficiencyHistory).toFixed(1)}%
            </div>
            
            {/* Delta indicator */}
            {efficiencyHistory.length > 1 && (
            <div className="absolute top-2 left-3 bg-gray-900/90 px-2 py-1 rounded text-[10px] font-mono border border-gray-600">
                <span className="text-gray-400">Δ </span>
                <span className={`font-bold ${
                efficiencyHistory[efficiencyHistory.length - 1] > efficiencyHistory[efficiencyHistory.length - 2]
                    ? 'text-green-400'
                    : efficiencyHistory[efficiencyHistory.length - 1] < efficiencyHistory[efficiencyHistory.length - 2]
                    ? 'text-red-400'
                    : 'text-gray-400'
                }`}>
                {(efficiencyHistory[efficiencyHistory.length - 1] - efficiencyHistory[efficiencyHistory.length - 2] >= 0 ? '+' : '')}
                {(efficiencyHistory[efficiencyHistory.length - 1] - efficiencyHistory[efficiencyHistory.length - 2]).toFixed(1)}%
                </span>
            </div>
            )}
        </div>
        
        <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>14s ago</span>
            <span className="font-mono">Now</span>
        </div>
        
        <div className="mt-2 flex items-center justify-center gap-3">
            <div className="text-center">
            <div className="text-xs text-gray-400">Current</div>
            <div className="text-lg font-bold text-cyan-400">
                {efficiencyHistory[efficiencyHistory.length - 1]?.toFixed(1) || '0'}%
            </div>
            </div>
            
            {efficiencyHistory.length > 1 && (
            <>
                <div className="text-2xl">
                {efficiencyHistory[efficiencyHistory.length - 1] > efficiencyHistory[efficiencyHistory.length - 2]
                    ? '📈'
                    : efficiencyHistory[efficiencyHistory.length - 1] < efficiencyHistory[efficiencyHistory.length - 2]
                    ? '📉'
                    : '➡️'}
                </div>
                
                <div className="text-center">
                <div className="text-xs text-gray-400">Range</div>
                <div className="text-sm font-semibold text-purple-400">
                    {(Math.max(...efficiencyHistory) - Math.min(...efficiencyHistory)).toFixed(1)}%
                </div>
                </div>
            </>
            )}
        </div>
        </section>




      
      <section>
        <h3 className="font-semibold mb-2 text-gray-200 text-sm flex items-center gap-2">
          <span className="text-yellow-400">⚠️</span>
          System Alerts
        </h3>
        <div className="space-y-1">
          {alerts.slice(0, 3).map(alert => (
            <AlertItem key={alert.id} alert={alert} />
          ))}
        </div>
      </section>
      
      <section>
        <h3 className="font-semibold mb-2 text-gray-200 text-sm">Robot Fleet Status</h3>
        <div className="space-y-1.5">
          {robots.map(robot => (
            <div key={robot.id} className="bg-gray-700/40 p-2.5 rounded-lg border border-gray-600/50 hover:border-blue-500/50 transition-colors">
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-semibold text-white text-sm">Robot #{robot.id}</span>
                <StatusBadge status={robot.status} />
              </div>
              <div className="text-xs text-gray-400 mb-1 flex justify-between">
                <span>{robot.task}</span>
                <span>{robot.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-600 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full transition-all ${
                      robot.battery > 70 ? 'bg-gradient-to-r from-green-400 to-green-500' :
                      robot.battery > 40 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' :
                      'bg-gradient-to-r from-red-400 to-red-500'
                    }`}
                    style={{ width: `${robot.battery}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-10">{robot.battery}%</span>
              </div>
            </div>
          ))}
        </div>
      </section>
      
      <section>
        <h3 className="font-semibold mb-2 text-gray-200 text-sm">Recent Activity</h3>
        <div className="space-y-1 text-xs">
          {activities.map(activity => (
            <div key={activity.id} className="bg-gray-800/40 p-2 rounded flex justify-between items-center">
              <div>
                <span className="text-blue-400 font-semibold">R{activity.robot}</span>
                <span className="text-gray-300 ml-2">{activity.action}</span>
              </div>
              <span className="text-gray-500 text-xs">{activity.time}</span>
            </div>
          ))}
        </div>
      </section>
      
      {/* BUTTONS AS REGULAR SECTION - SCROLLS WITH CONTENT */}
      <section className="pt-4 border-t border-gray-700">
        <div className="grid grid-cols-2 gap-3">
          {/* Pause All Button */}
          <button 
            onClick={() => {/* TODO: Pause logic */}}
            className="group relative bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 hover:border-blue-400/60 text-blue-100 py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-300 shadow-lg hover:shadow-blue-500/30 backdrop-blur"
          >
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg group-hover:scale-110 transition-transform">⏸️</span>
              <span>Pause All</span>
            </div>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/0 via-blue-400/10 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          
          {/* Reset Button */}
          <button 
            onClick={() => {/* TODO: Reset logic */}}
            className="group relative bg-gray-600/20 hover:bg-gray-600/30 border border-gray-500/40 hover:border-gray-400/60 text-gray-100 py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-300 shadow-lg hover:shadow-gray-500/30 backdrop-blur"
          >
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg group-hover:rotate-180 transition-transform duration-500">🔄</span>
              <span>Reset</span>
            </div>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-gray-500/0 via-gray-400/10 to-gray-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>
        
        {/* Generate Report Button */}
        <button 
          onClick={() => {/* TODO: Report generation logic */}}
          className="group relative w-full mt-3 bg-gradient-to-r from-purple-600/30 to-pink-600/30 hover:from-purple-600/40 hover:to-pink-600/40 border border-purple-500/50 hover:border-purple-400/70 text-white py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-300 shadow-lg hover:shadow-purple-500/40 backdrop-blur overflow-hidden"
        >
          <div className="relative z-10 flex items-center justify-center gap-2">
            <span className="text-lg group-hover:scale-110 transition-transform">📊</span>
            <span>Generate Report</span>
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        </button>
      </section>
      
    </div>
  )
}

// Keep all helper components exactly the same...
function StatCard({ label, value, color, icon }: { label: string, value: string | number, color: string, icon: string }) {
  const colorClasses = {
    blue: 'from-blue-600 to-blue-500',
    green: 'from-green-600 to-green-500',
    purple: 'from-purple-600 to-purple-500',
    cyan: 'from-cyan-600 to-cyan-500',
    yellow: 'from-yellow-600 to-yellow-500',
    orange: 'from-orange-600 to-orange-500',
  }
  
  return (
    <div className={`bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} p-3 rounded-lg shadow-lg`}>
      <div className="flex justify-between items-start mb-1">
        <div className="text-white/80 text-xs font-medium">{label}</div>
        <span className="text-lg">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  )
}

function MetricBar({ label, value, unit, color }: { label: string, value: number, unit: string, color: string }) {
  const colorClasses = {
    green: 'from-green-500 to-green-400',
    blue: 'from-blue-500 to-blue-400',
    purple: 'from-purple-500 to-purple-400',
  }
  
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-100 font-semibold">{value.toFixed(1)}{unit}</span>
      </div>
      <div className="bg-gray-800 rounded-full h-2 overflow-hidden">
        <div 
          className={`h-2 bg-gradient-to-r ${colorClasses[color as keyof typeof colorClasses]} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    active: 'bg-green-600 text-white',
    charging: 'bg-yellow-600 text-white',
    idle: 'bg-gray-600 text-white',
    error: 'bg-red-600 text-white',
  }
  
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${styles[status as keyof typeof styles] || styles.idle}`}>
      {status.toUpperCase()}
    </span>
  )
}

function AlertItem({ alert }: { alert: Alert }) {
  const styles = {
    warning: 'bg-yellow-900/30 border-yellow-600/50 text-yellow-200',
    info: 'bg-blue-900/30 border-blue-600/50 text-blue-200',
    error: 'bg-red-900/30 border-red-600/50 text-red-200',
  }
  
  const icons = {
    warning: '⚠️',
    info: 'ℹ️',
    error: '❌',
  }
  
  return (
    <div className={`p-2 rounded border text-xs ${styles[alert.type]}`}>
      <div className="flex items-start gap-2">
        <span>{icons[alert.type]}</span>
        <div className="flex-1">
          <div className="font-medium">{alert.message}</div>
          <div className="text-xs opacity-70 mt-0.5">{alert.time}</div>
        </div>
      </div>
    </div>
  )
}
