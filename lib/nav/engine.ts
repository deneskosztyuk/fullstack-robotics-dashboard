import { spaceTimeAStar } from './astar'
import { ClaimRegistry } from './claims'
import { MAX_ROBOT_COUNT, MIN_ROBOT_COUNT, assertConfig, createWarehouseConfig } from './config'
import { GridMap } from './grid'
import { ReservationTable } from './reservations'
import { Rng } from './rng'
import {
  createRobotRuntimeState,
  headingBetween,
  isMovingTask,
  routeStepAt,
  taskLabel,
  type PlanIntent,
  type RobotRuntimeState,
} from './tasks'
import type {
  Cell,
  EngineEvent,
  EngineEventListener,
  EngineListener,
  EngineRenderSnapshot,
  EngineSnapshot,
  LayoutId,
  RobotId,
  RobotRenderPose,
  RobotSnapshot,
  SimulationSpeed,
  WarehouseConfig,
} from './types'

const VALID_SPEEDS: readonly SimulationSpeed[] = [0.5, 1, 2]
const MAX_ENGINE_EVENTS = 100

function cloneConfig(config: WarehouseConfig): WarehouseConfig {
  return structuredClone(config)
}

function sameCell(first: Cell, second: Cell): boolean {
  return first.x === second.x && first.z === second.z
}

function manhattan(first: Cell, second: Cell): number {
  return Math.abs(first.x - second.x) + Math.abs(first.z - second.z)
}

export class NavigationEngine {
  private config: WarehouseConfig
  private grid: GridMap
  private reservations = new ReservationTable()
  private claims = new ClaimRegistry()
  private rng: Rng
  private robots = new Map<RobotId, RobotRuntimeState>()
  private listeners = new Set<EngineListener>()
  private eventListeners = new Set<EngineEventListener>()
  private events: EngineEvent[] = []
  private tick = 0
  private accumulatorMs = 0
  private paused = false
  private speed: SimulationSpeed = 1
  private generation = 0
  private nextRobotId = 1
  private desiredRobotCount: number
  private completedOrders = 0
  private completedTransfers = 0
  private orderCompletionTicks: number[] = []
  private cycleTimesTicks: number[] = []
  private nextEventId = 0
  private spawnWarningEmitted = false

  constructor(config: WarehouseConfig = createWarehouseConfig()) {
    this.config = cloneConfig(assertConfig(cloneConfig(config)))
    this.desiredRobotCount = this.config.robotCount
    this.grid = new GridMap(this.config)
    this.rng = new Rng(this.config.seed)
    this.initializeRobots()
  }

  advance(dtMs: number): void {
    if (this.paused || !Number.isFinite(dtMs) || dtMs <= 0) return

    this.accumulatorMs = Math.min(
      this.accumulatorMs + dtMs * this.speed,
      this.config.tickMs * this.config.maxCatchUpSteps
    )

    let steps = 0
    while (this.accumulatorMs >= this.config.tickMs && steps < this.config.maxCatchUpSteps) {
      this.accumulatorMs -= this.config.tickMs
      this.runTick()
      steps++
    }
  }

  getSnapshot(): EngineSnapshot {
    const robots = [...this.robots.values()]
      .sort((first, second) => first.id - second.id)
      .map((robot) => this.toRobotSnapshot(robot))

    return {
      generation: this.generation,
      tick: this.tick,
      robots,
      completedOrders: this.completedOrders,
      completedTransfers: this.completedTransfers,
      deliveriesLast60Seconds: this.deliveriesInThroughputWindow(),
      avgCycleSeconds: this.averageCycleSeconds(),
      cycleSampleCount: this.cycleTimesTicks.length,
      paused: this.paused,
      speed: this.speed,
      layoutId: this.config.layoutId,
      desiredRobotCount: this.desiredRobotCount,
    }
  }

  getRenderSnapshot(): EngineRenderSnapshot {
    return {
      progress: this.config.tickMs === 0 ? 0 : this.accumulatorMs / this.config.tickMs,
      robots: [...this.robots.values()]
        .sort((first, second) => first.id - second.id)
        .map((robot) => ({
          id: robot.id,
          prevCell: { ...robot.prevCell },
          cell: { ...robot.cell },
          heading: robot.heading,
        })),
    }
  }

