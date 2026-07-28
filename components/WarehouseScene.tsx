'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Box, Sphere, Text } from '@react-three/drei'
import { useRef, useState, useEffect, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useWarehouse } from '@/lib/WarehouseContext'
import { cbs, pathToWaypoints, CBSAgent } from '@/lib/cbs'

const BATTERY_DRAIN_RATE = 1.5
const BATTERY_CHARGE_RATE = 8
const LOW_BATTERY_THRESHOLD = 10
const FULL_BATTERY_THRESHOLD = 95
const PICKING_DURATION = 2
const MOVEMENT_SPEED_MULTIPLIER = 3
const DASHBOARD_UPDATE_INTERVAL = 1
const DOCK_ZONE_THRESHOLD = 2
const ZONE_A_THRESHOLD = 5
const ZONE_B_THRESHOLD = -5
const TURN_SPEED = 3
const WAYPOINT_THRESHOLD = 0.15
const SAFETY_BUBBLE = 0.9

const ROBOT_BODY_COLOR = '#d4d4d8'
const PATH_LINE_COLOR = '#3b82f6'
const GRID_CELL_COLOR = '#374151'
const GRID_SECTION_COLOR = '#4b5563'
const SHELF_BODY_COLOR = '#a1a1aa'
const SHELF_SHELF_COLOR = '#71717a'
const DOCK_BASE_COLOR = '#1f2937'
const DOCK_POST_COLOR = '#374151'
const CARGO_EMPTY_COLOR = '#374151'
const CARGO_LOADED_COLOR = '#3b82f6'
const LABEL_COLOR = '#52525b'
const DOCK_LABEL_COLOR = '#9ca3af'
const WHEEL_COLOR = '#111827'
const SCENE_BG_COLOR = '#0a0a0a'
const LIGHT_PRIMARY_COLOR = '#3b82f6'
const LIGHT_NEUTRAL_COLOR = '#6b7280'

const SHELF_POSITIONS: [number, number, number][] = [
  [8, 0, 0],
  [8, 0, 3],
  [8, 0, -3],
  [-8, 0, 0],
  [-8, 0, 3],
  [-8, 0, -3],
]

const DOCK_SLOTS: THREE.Vector3[] = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(-1, 0, 0),
]

interface RobotPlanEntry {
  position: { x: number; z: number }
  target: { x: number; z: number } | null
  waypoints: { x: number; z: number }[]
  waypointIndex: number
  planStartTime: number
}

const plannerState: {
  robots: (RobotPlanEntry | null)[]
  positions: Map<number, { x: number; z: number }>
} = {
  robots: [null, null, null, null],
  positions: new Map(),
}

function runCBS(): void {
  const agents: CBSAgent[] = []
  const stationary: { x: number; z: number }[] = []

  for (let i = 0; i < 4; i++) {
    const entry = plannerState.robots[i]
    if (!entry) continue
    const pos = { x: Math.round(entry.position.x), z: Math.round(entry.position.z) }
    if (entry.target) {
      agents.push({ id: agents.length, start: pos, goal: entry.target })
    } else {
      stationary.push(pos)
    }
  }

  if (agents.length === 0) return

  const paths = cbs(agents, stationary)

  let agentIdx = 0
  for (let i = 0; i < 4; i++) {
    const entry = plannerState.robots[i]
    if (!entry) continue
    if (entry.target) {
      if (agentIdx < paths.length && paths[agentIdx].length > 0) {
        entry.waypoints = pathToWaypoints(paths[agentIdx])
        entry.waypointIndex = 0
        entry.planStartTime = Date.now()
      }
      agentIdx++
    }
  }
}

function requestReplan(
  robotId: number,
  position: THREE.Vector3,
  target: THREE.Vector3
): void {
  const idx = robotId - 1
  const entry = plannerState.robots[idx]
  if (!entry) return

  entry.position = { x: position.x, z: position.z }
  entry.target = { x: Math.round(target.x), z: Math.round(target.z) }

  for (let i = 0; i < 4; i++) {
    const e = plannerState.robots[i]
    if (!e) continue
    const pos = plannerState.positions.get(i + 1)
    if (pos) e.position = pos
  }

  runCBS()
}

function setStationary(robotId: number, position: THREE.Vector3): void {
  const idx = robotId - 1
  const entry = plannerState.robots[idx]
  if (!entry) return

  entry.position = { x: Math.round(position.x), z: Math.round(position.z) }
  entry.target = null
  entry.waypoints = []
  entry.waypointIndex = 0
}

