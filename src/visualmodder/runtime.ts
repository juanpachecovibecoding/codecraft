import { VmLocation } from './location'
import { VmCmdContext } from './cmd'
import { displayClientChat } from '../botUtils'
import { vmState } from './state'
import { showModal, hideModal, activeModalStack } from '../globalState'

export class VisualModderRuntime {
  private registeredCode = ''
  private registeredFunctions: Record<string, Function> = {}

  constructor() {
    // Restore last saved code if present
    try {
      const savedCode = localStorage.getItem('vm_last_code')
      if (savedCode) {
        this.registerCode(savedCode)
      }
    } catch (e) {}
  }

  registerCode(code: string, playerName = 'player'): { status: 'OK' | 'ERROR'; message: string; functions: string[] } {
    this.registeredCode = code
    this.registeredFunctions = {}

    try {
      // Create execution scope that extracts defined functions
      const functionNames: string[] = []
      const fnRegex = /function\s+([a-zA-Z0-9_]+)\s*\(/g
      let match: RegExpExecArray | null

      while ((match = fnRegex.exec(code)) !== null) {
        functionNames.push(match[1])
      }

      // Safe evaluation wrapped in factory
      const factory = new Function(
        'CMD',
        'player',
        'startLocation',
        'nextLocation',
        'markLocation',
        'startCmdTime',
        `
        ${code}
        return {
          ${functionNames.map(name => `${name}: typeof ${name} === 'function' ? ${name} : undefined`).join(',\n')}
        };
        `
      )

      // Test instantiate to extract functions
      const dummyCmd = new VmCmdContext('test')
      const dummyLoc = new VmLocation()
      const funcs = factory(dummyCmd, playerName, dummyLoc, dummyLoc, dummyLoc, Date.now())

      for (const [fnName, fn] of Object.entries(funcs)) {
        if (typeof fn === 'function') {
          this.registeredFunctions[fnName.toLowerCase()] = fn as Function
        }
      }

      const count = Object.keys(this.registeredFunctions).length
      return {
        status: 'OK',
        message: `Registered ${count} command(s): ${Object.keys(this.registeredFunctions).join(', ')}`,
        functions: Object.keys(this.registeredFunctions)
      }
    } catch (err: any) {
      console.error('VisualModder compile error:', err)
      return {
        status: 'ERROR',
        message: `Syntax error: ${err.message || err}`,
        functions: []
      }
    }
  }

  async executeCommand(commandName: string, args: string[] = []): Promise<boolean> {
    const cleanName = (commandName || '').toLowerCase().trim()
    const fn = this.registeredFunctions[cleanName]

    if (!fn) {
      const available = Object.keys(this.registeredFunctions)
      if (available.length === 0) {
        displayClientChat('§c[VisualModder] No commands found. Press §e"V"§c to open Blockly and create commands!')
      } else {
        displayClientChat(`§c[VisualModder] Command "§e${commandName}§c" not found. Available: §a${available.join(', ')}`)
      }
      return false
    }

    if (!bot?.entity?.position) {
      displayClientChat('§c[VisualModder] Player position not available.')
      return false
    }

    const startTime = Date.now()
    const p = bot.entity.position
    // Minecraft yaw: 0 is South (+Z), -90/270 is East (+X)
    const yaw = (-bot.entity.yaw * 180) / Math.PI
    const pitch = (-bot.entity.pitch * 180) / Math.PI

    // Initial position: 2 blocks in front of the player at foot level
    const radYaw = (yaw * Math.PI) / 180
    const startX = Math.floor(p.x - Math.sin(radYaw) * 2)
    const startY = Math.floor(p.y)
    const startZ = Math.floor(p.z + Math.cos(radYaw) * 2)

    const startLocation = new VmLocation(startX, startY, startZ, yaw, pitch)
    const cmdContext = new VmCmdContext(cleanName)

    displayClientChat(`§7[VisualModder] Executing §e/vm ${cleanName}§7...`)

    try {
      // Re-evaluate in fresh context with active CMD and Locations
      const scopeRunner = new Function(
        'CMD',
        'player',
        'startLocation',
        'nextLocation',
        'markLocation',
        'startCmdTime',
        'args',
        `
        var nextLocation = startLocation.clone();
        var markLocation = startLocation.clone();
        ${this.registeredCode}
        if (typeof ${cleanName} === 'function') {
          return ${cleanName}.apply(null, args);
        }
        `
      )

      const result = scopeRunner(
        cmdContext,
        bot.username || 'player',
        startLocation,
        startLocation.clone(),
        startLocation.clone(),
        startTime,
        args
      )

      if (result instanceof Promise) {
        await result
      }

      cmdContext.finish()
      const elapsed = Date.now() - startTime
      displayClientChat(`§a[VisualModder] §e${cleanName}§a completed: §f${cmdContext.blockCount} blocks placed in ${elapsed}ms.`)
      return true
    } catch (err: any) {
      console.error('VisualModder runtime execution error:', err)
      displayClientChat(`§c[VisualModder] Error running ${cleanName}: ${err.message || err}`)
      return false
    }
  }

  togglePanel() {
    const isOpened = activeModalStack.some(m => m.reactType === 'visualmodder-panel')
    if (isOpened) {
      hideModal({ reactType: 'visualmodder-panel' })
      vmState.isOpen = false
    } else {
      showModal({ reactType: 'visualmodder-panel' })
      vmState.isOpen = true
    }
  }
}

export const visualModderRuntime = new VisualModderRuntime()