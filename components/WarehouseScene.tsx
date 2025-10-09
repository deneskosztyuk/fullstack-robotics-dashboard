'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Box, Sphere, Text, Line } from '@react-three/drei'
import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useWarehouse } from '@/lib/WarehouseContext'

const BATTERY_DRAIN_RATE = 1.5
const BATTERY_CHARGE_RATE = 8
const LOW_BATTERY_THRESHOLD = 10
const FULL_BATTERY_THRESHOLD = 95
const PICKING_DURATION = 2
const DELIVERING_DURATION = 2
const TARGET_DISTANCE_THRESHOLD = 0.5
const MOVEMENT_SPEED_MULTIPLIER = 3
const DASHBOARD_UPDATE_INTERVAL = 1
const DOCK_ZONE_THRESHOLD = 2
const ZONE_A_THRESHOLD = 5
const ZONE_B_THRESHOLD = -5

const ROBOT_COLORS = {
  1: '#ff6b35',
  2: '#f7931e',
  3: '#00d9ff',
  4: '#7209b7',
} as const

const SHELF_POSITIONS: [number, number, number][] = [
  [8, 0, 0],
  [8, 0, 3],
  [8, 0, -3],
  [-8, 0, 0],
  [-8, 0, 3],
  [-8, 0, -3],
]

type RobotTask = 'idle' | 'moving_to_shelf' | 'picking' | 'moving_to_dock' | 'delivering' | 'charging'

interface RobotState {
  position: THREE.Vector3
  targetPosition: THREE.Vector3
  task: RobotTask
  speed: number
  rotation: number
  taskTimer: number
  isAtTarget: boolean
  battery: number
  hasPickedUp: boolean
  needsCharging: boolean
}

