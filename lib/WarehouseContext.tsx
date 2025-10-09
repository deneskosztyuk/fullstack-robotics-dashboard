'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface RobotData {
  id: number
  status: 'active' | 'charging' | 'idle'
  task: string
  battery: number
  location: string
  speed: number
}

interface WarehouseContextType {
  robots: RobotData[]
  updateRobot: (id: number, data: Partial<RobotData>) => void
  stats: {
    completedOrders: number
    activeRobots: number
  }
  incrementOrders: () => void
  efficiencyHistory: number[]
}

const WarehouseContext = createContext<WarehouseContextType | undefined>(undefined)

export function WarehouseProvider({ children }: { children: ReactNode }) {
  const [robots, setRobots] = useState<RobotData[]>([
    { id: 1, status: 'active', task: 'Idle', battery: 87, location: 'Dock', speed: 1.2 },
    { id: 2, status: 'active', task: 'Idle', battery: 92, location: 'Dock', speed: 0.8 },
    { id: 3, status: 'active', task: 'Idle', battery: 78, location: 'Dock', speed: 1.5 },
    { id: 4, status: 'active', task: 'Idle', battery: 65, location: 'Dock', speed: 1.0 },
  ])

  const [stats, setStats] = useState({
    completedOrders: 247,
    activeRobots: 4
  })

  const [efficiencyHistory, setEfficiencyHistory] = useState<number[]>([85, 88, 90, 87, 92, 89, 91])

  const updateRobot = (id: number, data: Partial<RobotData>) => {
    setRobots(prev => prev.map(robot => 
      robot.id === id ? { ...robot, ...data } : robot
    ))
  }

  const incrementOrders = () => {
    setStats(prev => ({ ...prev, completedOrders: prev.completedOrders + 1 }))
  }

  // Calculate fleet efficiency every 2 seconds - FIXED VERSION
  useEffect(() => {
    const interval = setInterval(() => {
      // Get current robot state from the closure
      setRobots(currentRobots => {
        // Calculate using current robot data
        const activeCount = currentRobots.filter(r => r.status === 'active').length
        const totalRobots = currentRobots.length
        const avgBattery = currentRobots.reduce((sum, r) => sum + r.battery, 0) / totalRobots
        
        // Fleet utilization: percentage of active robots weighted by battery health
        const utilization = (activeCount / totalRobots) * 100
        const batteryFactor = avgBattery / 100
        const efficiency = utilization * batteryFactor
        
        // Update efficiency history
        setEfficiencyHistory(prev => {
          const newHistory = [...prev.slice(-6), efficiency] // Keep last 7 points
          return newHistory
        })
        
        // Return robots unchanged (we're just reading them)
        return currentRobots
      })
    }, 2000)
    
    return () => clearInterval(interval)
  }, []) // Empty dependency - interval continuously reads current state

  return (
    <WarehouseContext.Provider value={{ robots, updateRobot, stats, incrementOrders, efficiencyHistory }}>
      {children}
    </WarehouseContext.Provider>
  )
}

export function useWarehouse() {
  const context = useContext(WarehouseContext)
  if (!context) throw new Error('useWarehouse must be used within WarehouseProvider')
  return context
}
