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
  type RobotSnapshot,
  type SimulationSpeed,
  type WarehouseConfig,
} from '@/lib/nav'

const MAX_EVENTS = 50

export type WarehouseEvent = EngineEvent

export interface RobotData {
  id: number
  status: 'executing' | 'waiting' | 'charging'
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
  events: WarehouseEvent[]
  paused: boolean
  togglePause: () => void
  reset: () => void
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
  selectedRobotId: number | null
  selectedRobot: RobotSnapshot | null
  selectRobot: (id: number) => void
  navigationSnapshot: EngineSnapshot
  config: WarehouseConfig
  getRobotPose: (id: number) => RobotRenderPose | undefined
}

interface WarehouseProviderProps {
  children: ReactNode
}

const WarehouseContext = createContext<WarehouseContextType | undefined>(undefined)

export function WarehouseProvider({ children }: WarehouseProviderProps) {
  const [engine] = useState(() => new NavigationEngine(createWarehouseConfig()))

  const [navigationSnapshot, setNavigationSnapshot] = useState(() => engine.getSnapshot())
  const [config, setConfig] = useState(() => engine.getConfig())
  const [events, setEvents] = useState<WarehouseEvent[]>([])
  const [preferredRobotId, setPreferredRobotId] = useState<number | null>(
    () => engine.getSnapshot().robots[0]?.id ?? null
  )

  useEffect(() => engine.subscribe(setNavigationSnapshot), [engine])

  useEffect(
    () => engine.subscribeEvents((event) => {
      setEvents((previous) => [...previous, event].slice(-MAX_EVENTS))
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

  const selectRobot = useCallback((id: number) => {
    if (engine.getSnapshot().robots.some((robot) => robot.id === id)) {
      setPreferredRobotId(id)
    }
  }, [engine])

  const selectedRobot = navigationSnapshot.robots.find((robot) => robot.id === preferredRobotId)
    ?? navigationSnapshot.robots[0]
    ?? null

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
    events,
    paused: navigationSnapshot.paused,
    togglePause,
    reset,
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
    selectedRobotId: selectedRobot?.id ?? null,
    selectedRobot,
    selectRobot,
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