  getRobotRenderPose(id: RobotId): RobotRenderPose | undefined {
    const robot = this.robots.get(id)
    if (!robot) return undefined
    return {
      id,
      progress: this.config.tickMs === 0 ? 0 : this.accumulatorMs / this.config.tickMs,
      prevCell: { ...robot.prevCell },
      cell: { ...robot.cell },
      heading: robot.heading,
    }
  }

  getConfig(): WarehouseConfig {
    return cloneConfig(this.config)
  }

  getEvents(): EngineEvent[] {
    return this.events.map((event) => ({ ...event }))
  }

  subscribe(listener: EngineListener): () => void {
    this.listeners.add(listener)
    listener(this.getSnapshot())
    return () => this.listeners.delete(listener)
  }

  subscribeEvents(listener: EngineEventListener): () => void {
    this.eventListeners.add(listener)
    return () => this.eventListeners.delete(listener)
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return
    this.paused = paused
    this.emitSnapshot()
  }

  togglePause(): void {
    this.setPaused(!this.paused)
  }

  setSpeed(speed: SimulationSpeed): void {
    if (!VALID_SPEEDS.includes(speed)) throw new RangeError(`Unsupported simulation speed: ${speed}`)
    if (this.speed === speed) return
    this.speed = speed
    this.emitSnapshot()
  }

  setRobotCount(count: number): void {
    this.configureEnvironment(this.config.layoutId, count)
  }

  setLayout(layoutId: LayoutId): void {
    this.configureEnvironment(layoutId, this.desiredRobotCount)
  }

  configureEnvironment(layoutId: LayoutId, robotCount: number): void {
    if (!Number.isInteger(robotCount) || robotCount < MIN_ROBOT_COUNT || robotCount > MAX_ROBOT_COUNT) {
      throw new RangeError(`robot count must be between ${MIN_ROBOT_COUNT} and ${MAX_ROBOT_COUNT}`)
    }
    this.rebuild(createWarehouseConfig(layoutId, robotCount))
  }

  reset(): void {
    const nextConfig = cloneConfig(this.config)
    nextConfig.robotCount = this.desiredRobotCount
    this.rebuild(nextConfig)
  }

  private rebuild(config: WarehouseConfig): void {
    const retainedSpeed = this.speed
    this.config = cloneConfig(assertConfig(cloneConfig(config)))
    this.grid = new GridMap(this.config)
    this.reservations = new ReservationTable()
    this.claims = new ClaimRegistry()
    this.rng = new Rng(this.config.seed)
    this.robots = new Map()
    this.events = []
    this.tick = 0
    this.accumulatorMs = 0
    this.paused = false
    this.speed = retainedSpeed
    this.generation++
    this.nextRobotId = 1
    this.completedOrders = 0
    this.completedTransfers = 0
    this.orderCompletionTicks = []
    this.cycleTimesTicks = []
    this.nextEventId = 0
    this.spawnWarningEmitted = false
    this.desiredRobotCount = this.config.robotCount
    this.initializeRobots()
    this.emitSnapshot()
  }

  private initializeRobots(): void {
    for (let index = 0; index < this.config.robotCount; index++) {
      const spawn = this.config.spawnCells[index]
      this.addRobotAt(spawn, false)
    }
  }

  private addRobotAt(spawn: Cell, emitEvent: boolean): RobotRuntimeState {
    const id = this.nextRobotId++
    const battery = this.rng.range(this.config.battery.initialMin, this.config.battery.initialMax)
    const robot = createRobotRuntimeState(
      id,
      spawn,
      battery,
      this.tick,
      this.config.retryBackoff.initialTicks
    )
    this.robots.set(id, robot)
    if (!this.reservations.parkRobot(spawn, id, this.tick)) {
      this.robots.delete(id)
      throw new Error(`Unable to reserve spawn cell ${spawn.x},${spawn.z} for robot ${id}`)
    }
    this.beginShelfRequest(robot)
    if (emitEvent) {
      this.emitEvent('activity', 'info', `Robot #${id} joined the fleet`, id)
    }
    return robot
  }

