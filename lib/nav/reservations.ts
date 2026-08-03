import type { Cell, RobotId, TimedPath } from './types'

interface ParkedReservation {
  robot: RobotId
  cell: Cell
  fromTick: number
}

export function vertexKey(cell: Cell): string {
  return `${cell.x},${cell.z}`
}

export function edgeKey(from: Cell, to: Cell): string {
  return `${from.x},${from.z}>${to.x},${to.z}`
}

function sameCell(first: Cell, second: Cell): boolean {
  return first.x === second.x && first.z === second.z
}

function isIntegerCell(cell: Cell): boolean {
  return Number.isInteger(cell.x) && Number.isInteger(cell.z)
}

export class ReservationTable {
  private vertex = new Map<number, Map<string, RobotId>>()
  private edge = new Map<number, Map<string, RobotId>>()
  private parkedByCell = new Map<string, ParkedReservation>()
  private parkedByRobot = new Map<RobotId, ParkedReservation>()

  canReserveVertex(cell: Cell, tick: number, robot: RobotId): boolean {
    const parked = this.parkedByCell.get(vertexKey(cell))
    if (parked && parked.robot !== robot && tick >= parked.fromTick) return false

    const owner = this.vertex.get(tick)?.get(vertexKey(cell))
    return owner === undefined || owner === robot
  }

  canReserveEdge(from: Cell, to: Cell, tick: number, robot: RobotId): boolean {
    const edges = this.edge.get(tick)
    if (!edges) return true

    const forwardOwner = edges.get(edgeKey(from, to))
    if (forwardOwner !== undefined && forwardOwner !== robot) return false

    const reverseOwner = edges.get(edgeKey(to, from))
    return reverseOwner === undefined || reverseOwner === robot
  }

  canCommitPath(path: TimedPath, robot: RobotId): boolean {
    if (!this.isValidPath(path)) return false

    const parked = this.parkedByRobot.get(robot)
    if (parked) {
      const first = path[0]
      if (first.tick >= parked.fromTick && !sameCell(first, parked.cell)) return false
    }

    for (let index = 0; index < path.length; index++) {
      const step = path[index]
      if (!this.canReserveVertex(step, step.tick, robot)) return false

      if (index > 0) {
        const previous = path[index - 1]
        if (!sameCell(previous, step) && !this.canReserveEdge(previous, step, step.tick, robot)) {
          return false
        }
      }
    }
    return true
  }

  commitPath(path: TimedPath, robot: RobotId, parkFromTick?: number): boolean {
    if (!this.canCommitPath(path, robot)) return false

    const parkingStep = parkFromTick === undefined
      ? undefined
      : path.find((step) => step.tick === parkFromTick)
    if (
      parkFromTick !== undefined &&
      (!Number.isInteger(parkFromTick) || parkingStep === undefined || !this.canParkRobot(parkingStep, robot, parkFromTick))
    ) {
      return false
    }

    const firstTick = path[0].tick
    const parked = this.parkedByRobot.get(robot)
    const departsParkedCell = parked !== undefined && path.some((step) => !sameCell(step, parked.cell))

    this.truncateFrom(robot, firstTick)
    if (departsParkedCell) this.clearParked(robot)

    for (let index = 0; index < path.length; index++) {
      const step = path[index]
      this.reserveVertex(step, step.tick, robot)
      if (index > 0) {
        const previous = path[index - 1]
        if (!sameCell(previous, step)) this.reserveEdge(previous, step, step.tick, robot)
      }
    }
    if (parkingStep) this.parkRobot(parkingStep, robot, parkingStep.tick)
    return true
  }

  canParkRobot(cell: Cell, robot: RobotId, fromTick: number): boolean {
    if (!isIntegerCell(cell) || !Number.isInteger(fromTick) || fromTick < 0) return false

    const parked = this.parkedByCell.get(vertexKey(cell))
    if (parked && parked.robot !== robot) return false

    for (const [tick, vertices] of this.vertex) {
      const owner = vertices.get(vertexKey(cell))
      if (tick >= fromTick && owner !== undefined && owner !== robot) return false
    }

    return true
  }

