import * as THREE from 'three'

const GRID_MIN = -10
const GRID_MAX = 10

const SHELF_CELLS: [number, number][] = [
  [8, 0],
  [8, 3],
  [8, -3],
  [-8, 0],
  [-8, 3],
  [-8, -3],
]

const OBSTACLES = new Set(SHELF_CELLS.map(([x, z]) => `${x},${z}`))

interface GridCell {
  x: number
  z: number
}

interface AStarNode extends GridCell {
  g: number
  h: number
  f: number
  parent: AStarNode | null
}

function cellKey(cell: GridCell): string {
  return `${cell.x},${cell.z}`
}

function heuristic(a: GridCell, b: GridCell): number {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z)
}

function getNeighbors(cell: GridCell, obstacles: Set<string>): GridCell[] {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  const neighbors: GridCell[] = []
  for (const [dx, dz] of dirs) {
    const x = cell.x + dx
    const z = cell.z + dz
    if (x < GRID_MIN || x > GRID_MAX || z < GRID_MIN || z > GRID_MAX) continue
    if (obstacles.has(`${x},${z}`)) continue
    neighbors.push({ x, z })
  }
  return neighbors
}

function findPath(start: GridCell, goal: GridCell, extraObstacles?: Set<string>): GridCell[] {
  const obstacles = extraObstacles ? new Set([...OBSTACLES, ...extraObstacles]) : OBSTACLES
  const openList: AStarNode[] = []
  const closedSet = new Set<string>()

  const startNode: AStarNode = { ...start, g: 0, h: heuristic(start, goal), f: 0, parent: null }
  startNode.f = startNode.g + startNode.h
  openList.push(startNode)

  while (openList.length > 0) {
    openList.sort((a, b) => a.f - b.f)
    const current = openList.shift()!

    if (current.x === goal.x && current.z === goal.z) {
      const path: GridCell[] = []
      let node: AStarNode | null = current
      while (node) {
        path.unshift({ x: node.x, z: node.z })
        node = node.parent
      }
      return path
    }

    closedSet.add(cellKey(current))

    for (const neighbor of getNeighbors(current, obstacles)) {
      const key = cellKey(neighbor)
      if (closedSet.has(key)) continue

      const g = current.g + 1
      const existing = openList.find(n => n.x === neighbor.x && n.z === neighbor.z)
      if (existing && g >= existing.g) continue

      const h = heuristic(neighbor, goal)
      const node: AStarNode = { ...neighbor, g, h, f: g + h, parent: current }
      if (existing) {
        Object.assign(existing, node)
      } else {
        openList.push(node)
      }
    }
  }

  return []
}

function simplifyPath(path: GridCell[]): GridCell[] {
  if (path.length <= 2) return path

  const simplified: GridCell[] = [path[0]]
  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1]
    const curr = path[i]
    const next = path[i + 1]
    const dx1 = curr.x - prev.x
    const dz1 = curr.z - prev.z
    const dx2 = next.x - curr.x
    const dz2 = next.z - curr.z
    if (dx1 !== dx2 || dz1 !== dz2) {
      simplified.push(curr)
    }
  }
  simplified.push(path[path.length - 1])
  return simplified
}

export function findGridPath(
  startWorld: THREE.Vector3,
  goalWorld: THREE.Vector3,
  extraObstacles?: Set<string>
): GridCell[] {
  const start: GridCell = { x: Math.round(startWorld.x), z: Math.round(startWorld.z) }
  const goal: GridCell = { x: Math.round(goalWorld.x), z: Math.round(goalWorld.z) }

  const rawPath = findPath(start, goal, extraObstacles)
  if (rawPath.length === 0) return []

  const simplified = simplifyPath(rawPath)
  return simplified.slice(1)
}

export { OBSTACLES, GRID_MIN, GRID_MAX }
export type { GridCell }