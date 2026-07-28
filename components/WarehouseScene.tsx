'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { Box, Grid, OrbitControls, Sphere, Text } from '@react-three/drei'
import { useRef } from 'react'
import * as THREE from 'three'
import { useWarehouse } from '@/lib/WarehouseContext'
import type { RobotRenderPose, RobotSnapshot } from '@/lib/nav'

const TURN_SPEED = 6

const ROBOT_BODY_COLOR = '#d4d4d8'
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

interface RobotProps {
  robot: RobotSnapshot
  getPose: (id: number) => RobotRenderPose | undefined
}

function Robot({ robot, getPose }: RobotProps) {
  const ref = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (!ref.current) return
    const pose = getPose(robot.id)
    if (!pose) return

    ref.current.position.set(
      THREE.MathUtils.lerp(pose.prevCell.x, pose.cell.x, pose.progress),
      0,
      THREE.MathUtils.lerp(pose.prevCell.z, pose.cell.z, pose.progress)
    )

    const difference = Math.atan2(
      Math.sin(pose.heading - ref.current.rotation.y),
      Math.cos(pose.heading - ref.current.rotation.y)
    )
    ref.current.rotation.y += Math.sign(difference) * Math.min(Math.abs(difference), delta * TURN_SPEED)
  })

  return (
    <group ref={ref} position={[robot.cell.x, 0, robot.cell.z]} rotation={[0, robot.heading, 0]}>
      <RobotBody />
      <RobotWheels />
      <RobotCargo loaded={robot.hasCargo} />
      <RobotLabels robot={robot} />
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
  const positions: [number, number, number][] = [
    [0.3, 0.1, 0.4],
    [-0.3, 0.1, 0.4],
    [0.3, 0.1, -0.4],
    [-0.3, 0.1, -0.4],
  ]

  return (
    <>
      {positions.map((position, index) => (
        <Sphere key={index} args={[0.15, 16, 16]} position={position}>
          <meshStandardMaterial color={WHEEL_COLOR} />
        </Sphere>
      ))}
    </>
  )
}

function RobotCargo({ loaded }: { loaded: boolean }) {
  return (
    <Box args={[0.4, 0.6, 0.4]} position={[0, 0.8, 0]}>
      <meshStandardMaterial color={loaded ? CARGO_LOADED_COLOR : CARGO_EMPTY_COLOR} />
    </Box>
  )
}

function RobotLabels({ robot }: { robot: RobotSnapshot }) {
  return (
    <>
      <Text position={[0, 1.2, 0]} fontSize={0.26} color={LABEL_COLOR} anchorX="center">
        R{robot.id} · {Math.round(robot.battery)}%
      </Text>
      <Text position={[0, 1.5, 0]} fontSize={0.14} color={LABEL_COLOR} anchorX="center">
        {robot.retireWhenParked ? 'RETIRING' : robot.taskLabel.toUpperCase()}
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
      {[0.6, 1.2, 1.8].map((height) => (
        <Box key={height} args={[1.5, 0.1, 0.5]} position={[0, height, 0]}>
          <meshStandardMaterial color={SHELF_SHELF_COLOR} />
        </Box>
      ))}
    </group>
  )
}

function DockingStation({ id, position }: { id: number; position: [number, number, number] }) {
  const posts: [number, number, number][] = [
    [0.38, 0.25, 0.38],
    [-0.38, 0.25, 0.38],
    [0.38, 0.25, -0.38],
    [-0.38, 0.25, -0.38],
  ]

  return (
    <group position={position}>
      <Box args={[0.95, 0.08, 0.95]} position={[0, 0.04, 0]}>
        <meshStandardMaterial color={DOCK_BASE_COLOR} metalness={0.8} roughness={0.2} />
      </Box>
      {posts.map((post, index) => (
        <Box key={index} args={[0.08, 0.5, 0.08]} position={post}>
          <meshStandardMaterial color={DOCK_POST_COLOR} />
        </Box>
      ))}
      <Text position={[0, 0.75, 0]} fontSize={0.18} color={DOCK_LABEL_COLOR} anchorX="center">
        D{id}
      </Text>
    </group>
  )
}

export default function WarehouseScene() {
  const { config, getRobotPose, navigationSnapshot } = useWarehouse()
  const width = config.grid.maxX - config.grid.minX
  const depth = config.grid.maxZ - config.grid.minZ
  const gridSize = Math.max(width, depth)

  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [15, 15, 15], fov: 50 }}
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <color attach="background" args={[SCENE_BG_COLOR]} />
        <SceneLighting />
        <Grid
          args={[gridSize, gridSize]}
          cellColor={GRID_CELL_COLOR}
          sectionColor={GRID_SECTION_COLOR}
          fadeDistance={30}
          fadeStrength={1}
        />

        {config.docks.map((dock) => (
          <DockingStation
            key={dock.id}
            id={dock.id}
            position={[dock.cell.x, 0, dock.cell.z]}
          />
        ))}
        {config.shelves.map((shelf) => (
          <Shelf key={shelf.id} position={[shelf.cell.x, 0, shelf.cell.z]} />
        ))}
        {navigationSnapshot.robots.map((robot) => (
          <Robot key={robot.id} robot={robot} getPose={getRobotPose} />
        ))}

        <OrbitControls
          enablePan
          enableZoom
          enableRotate
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
      <directionalLight position={[10, 20, 10]} intensity={1} />
      <pointLight position={[-10, 10, -10]} intensity={0.5} color={LIGHT_PRIMARY_COLOR} />
      <spotLight
        position={[0, 10, 0]}
        intensity={0.3}
        color={LIGHT_NEUTRAL_COLOR}
        angle={0.3}
      />
    </>
  )
}