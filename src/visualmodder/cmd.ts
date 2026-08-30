import { Vec3 } from 'vec3'
import { VmLocation } from './location'
import { parseVmMaterial, getBlockStateId } from './blockMap'
import { VmBlockRecord, VmExecutionSession } from './types'
import { vmUndoManager } from './undo'

export class VmCmdContext {
  session: VmExecutionSession
  blockCount = 0
  maxBlocks = 100000

  constructor(commandName: string) {
    this.session = {
      id: String(Date.now()),
      commandName,
      timestamp: Date.now(),
      blocks: []
    }
  }

  finish() {
    vmUndoManager.recordSession(this.session)
  }

  /**
   * Helper to place a single block in the world and record it for undo
   */
  setWorldBlock(pos: Vec3, blockStateId: number) {
    if (this.blockCount >= this.maxBlocks) return

    try {
      let prevBlockStateId = 0
      if (bot?.world?.getBlockStateId) {
        prevBlockStateId = bot.world.getBlockStateId(pos) || 0
      }

      this.session.blocks.push({
        x: pos.x,
        y: pos.y,
        z: pos.z,
        prevBlockStateId,
        newBlockStateId: blockStateId
      })
      this.blockCount++

      // Client-side world update
      if (bot?.world?.setBlockStateId) {
        bot.world.setBlockStateId(pos, blockStateId)
      }

      // Server-side world update (for singleplayer flying-squid server)
      if (window.localServer?.players?.[0]?.world?.setBlockStateId) {
        window.localServer.players[0].world.setBlockStateId(pos, blockStateId)
        window.localServer.players[0]._client?.write('block_change', {
          location: pos,
          type: blockStateId
        })
      }
    } catch (err) {
      console.warn('Failed to set block at', pos, err)
    }
  }

  // --- CMD API Methods ---

  createBlock(location: VmLocation, material: any, player?: any, startCmdTime?: any): void {
    if (!location) return
    const { blockName } = parseVmMaterial(material)
    const stateId = getBlockStateId(blockName)
    const pos = location.toVec3()
    this.setWorldBlock(pos, stateId)
  }

  createLine(location: VmLocation, length: number, material: any, player?: any, startCmdTime?: any): void {
    if (!location || !length) return
    const { blockName } = parseVmMaterial(material)
    const stateId = getBlockStateId(blockName)

    let cur = location.clone()
    for (let i = 0; i < length; i++) {
      this.setWorldBlock(cur.toVec3(), stateId)
      cur = cur.move(1, 'FW')
    }
  }