type RobotTask = 'idle' | 'moving_to_shelf' | 'picking' | 'moving_to_dock' | 'delivering' | 'charging'

interface RobotState {
  position: THREE.Vector3
  targetPosition: THREE.Vector3
  task: RobotTask
  rotation: number
  targetRotation: number
  taskTimer: number
  isAtTarget: boolean
  battery: number
  hasPickedUp: boolean
  needsCharging: boolean
  cycleStartTime: number
}

interface RobotProps {
  position: [number, number, number]
  id: number
  shelfPositions: [number, number, number][]
}

function getLocationName(pos: THREE.Vector3): string {
  const x = Math.round(pos.x)
  const z = Math.round(pos.z)

  if (Math.abs(x) < DOCK_ZONE_THRESHOLD && Math.abs(z) < DOCK_ZONE_THRESHOLD) {
    return 'Dock'
  }
  if (x > ZONE_A_THRESHOLD) return 'Zone A'
  if (x < ZONE_B_THRESHOLD) return 'Zone B'
  return 'Zone C'
}

function getRandomShelf(shelfPositions: [number, number, number][]): THREE.Vector3 {
  const randomShelf = shelfPositions[Math.floor(Math.random() * shelfPositions.length)]
  return new THREE.Vector3(randomShelf[0] - 2, 0, randomShelf[2])
}

function rotationToward(from: THREE.Vector3, to: { x: number; z: number }): number {
  const dx = to.x - from.x
  const dz = to.z - from.z
  if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6) return 0
  return Math.atan2(dx, dz)
}