interface RobotProps {
  position: [number, number, number]
  id: number
  color: string
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

function Robot({ position, id, color, shelfPositions }: RobotProps) {
  const ref = useRef<THREE.Group>(null)
  const { updateRobot, incrementOrders } = useWarehouse()
  
  const stateRef = useRef<RobotState>({
    position: new THREE.Vector3(...position),
    targetPosition: new THREE.Vector3(...position),
    task: 'idle',
    speed: 0.8 + Math.random() * 0.4,
    rotation: 0,
    taskTimer: 0,
    isAtTarget: false,
    battery: 70 + Math.random() * 30,
    hasPickedUp: false,
    needsCharging: false,
  })
  
  const [visualTask, setVisualTask] = useState('IDLE')
  const [visualColor, setVisualColor] = useState(color)
  const [cargoColor, setCargoColor] = useState('#333')
  
  const dockPosition = new THREE.Vector3(0, 0, 0)
  const lastUpdateTime = useRef(0)
  
  const updateDashboard = (task: string, location: string) => {
    updateRobot(id, {
      task,
      location,
      battery: Math.round(stateRef.current.battery),
      status: stateRef.current.needsCharging ? 'charging' : 'active'
    })
  }
  
  const startChargingSequence = () => {
    const robotState = stateRef.current
    robotState.needsCharging = true
    robotState.task = 'moving_to_dock'
    robotState.targetPosition = dockPosition.clone()
    robotState.isAtTarget = false
    robotState.hasPickedUp = false
    setVisualTask('LOW BATTERY - DOCKING')
    setVisualColor('#ff0000')
    setCargoColor('#333')
    updateDashboard('Low Battery - Returning', getLocationName(robotState.position))
  }
  
  const startPickingTask = () => {
    const robotState = stateRef.current
    robotState.task = 'picking'
    setVisualTask('PICKING')
    setVisualColor('#ffff00')
    updateDashboard('Picking Items', getLocationName(robotState.position))
  }
  
  const startDeliveringTask = () => {
    const robotState = stateRef.current
    robotState.task = 'delivering'
    setVisualTask('DELIVERING')
    setVisualColor('#00ff00')
    updateDashboard('Delivering', 'Dock')
  }
  
  const completePickingTask = () => {
    const robotState = stateRef.current
    robotState.hasPickedUp = true
    robotState.task = 'moving_to_dock'
    robotState.targetPosition = dockPosition.clone()
    robotState.isAtTarget = false
    setVisualTask('MOVING TO DOCK')
    setVisualColor('#ff00ff')
    setCargoColor('#ff6600')
    updateDashboard('Returning to Dock', getLocationName(robotState.position))
  }
  
  const completeDeliveringTask = () => {
    const robotState = stateRef.current
    incrementOrders()
    robotState.hasPickedUp = false
    robotState.task = 'moving_to_shelf'
    robotState.targetPosition = getRandomShelf(shelfPositions)
    robotState.isAtTarget = false
    setVisualTask('MOVING TO SHELF')
    setVisualColor(color)
    setCargoColor('#333')
    updateDashboard('Moving to Shelf', 'Dock')
  }
  
  const resumeWorkAfterCharging = () => {
    const robotState = stateRef.current
    robotState.needsCharging = false
    robotState.targetPosition = getRandomShelf(shelfPositions)
    robotState.task = 'moving_to_shelf'
    robotState.isAtTarget = false
    setVisualTask('MOVING TO SHELF')
    setVisualColor(color)
    updateDashboard('Moving to Shelf', 'Dock')
  }
  
  useEffect(() => {
    if (!shelfPositions || shelfPositions.length === 0) return
    
    const robotState = stateRef.current
    robotState.targetPosition = getRandomShelf(shelfPositions)
    robotState.task = 'moving_to_shelf'
    robotState.isAtTarget = false
    setVisualTask('MOVING TO SHELF')
    setVisualColor(color)
    
    updateDashboard('Moving to Shelf', 'Dock')
  }, [shelfPositions, color, id])
  
  useFrame((state, delta) => {
    if (!ref.current || !shelfPositions) return
    
    const robotState = stateRef.current
    const distance = robotState.position.distanceTo(robotState.targetPosition)
    const now = state.clock.elapsedTime
    
    if (robotState.task === 'moving_to_shelf' || robotState.task === 'moving_to_dock') {
      robotState.battery = Math.max(0, robotState.battery - delta * BATTERY_DRAIN_RATE)
    }
    
    if (robotState.battery < LOW_BATTERY_THRESHOLD && !robotState.needsCharging) {
      startChargingSequence()
      return
    }
    
    if (robotState.needsCharging && distance < TARGET_DISTANCE_THRESHOLD && robotState.task !== 'charging') {
      robotState.task = 'charging'
      robotState.isAtTarget = true
      setVisualTask('CHARGING')
      setVisualColor('#ffff00')
      updateDashboard('Charging', 'Dock')
    }
    
    if (robotState.task === 'charging') {
      robotState.battery = Math.min(100, robotState.battery + delta * BATTERY_CHARGE_RATE)
      
      if (robotState.battery >= FULL_BATTERY_THRESHOLD) {
        resumeWorkAfterCharging()
      }
      return
    }
    
    if (distance < TARGET_DISTANCE_THRESHOLD && !robotState.isAtTarget) {
      robotState.isAtTarget = true
      robotState.taskTimer = 0
      
      if (robotState.task === 'moving_to_shelf') {
        startPickingTask()
      } else if (robotState.task === 'moving_to_dock' && robotState.hasPickedUp) {
        startDeliveringTask()
      }
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
    
    if (!robotState.isAtTarget && (robotState.task === 'moving_to_shelf' || robotState.task === 'moving_to_dock')) {
      const direction = new THREE.Vector3()
        .subVectors(robotState.targetPosition, robotState.position)
        .normalize()
      
      const moveSpeed = robotState.speed * delta * MOVEMENT_SPEED_MULTIPLIER
      robotState.position.addScaledVector(direction, moveSpeed)
      
      robotState.rotation = Math.atan2(direction.x, direction.z)
      
      ref.current.position.copy(robotState.position)
      ref.current.rotation.y = robotState.rotation
      
      if (now - lastUpdateTime.current > DASHBOARD_UPDATE_INTERVAL) {
        updateDashboard(
          robotState.task === 'moving_to_shelf' ? 'Moving to Shelf' : 'Returning to Dock',
          getLocationName(robotState.position)
        )
        lastUpdateTime.current = now
      }
    }
  })
  
  const isMoving = !stateRef.current.isAtTarget && 
    (stateRef.current.task === 'moving_to_shelf' || stateRef.current.task === 'moving_to_dock')
  
  return (
    <group ref={ref} position={position}>
      <RobotBody color={visualColor} />
      <RobotWheels />
      <RobotCargo color={cargoColor} />
      <RobotLabels id={id} task={visualTask} />
      {isMoving && <PathLine stateRef={stateRef} />}
    </group>
  )
}

function RobotBody({ color }: { color: string }) {
  return (
    <Box args={[0.8, 0.5, 1.2]} position={[0, 0.25, 0]}>
      <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
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
          <meshStandardMaterial color="#222" />
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
      <Text position={[0, 1.2, 0]} fontSize={0.3} color="white" anchorX="center">
        R{id}
      </Text>
      <Text position={[0, 1.5, 0]} fontSize={0.15} color="#00ff00" anchorX="center">
        {task}
      </Text>
    </>
  )
}

function PathLine({ stateRef }: { stateRef: React.MutableRefObject<RobotState> }) {
  return (
    <Line
      points={[
        [0, 0.1, 0],
        [
          stateRef.current.targetPosition.x - stateRef.current.position.x,
          0.1,
          stateRef.current.targetPosition.z - stateRef.current.position.z
        ]
      ]}
      color="#00ffff"
      lineWidth={2}
      transparent
      opacity={0.3}
    />
  )
}

function Shelf({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <Box args={[1.5, 2, 0.5]} position={[0, 1, 0]}>
        <meshStandardMaterial color="#8B4513" metalness={0.3} roughness={0.7} />
      </Box>
      <Box args={[1.5, 0.1, 0.5]} position={[0, 0.6, 0]}>
        <meshStandardMaterial color="#654321" />
      </Box>
      <Box args={[1.5, 0.1, 0.5]} position={[0, 1.2, 0]}>
        <meshStandardMaterial color="#654321" />
      </Box>
      <Box args={[1.5, 0.1, 0.5]} position={[0, 1.8, 0]}>
        <meshStandardMaterial color="#654321" />
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
        <meshStandardMaterial color="#222222" metalness={0.8} roughness={0.2} />
      </Box>
      {postPositions.map((pos, i) => (
        <Box key={i} args={[0.2, 1, 0.2]} position={pos}>
          <meshStandardMaterial color="#444" />
        </Box>
      ))}
      <Text position={[0, 1.5, 0]} fontSize={0.4} color="#00ff00" anchorX="center">
        DOCK
      </Text>
    </group>
  )
}

export default function WarehouseScene() {
  return (
    <div className="w-full h-full">
      <Canvas 
        camera={{ position: [15, 15, 15], fov: 50 }} 
        shadows
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <color attach="background" args={['#0a0a0a']} />
        
        <SceneLighting />
        
        <Grid 
          args={[20, 20]} 
          cellColor="#6080ff" 
          sectionColor="#3060ff" 
          fadeDistance={30}
          fadeStrength={1}
        />
        
        <DockingStation position={[0, 0, 0]} />
        
        <Robot position={[2, 0, 2]} id={1} color={ROBOT_COLORS[1]} shelfPositions={SHELF_POSITIONS} />
        <Robot position={[-2, 0, 2]} id={2} color={ROBOT_COLORS[2]} shelfPositions={SHELF_POSITIONS} />
        <Robot position={[2, 0, -2]} id={3} color={ROBOT_COLORS[3]} shelfPositions={SHELF_POSITIONS} />
        <Robot position={[-2, 0, -2]} id={4} color={ROBOT_COLORS[4]} shelfPositions={SHELF_POSITIONS} />
        
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
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[-10, 10, -10]} intensity={0.5} color="#4080ff" />
      <spotLight position={[0, 10, 0]} intensity={0.3} color="#00ff00" angle={0.3} />
    </>
  )
}
