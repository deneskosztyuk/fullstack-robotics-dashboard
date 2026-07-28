'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  LAYOUT_PRESETS,
  NavigationEngine,
  createWarehouseConfig,
  locationForCell,
  statusForTask,
  type EngineEvent,
  type EngineSnapshot,
  type LayoutId,
  type LayoutPreset,
  type RobotRenderPose,
  type SimulationSpeed,
  type WarehouseConfig,
} from '@/lib/nav'

const MAX_EVENTS = 50

export type EventSeverity = 'warning' | 'info' | 'error'
export type EventKind = 'alert' | 'activity'

export interface WarehouseEvent {
  id: number
  kind: EventKind
  severity: EventSeverity
  robot?: number
  message: string
  timestamp: number
  tick: number
}

export interface RobotData {
  id: number
  status: 'active' | 'charging' | 'idle'
  task: string
  battery: number
  location: string
  retireWhenParked: boolean
}

interface Stats {
  completedOrders: number
}

interface WarehouseContextType {
  robots: RobotData[]
  stats: Stats
  efficiencyHistory: number[]
  events: WarehouseEvent[]
  paused: boolean
  togglePause: () => void
  reset: () => void
  throughput: number
  avgCycleTime: number
  robotCount: number
  actualRobotCount: number
  maxRobotCount: number
  canAddRobot: boolean
  setRobotCount: (count: number) => void
  layout: LayoutId
  layouts: readonly LayoutPreset[]
  setLayout: (layout: LayoutId) => void
  speed: SimulationSpeed
  setSpeed: (speed: SimulationSpeed) => void
  navigationSnapshot: EngineSnapshot
  config: WarehouseConfig
  getRobotPose: (id: number) => RobotRenderPose | undefined
}

interface WarehouseProviderProps {
  children: ReactNode
}

const WarehouseContext = createContext<WarehouseContextType | undefined>(undefined)

function mapEvent(event: EngineEvent): WarehouseEvent {
  return {
    ...event,
    timestamp: Date.now(),
  }
}

export function WarehouseProvider({ children }: WarehouseProviderProps) {
  const [engine] = useState(() => new NavigationEngine(createWarehouseConfig()))

  const [navigationSnapshot, setNavigationSnapshot] = useState(() => engine.getSnapshot())
  const [config, setConfig] = useState(() => engine.getConfig())
  const [events, setEvents] = useState<WarehouseEvent[]>([])

  useEffect(() => engine.subscribe(setNavigationSnapshot), [engine])

  useEffect(
    () => engine.subscribeEvents((event) => {
      setEvents((previous) => [...previous, mapEvent(event)].slice(-MAX_EVENTS))
    }),
    [engine]
  )

  useEffect(() => {
    let animationFrame = 0
    let previousTime = performance.now()

    const advance = (currentTime: number) => {
      engine.advance(currentTime - previousTime)
      previousTime = currentTime
      animationFrame = requestAnimationFrame(advance)
    }

    animationFrame = requestAnimationFrame(advance)
    return () => cancelAnimationFrame(animationFrame)
  }, [engine])

  const togglePause = useCallback(() => engine.togglePause(), [engine])

  const reset = useCallback(() => {
    setEvents([])
    engine.reset()
    setConfig(engine.getConfig())
  }, [engine])

  const setRobotCount = useCallback((count: number) => {
    engine.setRobotCount(count)
    setConfig(engine.getConfig())
  }, [engine])

  const setLayout = useCallback((layout: LayoutId) => {
    setEvents([])
    engine.setLayout(layout)
    setConfig(engine.getConfig())
  }, [engine])

  const setSpeed = useCallback((speed: SimulationSpeed) => {
    engine.setSpeed(speed)
  }, [engine])

  const getRobotPose = useCallback((id: number) => engine.getRobotRenderPose(id), [engine])

  const robots: RobotData[] = navigationSnapshot.robots.map((robot) => ({
    id: robot.id,
    status: statusForTask(robot.kind),
    task: robot.retireWhenParked ? 'Retiring' : robot.taskLabel,
    battery: Math.round(robot.battery),
    location: locationForCell(config, robot.cell),
    retireWhenParked: robot.retireWhenParked,
  }))

  const contextValue: WarehouseContextType = {
    robots,
    stats: { completedOrders: navigationSnapshot.completedOrders },
    efficiencyHistory: navigationSnapshot.efficiencyHistory,
    events,
    paused: navigationSnapshot.paused,
    togglePause,
    reset,
    throughput: navigationSnapshot.throughputMinute,
    avgCycleTime: navigationSnapshot.avgCycleSeconds,
    robotCount: navigationSnapshot.desiredRobotCount,
    actualRobotCount: navigationSnapshot.robots.length,
    maxRobotCount: config.spawnCells.length,
    canAddRobot: navigationSnapshot.canAddRobot,
    setRobotCount,
    layout: navigationSnapshot.layoutId,
    layouts: LAYOUT_PRESETS,
    setLayout,
    speed: navigationSnapshot.speed,
    setSpeed,
    navigationSnapshot,
    config,
    getRobotPose,
  }

  return (
    <WarehouseContext.Provider value={contextValue}>
      {children}
    </WarehouseContext.Provider>
  )
}

export function useWarehouse(): WarehouseContextType {
  const context = useContext(WarehouseContext)
  if (!context) throw new Error('useWarehouse must be used within WarehouseProvider')
  return context
}