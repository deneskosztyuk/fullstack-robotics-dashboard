'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

const EFFICIENCY_CALCULATION_INTERVAL = 2000
const EFFICIENCY_HISTORY_LENGTH = 7
const INITIAL_COMPLETED_ORDERS = 247
const TOTAL_ROBOTS = 4

export interface RobotData {
  id: number
  status: 'active' | 'charging' | 'idle'
  task: string
  battery: number
  location: string
  speed: number
}

interface Stats {
  completedOrders: number
  activeRobots: number
}

interface WarehouseContextType {
  robots: RobotData[]
  updateRobot: (id: number, data: Partial<RobotData>) => void
  stats: Stats
  incrementOrders: () => void
  efficiencyHistory: number[]
}

interface WarehouseProviderProps {
  children: ReactNode
}

const INITIAL_ROBOTS: RobotData[] = [
  { id: 1, status: 'active', task: 'Idle', battery: 87, location: 'Dock', speed: 1.2 },
  { id: 2, status: 'active', task: 'Idle', battery: 92, location: 'Dock', speed: 0.8 },
  { id: 3, status: 'active', task: 'Idle', battery: 78, location: 'Dock', speed: 1.5 },
  { id: 4, status: 'active', task: 'Idle', battery: 65, location: 'Dock', speed: 1.0 },
]

const INITIAL_EFFICIENCY_HISTORY: number[] = [85, 88, 90, 87, 92, 89, 91]

const WarehouseContext = createContext<WarehouseContextType | undefined>(undefined)

function calculateFleetEfficiency(robots: RobotData[]): number {
  const activeCount = robots.filter(r => r.status === 'active').length
  const totalRobots = robots.length
  const avgBattery = robots.reduce((sum, r) => sum + r.battery, 0) / totalRobots
  
  const utilization = (activeCount / totalRobots) * 100
  const batteryFactor = avgBattery / 100
  
  return utilization * batteryFactor
}

export function WarehouseProvider({ children }: WarehouseProviderProps) {
  const [robots, setRobots] = useState<RobotData[]>(INITIAL_ROBOTS)
  const [stats, setStats] = useState<Stats>({
    completedOrders: INITIAL_COMPLETED_ORDERS,
    activeRobots: TOTAL_ROBOTS
  })
  const [efficiencyHistory, setEfficiencyHistory] = useState<number[]>(INITIAL_EFFICIENCY_HISTORY)

  const updateRobot = (id: number, data: Partial<RobotData>) => {
    setRobots(prev => prev.map(robot => 
      robot.id === id ? { ...robot, ...data } : robot
    ))
  }

  const incrementOrders = () => {
    setStats(prev => ({ 
      ...prev, 
      completedOrders: prev.completedOrders + 1 
    }))
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setRobots(currentRobots => {
        const efficiency = calculateFleetEfficiency(currentRobots)
        
        setEfficiencyHistory(prev => {
          const newHistory = [...prev.slice(-(EFFICIENCY_HISTORY_LENGTH - 1)), efficiency]
          return newHistory
        })
        
        return currentRobots
      })
    }, EFFICIENCY_CALCULATION_INTERVAL)
    
    return () => clearInterval(interval)
  }, [])

  const contextValue: WarehouseContextType = {
    robots,
    updateRobot,
    stats,
    incrementOrders,
    efficiencyHistory
  }

  return (
    <WarehouseContext.Provider value={contextValue}>
      {children}
    </WarehouseContext.Provider>
  )
}

export function useWarehouse(): WarehouseContextType {
  const context = useContext(WarehouseContext)
  
  if (!context) {
    throw new Error('useWarehouse must be used within WarehouseProvider')
  }
  
  return context
}