  private runTick(): void {
    this.tick++
    for (const robot of this.robots.values()) robot.prevCell = { ...robot.cell }

    for (const robot of [...this.robots.values()]) this.advanceStationaryTask(robot)
    for (const robot of [...this.robots.values()]) this.advanceMovingRobot(robot)
    for (const robot of [...this.robots.values()]) this.handleLowBattery(robot)

    this.reconcileRobotCount(false)
    this.prepareResourceClaims()
    this.processPlanningQueue()
    this.reservations.pruneBefore(this.tick)
    this.pruneMetricWindows()
    this.emitSnapshot()
  }

  private advanceStationaryTask(robot: RobotRuntimeState): void {
    switch (robot.kind) {
      case 'picking':
        robot.remainingTaskTicks--
        if (robot.remainingTaskTicks <= 0) {
          robot.hasCargo = true
          this.emitEvent('activity', 'info', `Robot #${robot.id} picked items`, robot.id)
          if (robot.jobDestination === 'shelf') {
            this.beginShelfDropRequest(robot)
          } else {
            this.beginDockRequest(robot, 'dock_delivery')
          }
        }
        break
      case 'dropping_off':
        robot.remainingTaskTicks--
        if (robot.remainingTaskTicks <= 0) this.completeTransfer(robot)
        break
      case 'delivering':
        robot.remainingTaskTicks--
        if (robot.remainingTaskTicks <= 0) this.completeDelivery(robot)
        break
      case 'charging':
        robot.battery = Math.min(
          100,
          robot.battery + this.config.battery.chargePerSecond * (this.config.tickMs / 1000)
        )
        if (robot.battery >= this.config.battery.fullThreshold) {
          robot.needsCharge = false
          this.emitEvent('activity', 'info', `Robot #${robot.id} charged, resuming operations`, robot.id)
          this.beginShelfRequest(robot)
        }
        break
    }
  }

  private advanceMovingRobot(robot: RobotRuntimeState): void {
    if (!isMovingTask(robot.kind)) return

    const step = routeStepAt(robot.route, this.tick)
    if (!step) {
      this.emitEvent('alert', 'error', `Robot #${robot.id} lost its reserved route`, robot.id)
      this.reservations.truncateFrom(robot.id, this.tick)
      this.reservations.parkRobot(robot.cell, robot.id, this.tick)
      robot.route = []
      robot.arrivalTick = undefined
      robot.kind = 'wait_path'
      robot.retryAtTick = this.tick
      return
    }

    robot.heading = headingBetween(robot.cell, step, robot.heading)
    robot.cell = { x: step.x, z: step.z }
    robot.battery = Math.max(
      0,
      robot.battery - this.config.battery.drainPerSecond * (this.config.tickMs / 1000)
    )

    if (robot.arrivalTick === this.tick) this.finishArrival(robot)
  }

  private finishArrival(robot: RobotRuntimeState): void {
    if (!this.reservations.parkRobot(robot.cell, robot.id, this.tick)) {
      throw new Error(`Unable to park robot ${robot.id} at its reserved destination`)
    }
    robot.route = []
    robot.arrivalTick = undefined

    if (robot.retireWhenParked) {
      this.removeRobot(robot, true)
      return
    }

    switch (robot.kind) {
      case 'to_shelf':
        if (robot.needsCharge && robot.planIntent === 'dock_charge') {
          robot.kind = 'wait_dock'
        } else {
          robot.kind = 'picking'
          robot.remainingTaskTicks = this.config.pickDurationTicks
          this.emitEvent('activity', 'info', `Robot #${robot.id} started picking`, robot.id)
        }
        break
      case 'to_shelf_drop':
        robot.kind = 'dropping_off'
        robot.remainingTaskTicks = this.config.shelfDropDurationTicks
        this.emitEvent(
          'activity',
          'info',
          `Robot #${robot.id} started shelf drop-off at ${robot.destinationShelfId}`,
          robot.id
        )
        break
      case 'to_dock':
        robot.kind = 'delivering'
        robot.remainingTaskTicks = this.config.deliverDurationTicks
        break
      case 'to_charge':
        robot.kind = 'charging'
        this.emitEvent('activity', 'info', `Robot #${robot.id} started charging`, robot.id)
        break
    }
  }