function Robot({ position, id, shelfPositions }: RobotProps) {
  const ref = useRef<THREE.Group>(null)
  const { updateRobot, incrementOrders, logEvent, paused, recordCycleTime } = useWarehouse()

  const [pathLine] = useState(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60), 3))
    const material = new THREE.LineBasicMaterial({ color: PATH_LINE_COLOR, transparent: true, opacity: 0.3 })
    const line = new THREE.Line(geometry, material)
    line.visible = false
    return line
  })

  const stateRef = useRef<RobotState>({
    position: new THREE.Vector3(...position),
    targetPosition: new THREE.Vector3(...position),
    task: 'moving_to_shelf',
    rotation: 0,
    targetRotation: 0,
    taskTimer: 0,
    isAtTarget: false,
    battery: 80,
    hasPickedUp: false,
    needsCharging: false,
    cycleStartTime: 0,
  })

  const [visualTask, setVisualTask] = useState('MOVING TO SHELF')
  const [cargoColor, setCargoColor] = useState(CARGO_EMPTY_COLOR)

  const lastUpdateTime = useRef(0)

  const updateDashboard = useCallback((task: string, location: string) => {
    const robotState = stateRef.current
    updateRobot(id, {
      task,
      location,
      battery: Math.round(robotState.battery),
      status: robotState.needsCharging ? 'charging' : 'active'
    })
  }, [id, updateRobot])

  const startChargingSequence = () => {
    const robotState = stateRef.current
    robotState.needsCharging = true
    robotState.task = 'moving_to_dock'
    robotState.targetPosition = DOCK_SLOTS[id - 1].clone()
    robotState.isAtTarget = false
    setVisualTask('LOW BATTERY - DOCKING')
    setCargoColor(CARGO_EMPTY_COLOR)
    updateDashboard('Low Battery - Returning', getLocationName(robotState.position))
    logEvent({ kind: 'alert', severity: 'warning', robot: id, message: `Robot #${id} battery low, returning to dock` })
    requestReplan(id, robotState.position, DOCK_SLOTS[id - 1])
  }

  const startPickingTask = () => {
    const robotState = stateRef.current
    robotState.task = 'picking'
    setVisualTask('PICKING')
    updateDashboard('Picking Items', getLocationName(robotState.position))
    logEvent({ kind: 'activity', severity: 'info', robot: id, message: `Robot #${id} started picking task` })
    setStationary(id, robotState.position)
  }

  const startDeliveringTask = () => {
    const robotState = stateRef.current
    robotState.task = 'delivering'
    setVisualTask('DELIVERING')
    updateDashboard('Delivering', 'Dock')
    setStationary(id, robotState.position)
  }

  const completePickingTask = () => {
    const robotState = stateRef.current
    robotState.hasPickedUp = true
    robotState.task = 'moving_to_dock'
    robotState.targetPosition = DOCK_SLOTS[id - 1].clone()
    robotState.isAtTarget = false
    setVisualTask('MOVING TO DOCK')
    setCargoColor(CARGO_LOADED_COLOR)
    updateDashboard('Returning to Dock', getLocationName(robotState.position))
    logEvent({ kind: 'activity', severity: 'info', robot: id, message: `Robot #${id} picked items, returning to dock` })
    requestReplan(id, robotState.position, DOCK_SLOTS[id - 1])
  }

  const completeDeliveringTask = () => {
    const robotState = stateRef.current
    const cycleDuration = (Date.now() - robotState.cycleStartTime) / 1000
    recordCycleTime(cycleDuration)
    const orderNumber = incrementOrders()
    robotState.hasPickedUp = false
    robotState.task = 'moving_to_shelf'
    const newTarget = getRandomShelf(shelfPositions)
    robotState.targetPosition = newTarget.clone()
    robotState.isAtTarget = false
    robotState.cycleStartTime = Date.now()
    setVisualTask('MOVING TO SHELF')
    setCargoColor(CARGO_EMPTY_COLOR)
    updateDashboard('Moving to Shelf', 'Dock')
    logEvent({ kind: 'activity', severity: 'info', robot: id, message: `Robot #${id} completed order #${orderNumber}` })
    logEvent({ kind: 'alert', severity: 'info', robot: id, message: `Order #${orderNumber} delivered` })
    requestReplan(id, robotState.position, newTarget)
  }

  const resumeWorkAfterCharging = () => {
    const robotState = stateRef.current
    robotState.needsCharging = false
    const newTarget = getRandomShelf(shelfPositions)
    robotState.targetPosition = newTarget.clone()
    robotState.task = 'moving_to_shelf'
    robotState.isAtTarget = false
    robotState.cycleStartTime = Date.now()
    setVisualTask('MOVING TO SHELF')
    updateDashboard('Moving to Shelf', 'Dock')
    logEvent({ kind: 'activity', severity: 'info', robot: id, message: `Robot #${id} charged, resuming operations` })
    requestReplan(id, robotState.position, newTarget)
  }

  useEffect(() => {
    if (!shelfPositions || shelfPositions.length === 0) return

    const robotState = stateRef.current
    robotState.battery = 70 + Math.random() * 30
    robotState.task = 'moving_to_shelf'
    robotState.isAtTarget = false
    robotState.cycleStartTime = Date.now()

    const idx = id - 1
    plannerState.robots[idx] = {
      position: { x: position[0], z: position[2] },
      target: null,
      waypoints: [],
      waypointIndex: 0,
      planStartTime: 0,
    }

    const newTarget = getRandomShelf(shelfPositions)
    robotState.targetPosition = newTarget.clone()

    requestReplan(id, robotState.position, newTarget)
    updateDashboard('Moving to Shelf', 'Dock')
  }, [shelfPositions, updateDashboard, id, position])

  /* eslint-disable react-hooks/immutability */
  useFrame((state, delta) => {
    if (!ref.current || !shelfPositions) return
    if (paused) return

    const robotState = stateRef.current
    const now = state.clock.elapsedTime

    if (robotState.task === 'moving_to_shelf' || robotState.task === 'moving_to_dock') {
      robotState.battery = Math.max(0, robotState.battery - delta * BATTERY_DRAIN_RATE)
    }

    if (robotState.battery < LOW_BATTERY_THRESHOLD && !robotState.needsCharging) {
      startChargingSequence()
      return
    }

    if (robotState.task === 'charging') {
      robotState.battery = Math.min(100, robotState.battery + delta * BATTERY_CHARGE_RATE)
      if (robotState.battery >= FULL_BATTERY_THRESHOLD) {
        resumeWorkAfterCharging()
      }
      return
    }

    if (robotState.task === 'picking' || robotState.task === 'delivering') {
      robotState.taskTimer += delta
      if (robotState.taskTimer >= PICKING_DURATION) {
        if (robotState.task === 'picking') {
          completePickingTask()
        } else if (robotState.task === 'delivering') {
          completeDeliveringTask()
        }
        robotState.taskTimer = 0
      }
    }

    if (robotState.task === 'moving_to_shelf' || robotState.task === 'moving_to_dock') {
      const planEntry = plannerState.robots[id - 1]

      if (planEntry && planEntry.waypoints.length > 0 && planEntry.waypointIndex < planEntry.waypoints.length) {
        const waypoint = planEntry.waypoints[planEntry.waypointIndex]
        const waypointWorld = new THREE.Vector3(waypoint.x, 0, waypoint.z)
        const wpDistance = robotState.position.distanceTo(waypointWorld)

        if (wpDistance < WAYPOINT_THRESHOLD) {
          planEntry.waypointIndex++
          if (planEntry.waypointIndex >= planEntry.waypoints.length) {
            robotState.isAtTarget = true
            robotState.taskTimer = 0
            setStationary(id, robotState.position)
            if (robotState.needsCharging && robotState.task === 'moving_to_dock') {
              robotState.task = 'charging'
              setVisualTask('CHARGING')
              updateDashboard('Charging', 'Dock')
            } else if (robotState.task === 'moving_to_shelf') {
              startPickingTask()
            } else if (robotState.task === 'moving_to_dock' && robotState.hasPickedUp) {
              startDeliveringTask()
            }
          } else {
            robotState.targetRotation = rotationToward(robotState.position, planEntry.waypoints[planEntry.waypointIndex])
          }
        } else {
          const rotDiff = robotState.targetRotation - robotState.rotation
          const normalizedDiff = Math.atan2(Math.sin(rotDiff), Math.cos(rotDiff))

          if (Math.abs(normalizedDiff) > 0.01) {
            const turnAmount = Math.sign(normalizedDiff) * Math.min(Math.abs(normalizedDiff), delta * TURN_SPEED)
            robotState.rotation += turnAmount
            ref.current.rotation.y = robotState.rotation
          } else {
            robotState.rotation = robotState.targetRotation
            ref.current.rotation.y = robotState.rotation

            let tooClose = false
            for (const [otherId, otherPos] of plannerState.positions) {
              if (otherId === id) continue
              const dist = Math.hypot(otherPos.x - robotState.position.x, otherPos.z - robotState.position.z)
              if (dist < SAFETY_BUBBLE) {
                tooClose = true
                break
              }
            }

            if (!tooClose) {
              const direction = new THREE.Vector3()
                .subVectors(waypointWorld, robotState.position)
                .normalize()

              const moveSpeed = Math.min(delta * MOVEMENT_SPEED_MULTIPLIER, wpDistance)
              robotState.position.addScaledVector(direction, moveSpeed)
              ref.current.position.copy(robotState.position)

              if (now - lastUpdateTime.current > DASHBOARD_UPDATE_INTERVAL) {
                updateDashboard(
                  robotState.task === 'moving_to_shelf' ? 'Moving to Shelf' : 'Returning to Dock',
                  getLocationName(robotState.position)
                )
                lastUpdateTime.current = now
              }
            }
          }
        }

        if (pathLine) {
          pathLine.visible = true
          const positions = pathLine.geometry.attributes.position as THREE.BufferAttribute
          positions.setXYZ(0, 0, 0.1, 0)
          let pointIdx = 1
          for (let i = planEntry.waypointIndex; i < planEntry.waypoints.length && pointIdx < 20; i++) {
            const wp = planEntry.waypoints[i]
            positions.setXYZ(pointIdx, wp.x - robotState.position.x, 0.1, wp.z - robotState.position.z)
            pointIdx++
          }
          pathLine.geometry.setDrawRange(0, pointIdx)
          positions.needsUpdate = true
        }
      } else {
        if (pathLine) pathLine.visible = false
      }
    } else {
      if (pathLine) pathLine.visible = false
    }

    plannerState.positions.set(id, { x: robotState.position.x, z: robotState.position.z })
  })
  /* eslint-enable react-hooks/immutability */

  return (
    <group ref={ref} position={position}>
      <RobotBody />
      <RobotWheels />
      <RobotCargo color={cargoColor} />
      <RobotLabels id={id} task={visualTask} />
      <primitive object={pathLine} />
    </group>
  )
}