  createRectangle(location: VmLocation, width: number, height: number, fill: boolean, material: any, player?: any, startCmdTime?: any): void {
    if (!location) return
    const { blockName } = parseVmMaterial(material)
    const stateId = getBlockStateId(blockName)

    const w = Math.max(1, Math.round(width || 1))
    const h = Math.max(1, Math.round(height || 1))

    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        const isBorder = x === 0 || x === w - 1 || y === 0 || y === h - 1
        if (fill || isBorder) {
          const blockLoc = location.clone().move(x, 'RIGHT').move(y, 'UP')
          this.setWorldBlock(blockLoc.toVec3(), stateId)
        }
      }
    }
  }

  createPolygon(location: VmLocation, sides: number, radiusX: number, radiusY: number, fill: boolean, material: any, player?: any, startCmdTime?: any): void {
    if (!location) return
    const { blockName } = parseVmMaterial(material)
    const stateId = getBlockStateId(blockName)

    const rx = Math.max(1, radiusX || 1)
    const ry = Math.max(1, radiusY || rx)

    if (sides >= 20 || sides === 100) {
      // Circle / Ellipse
      const maxR = Math.max(rx, ry)
      for (let dx = -rx; dx <= rx; dx++) {
        for (let dz = -ry; dz <= ry; dz++) {
          const distSq = (dx * dx) / (rx * rx) + (dz * dz) / (ry * ry)
          if (fill ? distSq <= 1.05 : Math.abs(distSq - 1.0) < 0.25) {
            const blockLoc = location.clone().move(dx, 'RIGHT').move(dz, 'FW')
            this.setWorldBlock(blockLoc.toVec3(), stateId)
          }
        }
      }
    } else {
      // Regular polygon
      const numSides = Math.max(3, sides)
      const points: VmLocation[] = []
      for (let i = 0; i < numSides; i++) {
        const angle = (i * 2 * Math.PI) / numSides
        const px = Math.round(rx * Math.cos(angle))
        const pz = Math.round(ry * Math.sin(angle))
        points.push(location.clone().move(px, 'RIGHT').move(pz, 'FW'))
      }

      for (let i = 0; i < numSides; i++) {
        const p1 = points[i]
        const p2 = points[(i + 1) % numSides]
        this.connectPositions(p1, p2, material, player, startCmdTime)
      }
    }
  }

  connectPositions(loc1: VmLocation, loc2: VmLocation, material: any, player?: any, startCmdTime?: any): void {
    if (!loc1 || !loc2) return
    const { blockName } = parseVmMaterial(material)
    const stateId = getBlockStateId(blockName)

    // 3D Bresenham Algorithm
    const p1 = loc1.toVec3()
    const p2 = loc2.toVec3()

    let x = p1.x
    let y = p1.y
    let z = p1.z

    const dx = Math.abs(p2.x - p1.x)
    const dy = Math.abs(p2.y - p1.y)
    const dz = Math.abs(p2.z - p1.z)

    const xs = p2.x > p1.x ? 1 : -1
    const ys = p2.y > p1.y ? 1 : -1
    const zs = p2.z > p1.z ? 1 : -1

    // Driving axis
    if (dx >= dy && dx >= dz) {
      let p1_err = 2 * dy - dx
      let p2_err = 2 * dz - dx
      while (x !== p2.x) {
        this.setWorldBlock(new Vec3(x, y, z), stateId)
        x += xs
        if (p1_err >= 0) {
          y += ys
          p1_err -= 2 * dx
        }
        if (p2_err >= 0) {
          z += zs
          p2_err -= 2 * dx
        }
        p1_err += 2 * dy
        p2_err += 2 * dz
      }
    } else if (dy >= dx && dy >= dz) {
      let p1_err = 2 * dx - dy
      let p2_err = 2 * dz - dy
      while (y !== p2.y) {
        this.setWorldBlock(new Vec3(x, y, z), stateId)
        y += ys
        if (p1_err >= 0) {
          x += xs
          p1_err -= 2 * dy
        }
        if (p2_err >= 0) {
          z += zs
          p2_err -= 2 * dy
        }
        p1_err += 2 * dx
        p2_err += 2 * dz
      }
    } else {
      let p1_err = 2 * dy - dz
      let p2_err = 2 * dx - dz
      while (z !== p2.z) {
        this.setWorldBlock(new Vec3(x, y, z), stateId)
        z += zs
        if (p1_err >= 0) {
          y += ys
          p1_err -= 2 * dz
        }
        if (p2_err >= 0) {
          x += xs
          p2_err -= 2 * dz
        }
        p1_err += 2 * dy
        p2_err += 2 * dx
      }
    }
    this.setWorldBlock(new Vec3(p2.x, p2.y, p2.z), stateId)
  }

  createDrawing(location: VmLocation, ...args: any[]): void {
    // Renders custom pixel matrices from Blockly
    if (!location || args.length === 0) return
    const rowList = Array.isArray(args[0]) ? args[0] : [args[0]]
    for (let r = 0; r < rowList.length; r++) {
      const row = rowList[r]
      if (typeof row === 'string') {
        const cells = row.split(',')
        for (let c = 0; c < cells.length; c++) {
          const val = cells[c].trim()
          if (val) {
            const blockLoc = location.clone().move(c, 'RIGHT').move(-r, 'UP')
            this.createBlock(blockLoc, val)
          }
        }
      }
    }
  }

  createWaveFormObj(location: VmLocation, objText: string, scale = 1, material?: any): void {
    if (!location || !objText) return
    const { blockName } = parseVmMaterial(material || 'stone')
    const stateId = getBlockStateId(blockName)

    const lines = objText.split('\n')
    const vertices: [number, number, number][] = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('v ')) {
        const parts = trimmed.split(/\s+/).slice(1).map(Number)
        if (parts.length >= 3) {
          vertices.push([parts[0] * scale, parts[1] * scale, parts[2] * scale])
        }
      }
    }

    for (const [vx, vy, vz] of vertices) {
      const blockLoc = location.clone().move(vx, 'RIGHT').move(vy, 'UP').move(vz, 'FW')
      this.setWorldBlock(blockLoc.toVec3(), stateId)
    }
  }

  convertTextToBlocks(location: VmLocation, text: string, material: any): void {
    if (!location || !text) return
    const { blockName } = parseVmMaterial(material)
    const stateId = getBlockStateId(blockName)

    // Simple 5x5 font voxelizer for ASCII characters
    const str = String(text).toUpperCase()
    let offsetX = 0
    for (let i = 0; i < str.length; i++) {
      const char = str[i]
      if (char === ' ') {
        offsetX += 4
        continue
      }
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 3; x++) {
          // generic block for letter
          const blockLoc = location.clone().move(offsetX + x, 'RIGHT').move(4 - y, 'UP')
          this.setWorldBlock(blockLoc.toVec3(), stateId)
        }
      }
      offsetX += 4
    }
  }

  // --- Turtle Movements ---

  movePosition(player?: any, location?: VmLocation, times = 1, direction = 'FW'): VmLocation {
    if (!location) {
      // If location is omitted, initialize from player position
      if (bot?.entity) {
        const p = bot.entity.position
        const yaw = (-bot.entity.yaw * 180) / Math.PI
        const pitch = (-bot.entity.pitch * 180) / Math.PI
        return new VmLocation(p.x, p.y, p.z, yaw, pitch)
      }
      return new VmLocation(0, 64, 0, 0, 0)
    }
    return location.move(times, direction)
  }

  rotatePositionRelative(player: any, location: VmLocation, angle: number): VmLocation {
    if (!location) return new VmLocation()
    return location.rotate(angle)
  }

  rotatePositionAbsolute(player: any, location: VmLocation, angle: number | string): VmLocation {
    if (!location) return new VmLocation()
    return location.setRotation(angle)
  }

  setVerticalAxisRelative(player: any, location: VmLocation, angle: number): VmLocation {
    if (!location) return new VmLocation()
    return location.setElevationRelative(angle)
  }

  setVerticalAxisAbsolute(player: any, location: VmLocation, angle: number | string): VmLocation {
    if (!location) return new VmLocation()
    return location.setElevation(angle)
  }

  copyLocation(location: VmLocation): VmLocation {
    return location ? location.clone() : new VmLocation()
  }

  isCurrentBlockMadeOf(location: VmLocation, material: any, player?: any): boolean {
    if (!location || !bot?.world?.getBlockStateId) return false
    const pos = location.toVec3()
    const curState = bot.world.getBlockStateId(pos)
    const { blockName } = parseVmMaterial(material)
    const expectedState = getBlockStateId(blockName)
    return curState === expectedState
  }

  async programWait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, Math.max(10, ms || 100)))
  }

  getPlayerCoord(player: any, coord: string): number {
    if (!bot?.entity?.position) return 0
    const p = bot.entity.position
    const c = (coord || 'X').toUpperCase()
    if (c === 'X') return Math.floor(p.x)
    if (c === 'Y') return Math.floor(p.y)
    if (c === 'Z') return Math.floor(p.z)
    return 0
  }

  giveToPlayer(player: any, item: any, count = 1): void {
    if (bot) {
      displayClientChat(`§a[VisualModder] Received item: ${item} x${count}`)
    }
  }

  createChest(location: VmLocation, items: any[]): void {
    if (!location) return
    const chestState = getBlockStateId('chest')
    this.setWorldBlock(location.toVec3(), chestState)
  }

  cancelAllEvents(): void {}
  callFunction(name: string): void {}
  addEvent(): void {}
  isPlayerHittingA(): boolean { return false }
  isPlayerHoldingA(): boolean { return false }
  hasPlayerA(): boolean { return false }
}