  private completeDelivery(robot: RobotRuntimeState): void {
    robot.hasCargo = false
    this.completedOrders++
    this.orderCompletionTicks.push(this.tick)
    this.recordCycleTime(robot)
    this.emitEvent(
      'activity',
      'info',
      `Robot #${robot.id} completed order #${this.completedOrders}`,
      robot.id
    )

    if (robot.needsCharge || robot.battery <= this.config.battery.lowThreshold) {
      robot.needsCharge = true
      robot.kind = 'charging'
      this.emitEvent('activity', 'info', `Robot #${robot.id} started charging`, robot.id)
    } else {
      this.beginShelfRequest(robot)
    }
  }

  private completeTransfer(robot: RobotRuntimeState): void {
    robot.hasCargo = false
    this.completedTransfers++
    this.recordCycleTime(robot)
    this.emitEvent(
      'activity',
      'info',
      `Robot #${robot.id} completed shelf transfer #${this.completedTransfers} at ${robot.destinationShelfId}`,
      robot.id
    )
    this.releaseShelfClaims(robot)
    if (robot.needsCharge || robot.battery <= this.config.battery.lowThreshold) {
      robot.needsCharge = true
      this.beginDockRequest(robot, 'dock_charge')
    } else {
      this.beginShelfRequest(robot)
    }
  }

  private recordCycleTime(robot: RobotRuntimeState): void {
    this.cycleTimesTicks.push(this.tick - robot.cycleStartTick)
    if (this.cycleTimesTicks.length > this.config.maxCycleSamples) this.cycleTimesTicks.shift()
  }

  private handleLowBattery(robot: RobotRuntimeState): void {
    if (robot.kind === 'charging' || robot.battery > this.config.battery.lowThreshold) return
    robot.needsCharge = true
    if (robot.hasCargo) return
    if (robot.planIntent === 'dock_charge' || robot.kind === 'to_charge' || robot.kind === 'wait_dock') {
      return
    }

    if (robot.dockId !== undefined && this.isAtDock(robot, robot.dockId)) {
      robot.kind = 'charging'
      robot.planIntent = undefined
      return
    }

    this.releaseShelfClaims(robot)
    this.emitEvent(
      'alert',
      'warning',
      `Robot #${robot.id} battery low, returning to dock`,
      robot.id
    )
    this.beginDockRequest(robot, 'dock_charge')
  }

  private beginShelfRequest(robot: RobotRuntimeState): void {
    this.releaseShelfClaims(robot)
    robot.jobDestination = this.config.shelves.length > 1 &&
      this.rng.next() < this.config.transferProbability
      ? 'shelf'
      : 'dock'
    robot.planIntent = 'shelf_pickup'
    robot.kind = 'wait_path'
    this.resetWaitingState(robot)
  }

  private beginShelfDropRequest(robot: RobotRuntimeState): void {
    robot.planIntent = 'shelf_drop'
    robot.kind = 'wait_path'
    this.resetWaitingState(robot)
  }

  private beginDockRequest(robot: RobotRuntimeState, intent: 'dock_delivery' | 'dock_charge'): void {
    robot.planIntent = intent
    if (!isMovingTask(robot.kind)) robot.kind = 'wait_dock'
    this.resetWaitingState(robot)
  }

  private resetWaitingState(robot: RobotRuntimeState): void {
    robot.waitingSinceTick = this.tick
    robot.retryAtTick = this.tick
    robot.retryDelayTicks = this.config.retryBackoff.initialTicks
    robot.planFailureWarned = false
  }

  private prepareResourceClaims(): void {
    for (const robot of [...this.robots.values()].sort((first, second) => first.id - second.id)) {
      if (robot.planIntent === 'shelf_pickup' && robot.shelfId === undefined) {
        const shelf = this.rng.pick(this.claims.availableShelves(this.config.shelves))
        if (shelf && this.claims.claimShelf(shelf.id, robot.id)) robot.shelfId = shelf.id
      }

      if (
        robot.jobDestination === 'shelf' &&
        robot.shelfId !== undefined &&
        robot.destinationShelfId === undefined
      ) {
        const destination = this.rng.pick(
          this.claims.availableShelves(this.config.shelves)
            .filter((shelf) => shelf.id !== robot.shelfId)
        )
        if (destination && this.claims.claimShelf(destination.id, robot.id)) {
          robot.destinationShelfId = destination.id
        }
      }

      if (
        (robot.planIntent === 'dock_delivery' || robot.planIntent === 'dock_charge') &&
        robot.dockId === undefined
      ) {
        const docks = this.claims.availableDocks(this.config.docks)
          .sort((first, second) =>
            manhattan(robot.cell, first.cell) - manhattan(robot.cell, second.cell) || first.id - second.id
          )
        const dock = docks[0]
        if (dock && this.claims.claimDock(dock.id, robot.id)) robot.dockId = dock.id
      }
    }
  }

