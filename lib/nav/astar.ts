import { GridMap } from './grid'
import { ReservationTable } from './reservations'
import type { Cell, RobotId, TimedPath } from './types'

export interface SpaceTimePlan {
  path: TimedPath
  arrivalTick: number
}

export interface SpaceTimeAStarOptions {
  grid: GridMap
  reservations: ReservationTable
  robot: RobotId
  start: Cell
  goal: Cell
  startTick: number
  horizon: number
}

interface SearchNode extends Cell {
  tick: number
  g: number
  h: number
  order: number
  parent?: SearchNode
}

class MinHeap<T> {
  private values: T[] = []

  constructor(private readonly compare: (first: T, second: T) => number) {}

  get size(): number {
    return this.values.length
  }

  push(value: T): void {
    this.values.push(value)
    let index = this.values.length - 1
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (this.compare(this.values[index], this.values[parent]) >= 0) break
      ;[this.values[index], this.values[parent]] = [this.values[parent], this.values[index]]
      index = parent
    }
  }

  pop(): T | undefined {
    const first = this.values[0]
    const last = this.values.pop()
    if (this.values.length > 0 && last !== undefined) {
      this.values[0] = last
      let index = 0
      while (true) {
        const left = index * 2 + 1
        const right = left + 1
        let smallest = index
        if (left < this.values.length && this.compare(this.values[left], this.values[smallest]) < 0) {
          smallest = left
        }
        if (right < this.values.length && this.compare(this.values[right], this.values[smallest]) < 0) {
          smallest = right
        }
        if (smallest === index) break
        ;[this.values[index], this.values[smallest]] = [this.values[smallest], this.values[index]]
        index = smallest
      }
    }
    return first
  }
}

function manhattan(first: Cell, second: Cell): number {
  return Math.abs(first.x - second.x) + Math.abs(first.z - second.z)
}

function sameCell(first: Cell, second: Cell): boolean {
  return first.x === second.x && first.z === second.z
}

function nodeKey(cell: Cell, tick: number): string {
  return `${cell.x},${cell.z},${tick}`
}

function reconstruct(node: SearchNode, endTick: number): TimedPath {
  const path: TimedPath = []
  let current: SearchNode | undefined = node
  while (current) {
    path.push({ x: current.x, z: current.z, tick: current.tick })
    current = current.parent
  }
  path.reverse()
  for (let tick = node.tick + 1; tick <= endTick; tick++) {
    path.push({ x: node.x, z: node.z, tick })
  }
  return path
}

function canHoldGoal(
  goal: Cell,
  arrivalTick: number,
  endTick: number,
  reservations: ReservationTable,
  robot: RobotId
): boolean {
  for (let tick = arrivalTick; tick <= endTick; tick++) {
    if (!reservations.canReserveVertex(goal, tick, robot)) return false
  }
  return true
}

export function spaceTimeAStar(options: SpaceTimeAStarOptions): SpaceTimePlan | null {
  const { grid, reservations, robot, start, goal, startTick, horizon } = options
  if (!Number.isInteger(startTick) || !Number.isInteger(horizon) || startTick < 0 || horizon < 0) {
    return null
  }
  if (!grid.isTraversable(start) || !grid.isTraversable(goal)) return null
  if (!reservations.canReserveVertex(start, startTick, robot)) return null

  const endTick = startTick + horizon
  const compare = (first: SearchNode, second: SearchNode) =>
    first.g + first.h - (second.g + second.h) || first.h - second.h || first.order - second.order
  const open = new MinHeap<SearchNode>(compare)
  const closed = new Set<string>()
  let order = 0

  open.push({
    ...start,
    tick: startTick,
    g: 0,
    h: manhattan(start, goal),
    order: order++,
  })

  while (open.size > 0) {
    const current = open.pop()!
    const currentKey = nodeKey(current, current.tick)
    if (closed.has(currentKey)) continue
    closed.add(currentKey)

    if (
      sameCell(current, goal) &&
      canHoldGoal(goal, current.tick, endTick, reservations, robot)
    ) {
      return { path: reconstruct(current, endTick), arrivalTick: current.tick }
    }
    if (current.tick >= endTick) continue

    const nextTick = current.tick + 1
    const candidates = [...grid.neighbors(current), { x: current.x, z: current.z }]
    for (const candidate of candidates) {
      if (!reservations.canReserveVertex(candidate, nextTick, robot)) continue
      if (
        !sameCell(current, candidate) &&
        !reservations.canReserveEdge(current, candidate, nextTick, robot)
      ) {
        continue
      }

      const key = nodeKey(candidate, nextTick)
      if (closed.has(key)) continue
      open.push({
        ...candidate,
        tick: nextTick,
        g: current.g + 1,
        h: manhattan(candidate, goal),
        order: order++,
        parent: current,
      })
    }
  }

  return null
}