  parkRobot(cell: Cell, robot: RobotId, fromTick: number): boolean {
    if (!this.canParkRobot(cell, robot, fromTick)) return false

    this.clearParked(robot)
    this.truncateFrom(robot, fromTick + 1)
    const reservation: ParkedReservation = { robot, cell: { ...cell }, fromTick }
    this.parkedByCell.set(vertexKey(cell), reservation)
    this.parkedByRobot.set(robot, reservation)
    return true
  }

  clearParked(robot: RobotId): void {
    const parked = this.parkedByRobot.get(robot)
    if (!parked) return
    this.parkedByCell.delete(vertexKey(parked.cell))
    this.parkedByRobot.delete(robot)
  }

  truncateFrom(robot: RobotId, fromTickInclusive: number): void {
    for (const [tick, vertices] of [...this.vertex]) {
      if (tick < fromTickInclusive) continue
      for (const [key, owner] of vertices) {
        if (owner === robot) vertices.delete(key)
      }
      if (vertices.size === 0) this.vertex.delete(tick)
    }
    for (const [tick, edges] of [...this.edge]) {
      if (tick < fromTickInclusive) continue
      for (const [key, owner] of edges) {
        if (owner === robot) edges.delete(key)
      }
      if (edges.size === 0) this.edge.delete(tick)
    }
  }

  releaseRobot(robot: RobotId): void {
    this.clearParked(robot)
    this.truncateFrom(robot, Number.NEGATIVE_INFINITY)
  }

  pruneBefore(tick: number): void {
    for (const reservedTick of [...this.vertex.keys()]) {
      if (reservedTick < tick) this.vertex.delete(reservedTick)
    }
    for (const reservedTick of [...this.edge.keys()]) {
      if (reservedTick < tick) this.edge.delete(reservedTick)
    }
  }

  isParkedAt(cell: Cell, tick?: number): boolean {
    const parked = this.parkedByCell.get(vertexKey(cell))
    return parked !== undefined && (tick === undefined || tick >= parked.fromTick)
  }

  parkedOccupant(cell: Cell, tick?: number): RobotId | undefined {
    const parked = this.parkedByCell.get(vertexKey(cell))
    if (!parked || (tick !== undefined && tick < parked.fromTick)) return undefined
    return parked.robot
  }

  vertexOccupant(cell: Cell, tick: number): RobotId | undefined {
    return this.vertex.get(tick)?.get(vertexKey(cell))
  }

  edgeOccupant(from: Cell, to: Cell, tick: number): RobotId | undefined {
    return this.edge.get(tick)?.get(edgeKey(from, to))
  }

  lastReservedTick(robot: RobotId): number | undefined {
    let lastTick: number | undefined
    for (const [tick, vertices] of this.vertex) {
      if ([...vertices.values()].includes(robot) && (lastTick === undefined || tick > lastTick)) {
        lastTick = tick
      }
    }
    return lastTick
  }

  private isValidPath(path: TimedPath): boolean {
    if (path.length === 0) return false
    for (let index = 0; index < path.length; index++) {
      const step = path[index]
      if (!isIntegerCell(step) || !Number.isInteger(step.tick) || step.tick < 0) return false
      if (index === 0) continue

      const previous = path[index - 1]
      const distance = Math.abs(step.x - previous.x) + Math.abs(step.z - previous.z)
      if (step.tick !== previous.tick + 1 || distance > 1) return false
    }
    return true
  }

  private reserveVertex(cell: Cell, tick: number, robot: RobotId): void {
    let vertices = this.vertex.get(tick)
    if (!vertices) {
      vertices = new Map()
      this.vertex.set(tick, vertices)
    }
    vertices.set(vertexKey(cell), robot)
  }

  private reserveEdge(from: Cell, to: Cell, tick: number, robot: RobotId): void {
    let edges = this.edge.get(tick)
    if (!edges) {
      edges = new Map()
      this.edge.set(tick, edges)
    }
    edges.set(edgeKey(from, to), robot)
  }
}