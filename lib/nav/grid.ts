import type { Cell, WarehouseConfig } from './types'

const CARDINAL_DIRECTIONS: readonly Cell[] = [
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 },
]

export function cellKey(x: number, z: number): string
export function cellKey(cell: Cell): string
export function cellKey(cellOrX: number | Cell, z?: number): string {
  if (typeof cellOrX === 'number') return `${cellOrX},${z}`
  return `${cellOrX.x},${cellOrX.z}`
}

export class GridMap {
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
  readonly pickCells: Cell[]
  readonly dockCells: Cell[]
  readonly spawnCells: Cell[]
  readonly shelfCells: Cell[]
  private readonly blocked: Set<string>

  constructor(config: Pick<WarehouseConfig, 'grid' | 'shelves' | 'docks' | 'spawnCells'>) {
    this.minX = config.grid.minX
    this.maxX = config.grid.maxX
    this.minZ = config.grid.minZ
    this.maxZ = config.grid.maxZ
    this.blocked = new Set(config.shelves.map((shelf) => cellKey(shelf.cell)))
    this.shelfCells = config.shelves.map((shelf) => ({ ...shelf.cell }))
    this.pickCells = config.shelves.map((shelf) => ({ ...shelf.pickCell }))
    this.dockCells = config.docks.map((dock) => ({ ...dock.cell }))
    this.spawnCells = config.spawnCells.map((cell) => ({ ...cell }))
  }

  inBounds(cell: Cell): boolean {
    return cell.x >= this.minX && cell.x <= this.maxX && cell.z >= this.minZ && cell.z <= this.maxZ
  }

  isBlocked(cell: Cell): boolean {
    return this.blocked.has(cellKey(cell))
  }

  isTraversable(cell: Cell): boolean {
    return this.inBounds(cell) && !this.isBlocked(cell)
  }

  neighbors(cell: Cell): Cell[] {
    const neighbors: Cell[] = []
    for (const direction of CARDINAL_DIRECTIONS) {
      const neighbor = { x: cell.x + direction.x, z: cell.z + direction.z }
      if (this.isTraversable(neighbor)) neighbors.push(neighbor)
    }
    return neighbors
  }

  reachable(start: Cell, goal: Cell): boolean {
    if (!this.isTraversable(start) || !this.isTraversable(goal)) return false
    const visited = new Set<string>([cellKey(start)])
    const queue: Cell[] = [start]

    for (let index = 0; index < queue.length; index++) {
      const cell = queue[index]
      if (cell.x === goal.x && cell.z === goal.z) return true
      for (const neighbor of this.neighbors(cell)) {
        const key = cellKey(neighbor)
        if (!visited.has(key)) {
          visited.add(key)
          queue.push(neighbor)
        }
      }
    }
    return false
  }

  reachableFromAny(starts: readonly Cell[], goal: Cell): boolean {
    return starts.some((start) => this.reachable(start, goal))
  }
}