'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { Box, Grid, OrbitControls, Sphere } from '@react-three/drei'
import { RotateCcw } from 'lucide-react'
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
const FRAME_TIMEOUT_MESSAGE = 'The browser did not execute the 3D animation frame.'
const FRAME_FALLBACK_MS = 1000 / 30

function installAnimationFrameFallback() {
  if (typeof window === 'undefined') return

  const patchedWindow = window as Window & { warehouseAnimationFrameFallback?: boolean }
  if (patchedWindow.warehouseAnimationFrameFallback) return

  const nativeRequest = window.requestAnimationFrame.bind(window)
  const nativeCancel = window.cancelAnimationFrame.bind(window)
  const pendingFrames = new Map<number, { native: number; fallback: number }>()
  let nextFrame = 1

  patchedWindow.requestAnimationFrame = (callback) => {
    const frame = nextFrame++
    let completed = false
    const run = (timestamp: number) => {
      if (completed) return
      completed = true
      const pending = pendingFrames.get(frame)
      if (pending) {
        nativeCancel(pending.native)
        clearTimeout(pending.fallback)
        pendingFrames.delete(frame)
      }
      callback(timestamp)
    }
    const native = nativeRequest(run)
    const fallback = window.setTimeout(() => run(performance.now()), FRAME_FALLBACK_MS)
    pendingFrames.set(frame, { native, fallback })
    return frame
  }

  patchedWindow.cancelAnimationFrame = (frame) => {
    const pending = pendingFrames.get(frame)
    if (!pending) return
    nativeCancel(pending.native)
    clearTimeout(pending.fallback)
    pendingFrames.delete(frame)
  }
  patchedWindow.warehouseAnimationFrameFallback = true
}

installAnimationFrameFallback()

interface RobotProps {
  robot: RobotSnapshot
  getPose: (id: number) => RobotRenderPose | undefined
}

interface SceneErrorBoundaryProps {
  children: ReactNode
  onError: (message: string) => void
}

class SceneErrorBoundary extends Component<SceneErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    this.props.onError(error.message)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

function RenderHeartbeat({ onFirstFrame }: { onFirstFrame: () => void }) {
  const rendered = useRef(false)

  useFrame(() => {
    if (rendered.current) return
    rendered.current = true
    onFirstFrame()
  })

  return null
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

function LabelSprite({
  text,
  position,
  color,
  height,
}: {
  text: string
  position: [number, number, number]
  color: string
  height: number
}) {
  const label = useMemo(() => {
    const fontSize = 48
    const padding = 12
    const canvas = document.createElement('canvas')
    const measure = canvas.getContext('2d')
    if (!measure) throw new Error('Canvas 2D text rendering is unavailable.')

    measure.font = `600 ${fontSize}px sans-serif`
    canvas.width = Math.ceil(measure.measureText(text).width) + padding * 2
    canvas.height = fontSize + padding * 2

    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D text rendering is unavailable.')
    context.font = `600 ${fontSize}px sans-serif`
    context.fillStyle = color
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(text, canvas.width / 2, canvas.height / 2)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return { texture, aspect: canvas.width / canvas.height }
  }, [color, text])

  useEffect(() => () => label.texture.dispose(), [label])

  return (
    <sprite position={position} scale={[height * label.aspect, height, 1]} renderOrder={10}>
      <spriteMaterial
        map={label.texture}
        transparent
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  )
}

function RobotLabels({ robot }: { robot: RobotSnapshot }) {
  return (
    <>
      <LabelSprite
        text={`R${robot.id} · ${Math.round(robot.battery)}%`}
        position={[0, 1.2, 0]}
        color={LABEL_COLOR}
        height={0.26}
      />
      <LabelSprite
        text={robot.retireWhenParked ? 'RETIRING' : robot.taskLabel.toUpperCase()}
        position={[0, 1.5, 0]}
        color={LABEL_COLOR}
        height={0.14}
      />
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
      <LabelSprite text={`D${id}`} position={[0, 0.75, 0]} color={DOCK_LABEL_COLOR} height={0.18} />
    </group>
  )
}

export default function WarehouseScene() {
  const { config, getRobotPose, navigationSnapshot } = useWarehouse()
  const [rendererFailure, setRendererFailure] = useState<string | null>(null)
  const [canvasKey, setCanvasKey] = useState(0)
  const firstFrameRendered = useRef(false)
  const width = config.grid.maxX - config.grid.minX
  const depth = config.grid.maxZ - config.grid.minZ
  const gridSize = Math.max(width, depth)

  useEffect(() => {
    const resize = setTimeout(() => window.dispatchEvent(new Event('resize')), 0)
    const watchdog = setTimeout(() => {
      if (!firstFrameRendered.current) {
        setRendererFailure(FRAME_TIMEOUT_MESSAGE)
      }
    }, 3000)

    return () => {
      clearTimeout(resize)
      clearTimeout(watchdog)
    }
  }, [canvasKey])

  const handleCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    gl.domElement.addEventListener('webglcontextlost', (event) => {
      event.preventDefault()
      setRendererFailure('The browser lost the WebGL graphics context.')
    }, { once: true })
  }, [])

  const handleFirstFrame = useCallback(() => {
    firstFrameRendered.current = true
    setRendererFailure((current) => current === FRAME_TIMEOUT_MESSAGE ? null : current)
  }, [])

  const retryRenderer = () => {
    firstFrameRendered.current = false
    setRendererFailure(null)
    setCanvasKey((current) => current + 1)
  }

  return (
    <div className="relative w-full h-full">
      <SceneErrorBoundary key={canvasKey} onError={setRendererFailure}>
        <Canvas
          camera={{ position: [15, 15, 15], fov: 50 }}
          dpr={[1, 1.5]}
          gl={{ antialias: false, powerPreference: 'default' }}
          onCreated={handleCreated}
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <RenderHeartbeat onFirstFrame={handleFirstFrame} />
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
      </SceneErrorBoundary>
      {rendererFailure && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card p-6 text-center">
          <p className="text-sm font-medium text-foreground">3D renderer unavailable</p>
          <p className="max-w-sm text-xs text-muted-foreground">{rendererFailure}</p>
          <button
            type="button"
            onClick={retryRenderer}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            <RotateCcw className="size-4" />
            Retry renderer
          </button>
        </div>
      )}
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