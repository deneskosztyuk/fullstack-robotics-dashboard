'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Box, Sphere, Text, Line } from '@react-three/drei'
import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useWarehouse } from '@/lib/WarehouseContext'

function Robot({ 
  position, 
  id, 
  color,
  shelfPositions 
}: { 
  position: [number, number, number], 
  id: number, 
  color: string,
  shelfPositions: [number, number, number][]
}) {
  const ref = useRef<THREE.Group>(null)
  const { updateRobot, incrementOrders } = useWarehouse()
  
  const stateRef = useRef({
    position: new THREE.Vector3(...position),
    targetPosition: new THREE.Vector3(...position),
    task: 'idle' as 'idle' | 'moving_to_shelf' | 'picking' | 'moving_to_dock' | 'delivering' | 'charging',
    speed: 0.8 + Math.random() * 0.4,
    rotation: 0,
    taskTimer: 0,
    isAtTarget: false,
    battery: 70 + Math.random() * 30, // Start 70-100%
    hasPickedUp: false,
    needsCharging: false,
  })
  
  const [visualTask, setVisualTask] = useState('IDLE')
  const [visualColor, setVisualColor] = useState(color)
  const [cargoColor, setCargoColor] = useState('#333')
  
  const dockPosition = new THREE.Vector3(0, 0, 0)
  const lastUpdateTime = useRef(0)
  
  const getLocationName = (pos: THREE.Vector3) => {
    const x = Math.round(pos.x)
    const z = Math.round(pos.z)
    if (Math.abs(x) < 2 && Math.abs(z) < 2) return 'Dock'
    if (x > 5) return 'Zone A'
    if (x < -5) return 'Zone B'
    return 'Zone C'
  }
  
  const updateDashboard = (task: string, location: string) => {
    updateRobot(id, {
      task,
      location,
      battery: Math.round(stateRef.current.battery),
      status: stateRef.current.needsCharging ? 'charging' : 'active'
    })
  }
  
  useEffect(() => {
    if (!shelfPositions || shelfPositions.length === 0) return
    
    // Initialize - go to first shelf
    const randomShelf = shelfPositions[Math.floor(Math.random() * shelfPositions.length)]
    stateRef.current.targetPosition = new THREE.Vector3(randomShelf[0] - 2, 0, randomShelf[2])
    stateRef.current.task = 'moving_to_shelf'
    stateRef.current.isAtTarget = false
    setVisualTask('MOVING TO SHELF')
    setVisualColor(color)
    
    updateDashboard('Moving to Shelf', 'Dock')
  }, [shelfPositions, color, id])
  
  useFrame((state, delta) => {
    if (!ref.current || !shelfPositions) return
    
    const robotState = stateRef.current
    const distance = robotState.position.distanceTo(robotState.targetPosition)
    const now = state.clock.elapsedTime
    
    // Drain battery when moving
    if (robotState.task === 'moving_to_shelf' || robotState.task === 'moving_to_dock') {
      robotState.battery = Math.max(0, robotState.battery - delta * 1.5)
    }
    
    // Check if needs charging (PRIORITY CHECK)
    if (robotState.battery < 10 && !robotState.needsCharging) {
      robotState.needsCharging = true
      robotState.task = 'moving_to_dock'
      robotState.targetPosition = dockPosition.clone()
      robotState.isAtTarget = false
      robotState.hasPickedUp = false
      setVisualTask('LOW BATTERY - DOCKING')
      setVisualColor('#ff0000')
      setCargoColor('#333')
      updateDashboard('Low Battery - Returning', getLocationName(robotState.position))
      return
    }
    
    // CHARGING STATE
    if (robotState.needsCharging && distance < 0.5 && robotState.task !== 'charging') {
      robotState.task = 'charging'
      robotState.isAtTarget = true
      setVisualTask('CHARGING')
      setVisualColor('#ffff00')
      updateDashboard('Charging', 'Dock')
    }
    
    if (robotState.task === 'charging') {
      robotState.battery = Math.min(100, robotState.battery + delta * 8) // Charge faster
      
      if (robotState.battery >= 95) {
        // Fully charged, resume work
        robotState.needsCharging = false
        const randomShelf = shelfPositions[Math.floor(Math.random() * shelfPositions.length)]
        robotState.targetPosition = new THREE.Vector3(randomShelf[0] - 2, 0, randomShelf[2])
        robotState.task = 'moving_to_shelf'
        robotState.isAtTarget = false
        setVisualTask('MOVING TO SHELF')
        setVisualColor(color)
        updateDashboard('Moving to Shelf', 'Dock')
      }
      return // Don't move while charging
    }
    
    // REACHED TARGET
    if (distance < 0.5 && !robotState.isAtTarget) {
      robotState.isAtTarget = true
      robotState.taskTimer = 0
      
      // STATE TRANSITIONS
      if (robotState.task === 'moving_to_shelf') {
        // Start picking
        robotState.task = 'picking'
        setVisualTask('PICKING')
        setVisualColor('#ffff00')
        updateDashboard('Picking Items', getLocationName(robotState.position))
        
      } else if (robotState.task === 'moving_to_dock' && robotState.hasPickedUp) {
        // Start delivering
        robotState.task = 'delivering'
        setVisualTask('DELIVERING')
        setVisualColor('#00ff00')
        updateDashboard('Delivering', 'Dock')
      }
    }
    
    // TIMED TASKS (picking and delivering)
    if (robotState.task === 'picking' || robotState.task === 'delivering') {
      robotState.taskTimer += delta
      
      if (robotState.taskTimer >= 2) { // 2 seconds
        if (robotState.task === 'picking') {
          // Picked up, now deliver to dock
          robotState.hasPickedUp = true
          robotState.task = 'moving_to_dock'
          robotState.targetPosition = dockPosition.clone()
          robotState.isAtTarget = false
          setVisualTask('MOVING TO DOCK')
          setVisualColor('#ff00ff')
          setCargoColor('#ff6600') // Show cargo
          updateDashboard('Returning to Dock', getLocationName(robotState.position))
          
        } else if (robotState.task === 'delivering') {
          // Delivered! Complete order and get next shelf
          incrementOrders()
          robotState.hasPickedUp = false
          
          const randomShelf = shelfPositions[Math.floor(Math.random() * shelfPositions.length)]
          robotState.task = 'moving_to_shelf'
          robotState.targetPosition = new THREE.Vector3(randomShelf[0] - 2, 0, randomShelf[2])
          robotState.isAtTarget = false
          setVisualTask('MOVING TO SHELF')
          setVisualColor(color)
          setCargoColor('#333') // Empty cargo
          updateDashboard('Moving to Shelf', 'Dock')
        }
        
        robotState.taskTimer = 0
      }
    }
    
    // MOVEMENT LOGIC
    if (!robotState.isAtTarget && (robotState.task === 'moving_to_shelf' || robotState.task === 'moving_to_dock')) {
      const direction = new THREE.Vector3()
        .subVectors(robotState.targetPosition, robotState.position)
        .normalize()
      
      const moveSpeed = robotState.speed * delta * 3
      robotState.position.addScaledVector(direction, moveSpeed)
      
      const targetRotation = Math.atan2(direction.x, direction.z)
      robotState.rotation = targetRotation
      
      ref.current.position.copy(robotState.position)
      ref.current.rotation.y = robotState.rotation
      
      // Update location every second (not every frame!)
      if (now - lastUpdateTime.current > 1) {
        updateDashboard(
          robotState.task === 'moving_to_shelf' ? 'Moving to Shelf' : 'Returning to Dock',
          getLocationName(robotState.position)
        )
        lastUpdateTime.current = now
      }
    }
  })
  
  return (
    <group ref={ref} position={position}>
      <Box args={[0.8, 0.5, 1.2]} position={[0, 0.25, 0]}>
        <meshStandardMaterial color={visualColor} metalness={0.6} roughness={0.4} />
      </Box>
      
      <Sphere args={[0.15, 16, 16]} position={[0.3, 0.1, 0.4]}>
        <meshStandardMaterial color="#222" />
      </Sphere>
      <Sphere args={[0.15, 16, 16]} position={[-0.3, 0.1, 0.4]}>
        <meshStandardMaterial color="#222" />
      </Sphere>
      <Sphere args={[0.15, 16, 16]} position={[0.3, 0.1, -0.4]}>
        <meshStandardMaterial color="#222" />
      </Sphere>
      <Sphere args={[0.15, 16, 16]} position={[-0.3, 0.1, -0.4]}>
        <meshStandardMaterial color="#222" />
      </Sphere>
      
      <Box args={[0.4, 0.6, 0.4]} position={[0, 0.8, 0]}>
        <meshStandardMaterial color={cargoColor} />
      </Box>
      
      <Text position={[0, 1.2, 0]} fontSize={0.3} color="white" anchorX="center">
        R{id}
      </Text>
      
      <Text position={[0, 1.5, 0]} fontSize={0.15} color="#00ff00" anchorX="center">
        {visualTask}
      </Text>
      
      {!stateRef.current.isAtTarget && (stateRef.current.task === 'moving_to_shelf' || stateRef.current.task === 'moving_to_dock') && (
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
      )}
    </group>
  )
}


