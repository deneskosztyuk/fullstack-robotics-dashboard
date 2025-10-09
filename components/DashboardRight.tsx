'use client'

import { useState } from 'react'
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

export function DashboardRight() {
  const { robots } = useWarehouse()
  
  const [alerts] = useState<Alert[]>([
    { id: 1, type: 'info', message: 'System running optimally', time: '2 min ago' },
    { id: 2, type: 'warning', message: 'Robot #4 battery below 70%', time: '5 min ago' },
    { id: 3, type: 'info', message: 'Peak hours starting soon', time: '12 min ago' },
  ])
  
  const [activities] = useState<Activity[]>([
    { id: 1, robot: 1, action: 'Completed order #2891', time: '30s ago' },
    { id: 2, robot: 3, action: 'Started picking task', time: '1m ago' },
    { id: 3, robot: 2, action: 'Returned to dock', time: '2m ago' },
    { id: 4, robot: 1, action: 'Transport initiated', time: '3m ago' },
  ])
  
  return (
    <div className="h-full overflow-y-auto px-4 pt-4 pb-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
      
      {/* System Alerts */}
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
      
      {/* Robot Fleet Status */}
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
      
      {/* Recent Activity */}
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
      
      {/* Control Buttons */}
      <section className="pt-4 border-t border-gray-700">
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => {/* TODO: Pause logic */}}
            className="group relative bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 hover:border-blue-400/60 text-blue-100 py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-300 shadow-lg hover:shadow-blue-500/30 backdrop-blur"
          >
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg group-hover:scale-110 transition-transform">⏸️</span>
              <span>Pause</span>
            </div>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/0 via-blue-400/10 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          
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

// Helper components
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

function AlertItem({ alert }: { alert: { type: 'warning' | 'info' | 'error', message: string, time: string } }) {
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