  private processPlanningQueue(): void {
    const candidates = [...this.robots.values()]
      .filter((robot) => robot.planIntent !== undefined && this.goalFor(robot) !== undefined)
      .filter((robot) => robot.retryAtTick <= this.tick)
      .sort((first, second) => {
        const scoreDifference = this.planPriority(second) - this.planPriority(first)
        return scoreDifference || first.waitingSinceTick - second.waitingSinceTick || first.id - second.id
      })
      .slice(0, this.config.maxPlansPerTick)

    for (const robot of candidates) this.planRobot(robot)
  }

  private planRobot(robot: RobotRuntimeState): void {
    const intent = robot.planIntent
    const goal = this.goalFor(robot)
    if (!intent || !goal) return

    const plan = spaceTimeAStar({
      grid: this.grid,
      reservations: this.reservations,
      robot: robot.id,
      start: robot.cell,
      goal,
      startTick: this.tick,
      horizon: this.config.horizon,
    })

    if (!plan || !this.reservations.commitPath(plan.path, robot.id, plan.arrivalTick)) {
      if (routeStepAt(robot.route, this.tick + 1) === undefined) {
        robot.kind = intent === 'dock_delivery' || intent === 'dock_charge' ? 'wait_dock' : 'wait_path'
      }
      robot.retryAtTick = this.tick + robot.retryDelayTicks
      robot.retryDelayTicks = Math.min(
        robot.retryDelayTicks * 2,
        this.config.retryBackoff.maxTicks
      )
      if (!robot.planFailureWarned) {
        this.emitEvent('alert', 'warning', `Robot #${robot.id} is waiting for a route`, robot.id)
        robot.planFailureWarned = true
      }
      return
    }

    robot.route = plan.path
    robot.arrivalTick = plan.arrivalTick
    robot.planIntent = undefined
    robot.planFailureWarned = false
    robot.retryDelayTicks = this.config.retryBackoff.initialTicks

    if (intent === 'shelf_pickup') {
      robot.kind = 'to_shelf'
      robot.cycleStartTick = this.tick
      if (robot.dockId !== undefined) {
        this.claims.releaseDock(robot.dockId, robot.id)
        robot.dockId = undefined
      }
    } else if (intent === 'shelf_drop') {
      robot.kind = 'to_shelf_drop'
    } else {
      robot.kind = intent === 'dock_delivery' ? 'to_dock' : 'to_charge'
      this.releaseShelfClaims(robot)
    }

    if (plan.arrivalTick === this.tick) this.finishArrival(robot)
  }

  private goalFor(robot: RobotRuntimeState): Cell | undefined {
    if (robot.planIntent === 'shelf_pickup') {
      return this.config.shelves.find((shelf) => shelf.id === robot.shelfId)?.pickCell
    }
    if (robot.planIntent === 'shelf_drop') {
      return this.config.shelves.find((shelf) => shelf.id === robot.destinationShelfId)?.pickCell
    }
    if (robot.planIntent === 'dock_delivery' || robot.planIntent === 'dock_charge') {
      return this.config.docks.find((dock) => dock.id === robot.dockId)?.cell
    }
    return undefined
  }

  private planPriority(robot: RobotRuntimeState): number {
    const urgency: Record<PlanIntent, number> = {
      shelf_pickup: 0,
      shelf_drop: 250,
      dock_delivery: 500,
      dock_charge: 1_000,
    }
    return urgency[robot.planIntent!] + (this.tick - robot.waitingSinceTick)
  }