// Keep Shelf and DockingStation components the same...
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
  return (
    <group position={position}>
      <Box args={[3, 0.1, 3]} position={[0, 0.05, 0]}>
        <meshStandardMaterial color="#222222" metalness={0.8} roughness={0.2} />
      </Box>
      <Box args={[0.2, 1, 0.2]} position={[1.2, 0.5, 1.2]}>
        <meshStandardMaterial color="#444" />
      </Box>
      <Box args={[0.2, 1, 0.2]} position={[-1.2, 0.5, 1.2]}>
        <meshStandardMaterial color="#444" />
      </Box>
      <Box args={[0.2, 1, 0.2]} position={[1.2, 0.5, -1.2]}>
        <meshStandardMaterial color="#444" />
      </Box>
      <Box args={[0.2, 1, 0.2]} position={[-1.2, 0.5, -1.2]}>
        <meshStandardMaterial color="#444" />
      </Box>
      <Text position={[0, 1.5, 0]} fontSize={0.4} color="#00ff00" anchorX="center">
        DOCK
      </Text>
    </group>
  )
}

export default function WarehouseScene() {
  const shelfPositions: [number, number, number][] = [
    [8, 0, 0],
    [8, 0, 3],
    [8, 0, -3],
    [-8, 0, 0],
    [-8, 0, 3],
    [-8, 0, -3],
  ]
  
  return (
    <div className="w-full h-full">
      <Canvas 
        camera={{ position: [15, 15, 15], fov: 50 }} 
        shadows
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <color attach="background" args={['#0a0a0a']} />
        
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
        
        <Grid 
          args={[20, 20]} 
          cellColor="#6080ff" 
          sectionColor="#3060ff" 
          fadeDistance={30}
          fadeStrength={1}
        />
        
        <DockingStation position={[0, 0, 0]} />
        
        <Robot position={[2, 0, 2]} id={1} color="#ff6b35" shelfPositions={shelfPositions} />
        <Robot position={[-2, 0, 2]} id={2} color="#f7931e" shelfPositions={shelfPositions} />
        <Robot position={[2, 0, -2]} id={3} color="#00d9ff" shelfPositions={shelfPositions} />
        <Robot position={[-2, 0, -2]} id={4} color="#7209b7" shelfPositions={shelfPositions} />
        
        {shelfPositions.map((pos, i) => (
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
