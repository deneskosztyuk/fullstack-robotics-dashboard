'use client'

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react'

const EFFICIENCY_CALCULATION_INTERVAL = 2000
const EFFICIENCY_HISTORY_LENGTH = 7
const INITIAL_COMPLETED_ORDERS = 247
const MAX_EVENTS = 50
const THROUGHPUT_WINDOW_MS = 60000
const MAX_CYCLE_TIME_SAMPLES = 20

export type EventSeverity = 'warning' | 'info' | 'error'
export type EventKind = 'alert' | 'activity'

export interface WarehouseEvent {
  id: number
  kind: EventKind
  severity: EventSeverity
  robot?: number
  message: string
  timestamp: number
}

export interface RobotData {
  id: number
  status: 'active' | 'charging' | 'idle'
  task: string
  battery: number
  location: string
}

interface Stats {
  completedOrders: number
}

interface WarehouseContextType {
  robots: RobotData[]
  updateRobot: (id: number, data: Partial<RobotData>) => void
  stats: Stats
  incrementOrders: () => number
  efficiencyHistory: number[]
  events: WarehouseEvent[]
  logEvent: (event: Omit<WarehouseEvent, 'id' | 'timestamp'>) => void
  paused: boolean
  togglePause: () => void
  resetCounter: number
  reset: () => void
  throughput: number
  avgCycleTime: number
  recordCycleTime: (durationSec: number) => void
}

interface WarehouseProviderProps {
  children: ReactNode
}

const INITIAL_ROBOTS: RobotData[] = [
  { id: 1, status: 'active', task: 'Idle', battery: 87, location: 'Dock' },
  { id: 2, status: 'active', task: 'Idle', battery: 92, location: 'Dock' },
  { id: 3, status: 'active', task: 'Idle', battery: 78, location: 'Dock' },
  { id: 4, status: 'active', task: 'Idle', battery: 65, location: 'Dock' },
]

const INITIAL_EFFICIENCY_HISTORY: number[] = Array.from(
  { length: EFFICIENCY_HISTORY_LENGTH },
  () => calculateFleetEfficiency(INITIAL_ROBOTS)
)

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
    completedOrders: INITIAL_COMPLETED_ORDERS
  })
  const completedOrdersRef = useRef(INITIAL_COMPLETED_ORDERS)
  const orderTimestampsRef = useRef<number[]>([])
  const cycleTimesRef = useRef<number[]>([])
  const [efficiencyHistory, setEfficiencyHistory] = useState<number[]>(INITIAL_EFFICIENCY_HISTORY)
  const [events, setEvents] = useState<WarehouseEvent[]>([])
  const eventIdRef = useRef(0)
  const [paused, setPaused] = useState(false)
  const [resetCounter, setResetCounter] = useState(0)
  const [throughput, setThroughput] = useState(0)
  const [avgCycleTime, setAvgCycleTime] = useState(0)

  const robotsRef = useRef(robots)
  useEffect(() => {
    robotsRef.current = robots
  }, [robots])

  const pausedRef = useRef(false)
  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  const updateRobot = useCallback((id: number, data: Partial<RobotData>) => {
    setRobots(prev => prev.map(robot => 
      robot.id === id ? { ...robot, ...data } : robot
    ))
  }, [])

  const incrementOrders = useCallback(() => {
    completedOrdersRef.current += 1
    const newCount = completedOrdersRef.current
    orderTimestampsRef.current.push(Date.now())
    setStats(prev => ({ 
      ...prev, 
      completedOrders: newCount 
    }))
    return newCount
  }, [])

  const recordCycleTime = useCallback((durationSec: number) => {
    cycleTimesRef.current.push(durationSec)
    if (cycleTimesRef.current.length > MAX_CYCLE_TIME_SAMPLES) {
      cycleTimesRef.current.shift()
    }
  }, [])

  const logEvent = useCallback((event: Omit<WarehouseEvent, 'id' | 'timestamp'>) => {
    const id = eventIdRef.current++
    const fullEvent: WarehouseEvent = {
      ...event,
      id,
      timestamp: Date.now(),
    }
    setEvents(prev => [...prev, fullEvent].slice(-MAX_EVENTS))
  }, [])

  const togglePause = useCallback(() => {
    setPaused(p => !p)
  }, [])

  const reset = useCallback(() => {
    setPaused(false)
    setResetCounter(c => c + 1)
    setRobots(INITIAL_ROBOTS)
    completedOrdersRef.current = INITIAL_COMPLETED_ORDERS
    orderTimestampsRef.current = []
    cycleTimesRef.current = []
    setStats({ completedOrders: INITIAL_COMPLETED_ORDERS })
    setEvents([])
    setEfficiencyHistory(INITIAL_EFFICIENCY_HISTORY)
    setThroughput(0)
    setAvgCycleTime(0)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      if (pausedRef.current) return
      const efficiency = calculateFleetEfficiency(robotsRef.current)
      setEfficiencyHistory(prev => [
        ...prev.slice(-(EFFICIENCY_HISTORY_LENGTH - 1)),
        efficiency,
      ])

      const now = Date.now()
      orderTimestampsRef.current = orderTimestampsRef.current.filter(t => now - t <= THROUGHPUT_WINDOW_MS)
      setThroughput(orderTimestampsRef.current.length)

      const cycles = cycleTimesRef.current
      if (cycles.length > 0) {
        const avg = cycles.reduce((sum, c) => sum + c, 0) / cycles.length
        setAvgCycleTime(avg)
      }
    }, EFFICIENCY_CALCULATION_INTERVAL)
    
    return () => clearInterval(interval)
  }, [])

  const contextValue: WarehouseContextType = {
    robots,
    updateRobot,
    stats,
    incrementOrders,
    efficiencyHistory,
    events,
    logEvent,
    paused,
    togglePause,
    resetCounter,
    reset,
    throughput,
    avgCycleTime,
    recordCycleTime
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
