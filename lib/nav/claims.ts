import type { DockConfig, RobotId, ShelfConfig } from './types'

export class ClaimRegistry {
  private shelfClaims = new Map<string, RobotId>()
  private dockClaims = new Map<number, RobotId>()

  claimShelf(shelfId: string, robot: RobotId): boolean {
    return this.claim(this.shelfClaims, shelfId, robot)
  }

  claimDock(dockId: number, robot: RobotId): boolean {
    return this.claim(this.dockClaims, dockId, robot)
  }

  releaseShelf(shelfId: string, robot: RobotId): boolean {
    return this.release(this.shelfClaims, shelfId, robot)
  }

  releaseDock(dockId: number, robot: RobotId): boolean {
    return this.release(this.dockClaims, dockId, robot)
  }

  releaseRobot(robot: RobotId): void {
    this.releaseOwned(this.shelfClaims, robot)
    this.releaseOwned(this.dockClaims, robot)
  }

  shelfOwner(shelfId: string): RobotId | undefined {
    return this.shelfClaims.get(shelfId)
  }

  dockOwner(dockId: number): RobotId | undefined {
    return this.dockClaims.get(dockId)
  }

  availableShelves(shelves: readonly ShelfConfig[]): ShelfConfig[] {
    return shelves.filter((shelf) => !this.shelfClaims.has(shelf.id))
  }

  availableDocks(docks: readonly DockConfig[]): DockConfig[] {
    return docks.filter((dock) => !this.dockClaims.has(dock.id))
  }

  private claim<Key>(claims: Map<Key, RobotId>, key: Key, robot: RobotId): boolean {
    const owner = claims.get(key)
    if (owner !== undefined && owner !== robot) return false
    claims.set(key, robot)
    return true
  }

  private release<Key>(claims: Map<Key, RobotId>, key: Key, robot: RobotId): boolean {
    if (claims.get(key) !== robot) return false
    claims.delete(key)
    return true
  }

  private releaseOwned<Key>(claims: Map<Key, RobotId>, robot: RobotId): void {
    for (const [key, owner] of claims) {
      if (owner === robot) claims.delete(key)
    }
  }
}