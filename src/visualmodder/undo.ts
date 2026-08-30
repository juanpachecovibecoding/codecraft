import { Vec3 } from 'vec3'
import { VmBlockRecord, VmExecutionSession } from './types'
import { displayClientChat } from '../botUtils'

export class VmUndoManager {
  private history: VmExecutionSession[] = []
  private maxHistory = 20

  recordSession(session: VmExecutionSession) {
    if (session.blocks.length === 0) return
    this.history.push(session)
    if (this.history.length > this.maxHistory) {
      this.history.shift()
    }
  }

  undoLast(): boolean {
    if (this.history.length === 0) {
      displayClientChat('§c[VisualModder] Nothing to undo.')
      return false
    }

    const session = this.history.pop()!
    let count = 0

    // Restore blocks in reverse order
    for (let i = session.blocks.length - 1; i >= 0; i--) {
      const record = session.blocks[i]
      const pos = new Vec3(record.x, record.y, record.z)

      try {
        if (bot?.world?.setBlockStateId) {
          bot.world.setBlockStateId(pos, record.prevBlockStateId)
        }
        if (window.localServer?.players?.[0]?.world?.setBlockStateId) {
          window.localServer.players[0].world.setBlockStateId(pos, record.prevBlockStateId)
          window.localServer.players[0]._client?.write('block_change', {
            location: pos,
            type: record.prevBlockStateId
          })
        }
        count++
      } catch (err) {
        console.error('Failed to undo block at', pos, err)
      }
    }

    displayClientChat(`§a[VisualModder] Undone command §e${session.commandName}§a (${count} blocks restored).`)
    return true
  }

  clear() {
    this.history = []
  }
}

export const vmUndoManager = new VmUndoManager()