  private reconcileRobotCount(emitEvents: boolean): void {
    let projectedCount = this.robots.size - [...this.robots.values()].filter((robot) => robot.retireWhenParked).length

    if (projectedCount < this.desiredRobotCount) {
      for (const robot of [...this.robots.values()].sort((first, second) => first.id - second.id)) {
        if (!robot.retireWhenParked || projectedCount >= this.desiredRobotCount) continue
        robot.retireWhenParked = false
        projectedCount++
      }
    }

    while (projectedCount < this.desiredRobotCount) {
      const spawn = this.findFreeSpawn()
      if (!spawn) {
        if (!this.spawnWarningEmitted) {
          this.emitEvent('alert', 'warning', 'No free spawn cell is available')
          this.spawnWarningEmitted = true
        }
        break
      }
      this.addRobotAt(spawn, emitEvents)
      projectedCount++
      this.spawnWarningEmitted = false
    }

    if (projectedCount > this.desiredRobotCount) {
      const candidates = [...this.robots.values()].sort((first, second) => second.id - first.id)
      for (const robot of candidates) {
        if (projectedCount <= this.desiredRobotCount || robot.retireWhenParked) continue
        if (isMovingTask(robot.kind)) {
          robot.retireWhenParked = true
        } else {
          this.removeRobot(robot, emitEvents)
        }
        projectedCount--
      }
    }
  }

  private findFreeSpawn(): Cell | undefined {
    const candidateRobotId = this.nextRobotId
    return this.config.spawnCells.find((spawn) =>
      this.reservations.canParkRobot(spawn, candidateRobotId, this.tick)
    )
  }

  private removeRobot(robot: RobotRuntimeState, emitEvent: boolean): void {
    this.reservations.releaseRobot(robot.id)
    this.claims.releaseRobot(robot.id)
    this.robots.delete(robot.id)
    if (emitEvent) {
      this.emitEvent('activity', 'info', `Robot #${robot.id} left the fleet`, robot.id)
    }
  }

  private releaseShelfClaims(robot: RobotRuntimeState): void {
    if (robot.shelfId !== undefined) this.claims.releaseShelf(robot.shelfId, robot.id)
    if (robot.destinationShelfId !== undefined) {
      this.claims.releaseShelf(robot.destinationShelfId, robot.id)
    }
    robot.shelfId = undefined
    robot.destinationShelfId = undefined
  }

  private isAtDock(robot: RobotRuntimeState, dockId: number): boolean {
    const dock = this.config.docks.find((candidate) => candidate.id === dockId)
    return dock !== undefined && sameCell(robot.cell, dock.cell)
  }

  private pruneMetricWindows(): void {
    const earliestTick = this.tick - this.config.throughputWindowTicks
    this.orderCompletionTicks = this.orderCompletionTicks
      .filter((tick) => tick >= earliestTick)
      .slice(-this.config.maxCompletedOrdersHistory)
  }

  private deliveriesInThroughputWindow(): number {
    const earliestTick = this.tick - this.config.throughputWindowTicks
    return this.orderCompletionTicks.filter((tick) => tick >= earliestTick).length
  }

  private averageCycleSeconds(): number {
    if (this.cycleTimesTicks.length === 0) return 0
    const averageTicks = this.cycleTimesTicks.reduce((sum, ticks) => sum + ticks, 0) / this.cycleTimesTicks.length
    return averageTicks * (this.config.tickMs / 1000)
  }

  private toRobotSnapshot(robot: RobotRuntimeState): RobotSnapshot {
    return {
      id: robot.id,
      kind: robot.kind,
      shelfId: robot.shelfId,
      destinationShelfId: robot.destinationShelfId,
      dockId: robot.dockId,
      arrivalTick: robot.arrivalTick,
      waitingSinceTick: robot.waitingSinceTick,
      battery: robot.battery,
      hasCargo: robot.hasCargo,
      needsCharge: robot.needsCharge,
      retireWhenParked: robot.retireWhenParked,
      prevCell: { ...robot.prevCell },
      cell: { ...robot.cell },
      heading: robot.heading,
      taskLabel: taskLabel(robot.kind),
    }
  }

  private emitEvent(
    kind: EngineEvent['kind'],
    severity: EngineEvent['severity'],
    message: string,
    robot?: RobotId
  ): void {
    const event: EngineEvent = {
      id: this.nextEventId++,
      kind,
      severity,
      robot,
      message,
      tick: this.tick,
    }
    this.events = [...this.events, event].slice(-MAX_ENGINE_EVENTS)
    for (const listener of this.eventListeners) listener({ ...event })
  }

  private emitSnapshot(): void {
    const snapshot = this.getSnapshot()
    for (const listener of this.listeners) listener(snapshot)
  }
}