function RobotBody() {
  return (
    <Box args={[0.8, 0.5, 1.2]} position={[0, 0.25, 0]}>
      <meshStandardMaterial color={ROBOT_BODY_COLOR} metalness={0.6} roughness={0.4} />
    </Box>
  )
}

function RobotWheels() {
  const wheelPositions: [number, number, number][] = [
    [0.3, 0.1, 0.4],
    [-0.3, 0.1, 0.4],
    [0.3, 0.1, -0.4],
    [-0.3, 0.1, -0.4],
  ]

  return (
    <>
      {wheelPositions.map((pos, i) => (
        <Sphere key={i} args={[0.15, 16, 16]} position={pos}>
          <meshStandardMaterial color={WHEEL_COLOR} />
        </Sphere>
      ))}
    </>
  )
}

function RobotCargo({ color }: { color: string }) {
  return (
    <Box args={[0.4, 0.6, 0.4]} position={[0, 0.8, 0]}>
      <meshStandardMaterial color={color} />
    </Box>
  )
}

function RobotLabels({ id, task }: { id: number; task: string }) {
  return (
    <>
      <Text position={[0, 1.2, 0]} fontSize={0.3} color={LABEL_COLOR} anchorX="center">
        R{id}
      </Text>
      <Text position={[0, 1.5, 0]} fontSize={0.15} color={LABEL_COLOR} anchorX="center">
        {task}
      </Text>
    </>
  )
}

