import { OBSTACLES, GRID_MIN, GRID_MAX, GridCell } from './pathfinding'

const MAX_HORIZON = 120
const TIMESTEP_MS = 340

interface VertexConstraint {
  agentId: number
  x: number
  z: number
  t: number
}

interface EdgeConstraint {
  agentId: number
  fromX: number
  fromZ: number
  toX: number
  toZ: number
  t: number
}

type Constraint = VertexConstraint | EdgeConstraint

interface STANode {
  x: number
  z: number
  t: number
  g: number
  h: number
  f: number
  parent: STANode | null
}

export interface TimedPath {
  cells: { x: number; z: number; t: number }[]
}

function heuristic(a: GridCell, b: GridCell): number {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z)
}

function isBlocked(x: number, z: number): boolean {
  if (x < GRID_MIN || x > GRID_MAX || z < GRID_MIN || z > GRID_MAX) return true
  return OBSTACLES.has(`${x},${z}`)
}

function hasVertexConstraint(
  agentId: number,
  x: number,
  z: number,
  t: number,
  constraints: Constraint[]
): boolean {
  return constraints.some(
    c => 'fromX' in c === false && c.agentId === agentId && c.x === x && c.z === z && c.t === t
  )
}

function hasEdgeConstraint(
  agentId: number,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  t: number,
  constraints: Constraint[]
): boolean {
  return constraints.some(
    c =>
      'fromX' in c &&
      c.agentId === agentId &&
      c.fromX === fromX &&
      c.fromZ === fromZ &&
      c.toX === toX &&
      c.toZ === toZ &&
      c.t === t
  )
}

function spaceTimeAStar(
  start: GridCell,
  goal: GridCell,
  agentId: number,
  constraints: Constraint[],
  stationaryObstacles: { x: number; z: number }[]
): { x: number; z: number; t: number }[] {
  const openList: STANode[] = []
  const closedSet = new Set<string>()

  const startNode: STANode = {
    ...start,
    t: 0,
    g: 0,
    h: heuristic(start, goal),
    f: 0,
    parent: null,
  }
  startNode.f = startNode.g + startNode.h
  openList.push(startNode)

  const stationarySet = new Set(stationaryObstacles.map(s => `${s.x},${s.z}`))

  while (openList.length > 0) {
    openList.sort((a, b) => a.f - b.f)
    const current = openList.shift()!

    if (current.x === goal.x && current.z === goal.z) {
      const path: { x: number; z: number; t: number }[] = []
      let node: STANode | null = current
      while (node) {
        path.unshift({ x: node.x, z: node.z, t: node.t })
        node = node.parent
      }
      return path
    }

    const key = `${current.x},${current.z},${current.t}`
    closedSet.add(key)

    if (current.t >= MAX_HORIZON) continue

    const nextT = current.t + 1
    const candidates: { x: number; z: number }[] = [
      { x: current.x + 1, z: current.z },
      { x: current.x - 1, z: current.z },
      { x: current.x, z: current.z + 1 },
      { x: current.x, z: current.z - 1 },
      { x: current.x, z: current.z },
    ]

    for (const cand of candidates) {
      if (isBlocked(cand.x, cand.z)) continue
      if (stationarySet.has(`${cand.x},${cand.z}`) && !(cand.x === goal.x && cand.z === goal.z)) continue

      if (hasVertexConstraint(agentId, cand.x, cand.z, nextT, constraints)) continue

      const isWait = cand.x === current.x && cand.z === current.z
      if (!isWait) {
        if (hasEdgeConstraint(agentId, current.x, current.z, cand.x, cand.z, nextT, constraints)) continue
      }

      const candKey = `${cand.x},${cand.z},${nextT}`
      if (closedSet.has(candKey)) continue

      const g = current.g + 1
      const existing = openList.find(n => n.x === cand.x && n.z === cand.z && n.t === nextT)
      if (existing && g >= existing.g) continue

      const h = heuristic(cand, goal)
      const node: STANode = { x: cand.x, z: cand.z, t: nextT, g, h, f: g + h, parent: current }
      if (existing) {
        Object.assign(existing, node)
      } else {
        openList.push(node)
      }
    }
  }

  return []
}

interface Conflict {
  type: 'vertex' | 'edge'
  agent1: number
  agent2: number
  x: number
  z: number
  t: number
  fromX?: number
  fromZ?: number
}