function Shelf({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <Box args={[1.5, 2, 0.5]} position={[0, 1, 0]}>
        <meshStandardMaterial color={SHELF_BODY_COLOR} metalness={0.3} roughness={0.7} />
      </Box>
      <Box args={[1.5, 0.1, 0.5]} position={[0, 0.6, 0]}>
        <meshStandardMaterial color={SHELF_SHELF_COLOR} />
      </Box>
      <Box args={[1.5, 0.1, 0.5]} position={[0, 1.2, 0]}>
        <meshStandardMaterial color={SHELF_SHELF_COLOR} />
      </Box>
      <Box args={[1.5, 0.1, 0.5]} position={[0, 1.8, 0]}>
        <meshStandardMaterial color={SHELF_SHELF_COLOR} />
      </Box>
    </group>
  )
}

function DockingStation({ position }: { position: [number, number, number] }) {
  const postPositions: [number, number, number][] = [
    [1.2, 0.5, 1.2],
    [-1.2, 0.5, 1.2],
    [1.2, 0.5, -1.2],
    [-1.2, 0.5, -1.2],
  ]

  return (
    <group position={position}>
      <Box args={[3, 0.1, 3]} position={[0, 0.05, 0]}>
        <meshStandardMaterial color={DOCK_BASE_COLOR} metalness={0.8} roughness={0.2} />
      </Box>
      {postPositions.map((pos, i) => (
        <Box key={i} args={[0.2, 1, 0.2]} position={pos}>
          <meshStandardMaterial color={DOCK_POST_COLOR} />
        </Box>
      ))}
      <Text position={[0, 1.5, 0]} fontSize={0.4} color={DOCK_LABEL_COLOR} anchorX="center">
        DOCK
      </Text>
    </group>
  )
}

export default function WarehouseScene() {
  const { resetCounter } = useWarehouse()

  useEffect(() => {
    plannerState.robots = [null, null, null, null]
    plannerState.positions.clear()
  }, [resetCounter])

  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [15, 15, 15], fov: 50 }}
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <color attach="background" args={[SCENE_BG_COLOR]} />

        <SceneLighting />

        <Grid
          args={[20, 20]}
          cellColor={GRID_CELL_COLOR}
          sectionColor={GRID_SECTION_COLOR}
          fadeDistance={30}
          fadeStrength={1}
        />

        <DockingStation position={[0, 0, 0]} />

        <Robot key={`robot-1-${resetCounter}`} position={[2, 0, 2]} id={1} shelfPositions={SHELF_POSITIONS} />
        <Robot key={`robot-2-${resetCounter}`} position={[-2, 0, 2]} id={2} shelfPositions={SHELF_POSITIONS} />
        <Robot key={`robot-3-${resetCounter}`} position={[2, 0, -2]} id={3} shelfPositions={SHELF_POSITIONS} />
        <Robot key={`robot-4-${resetCounter}`} position={[-2, 0, -2]} id={4} shelfPositions={SHELF_POSITIONS} />

        {SHELF_POSITIONS.map((pos, i) => (
          <Shelf key={i} position={pos} />
        ))}

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={8}
          maxDistance={30}
        />
      </Canvas>
    </div>
  )
}

function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1}
      />
      <pointLight position={[-10, 10, -10]} intensity={0.5} color={LIGHT_PRIMARY_COLOR} />
      <spotLight position={[0, 10, 0]} intensity={0.3} color={LIGHT_NEUTRAL_COLOR} angle={0.3} />
    </>
  )
}