function findFirstConflict(paths: { x: number; z: number; t: number }[][]): Conflict | null {
  const maxLen = Math.max(...paths.map(p => p.length))

  for (let t = 0; t < maxLen; t++) {
    for (let i = 0; i < paths.length; i++) {
      for (let j = i + 1; j < paths.length; j++) {
        const posI = paths[i][Math.min(t, paths[i].length - 1)]
        const posJ = paths[j][Math.min(t, paths[j].length - 1)]

        if (posI.x === posJ.x && posI.z === posJ.z) {
          return { type: 'vertex', agent1: i, agent2: j, x: posI.x, z: posI.z, t }
        }

        if (t > 0) {
          const prevI = paths[i][Math.min(t - 1, paths[i].length - 1)]
          const prevJ = paths[j][Math.min(t - 1, paths[j].length - 1)]

          if (prevI.x === posJ.x && prevI.z === posJ.z && prevJ.x === posI.x && prevJ.z === posI.z) {
            return {
              type: 'edge',
              agent1: i,
              agent2: j,
              x: posI.x,
              z: posI.z,
              t,
              fromX: prevI.x,
              fromZ: prevI.z,
            }
          }
        }
      }
    }
  }

  return null
}

interface CTNode {
  constraints: Map<number, Constraint[]>
  paths: { x: number; z: number; t: number }[][]
  cost: number
}

function computeCost(paths: { x: number; z: number; t: number }[][]): number {
  return paths.reduce((sum, path) => sum + path.length - 1, 0)
}

function planSingleAgent(
  agentId: number,
  start: GridCell,
  goal: GridCell,
  constraints: Constraint[],
  stationaryObstacles: { x: number; z: number }[]
): { x: number; z: number; t: number }[] {
  if (start.x === goal.x && start.z === goal.z) {
    return [{ x: start.x, z: start.z, t: 0 }]
  }
  return spaceTimeAStar(start, goal, agentId, constraints, stationaryObstacles)
}

export interface CBSAgent {
  id: number
  start: GridCell
  goal: GridCell
}

export function cbs(
  agents: CBSAgent[],
  stationaryRobots: { x: number; z: number }[]
): { x: number; z: number; t: number }[][] {
  const rootPaths = agents.map(agent =>
    planSingleAgent(agent.id, agent.start, agent.goal, [], stationaryRobots)
  )

  if (rootPaths.some(p => p.length === 0)) return []

  const root: CTNode = {
    constraints: new Map(),
    paths: rootPaths,
    cost: computeCost(rootPaths),
  }

  const openList: CTNode[] = [root]
  let iterations = 0
  const MAX_ITERATIONS = 200

  while (openList.length > 0 && iterations < MAX_ITERATIONS) {
    iterations++
    openList.sort((a, b) => a.cost - b.cost)
    const current = openList.shift()!

    const conflict = findFirstConflict(current.paths)
    if (!conflict) {
      return current.paths
    }

    for (const agentIdx of [conflict.agent1, conflict.agent2]) {
      const newConstraints = new Map(current.constraints)
      const agentConstraints = [...(newConstraints.get(agentIdx) || [])]

      if (conflict.type === 'vertex') {
        agentConstraints.push({
          agentId: agentIdx,
          x: conflict.x,
          z: conflict.z,
          t: conflict.t,
        })
      } else {
        const fromX = conflict.fromX!
        const fromZ = conflict.fromZ!
        agentConstraints.push({
          agentId: agentIdx,
          fromX,
          fromZ,
          toX: conflict.x,
          toZ: conflict.z,
          t: conflict.t,
        })
      }

      newConstraints.set(agentIdx, agentConstraints)

      const newPaths = [...current.paths]
      const agent = agents[agentIdx]
      const newPath = planSingleAgent(
        agent.id,
        agent.start,
        agent.goal,
        agentConstraints,
        stationaryRobots
      )

      if (newPath.length === 0) continue

      newPaths[agentIdx] = newPath

      openList.push({
        constraints: newConstraints,
        paths: newPaths,
        cost: computeCost(newPaths),
      })
    }
  }

  return []
}

export function pathToWaypoints(timedPath: { x: number; z: number; t: number }[]): { x: number; z: number }[] {
  if (timedPath.length === 0) return []

  const waypoints: { x: number; z: number }[] = [{ x: timedPath[0].x, z: timedPath[0].z }]

  for (let i = 1; i < timedPath.length; i++) {
    const prev = timedPath[i - 1]
    const curr = timedPath[i]
    if (prev.x !== curr.x || prev.z !== curr.z) {
      waypoints.push({ x: curr.x, z: curr.z })
    }
  }

  const last = timedPath[timedPath.length - 1]
  const lastWp = waypoints[waypoints.length - 1]
  if (lastWp.x !== last.x || lastWp.z !== last.z) {
    waypoints.push({ x: last.x, z: last.z })
  }

  return waypoints
}

export function getTimestepDuration(): number {
  return TIMESTEP_MS
}