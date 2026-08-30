// Maps VisualModder block strings to Minecraft block names and state IDs

export function parseVmMaterial(materialStr: any): { blockName: string; count: number; direction?: string } {
  if (!materialStr) {
    return { blockName: 'gold_block', count: 1 }
  }

  const str = String(materialStr)

  // Typical visualmodder string format:
  // "_P_,,_M_,,_T_,,b.gold_block;"
  // or list of materials
  // extract block identifier (e.g. b.gold_block, i.splash_potion, e.pig)
  const blockMatch = str.match(/b\.([a-zA-Z0-9_]+)/)
  let blockName = blockMatch ? blockMatch[1] : 'gold_block'

  // Common conversions / aliases
  const aliases: Record<string, string> = {
    'wool': 'white_wool',
    'stained_glass': 'white_stained_glass',
    'stained_hardened_clay': 'white_terracotta',
    'concrete': 'white_concrete',
    'wooden_door': 'oak_door',
    'trapdoor': 'oak_trapdoor',
    'fence': 'oak_fence',
    'leaves': 'oak_leaves',
    'log': 'oak_log',
    'planks': 'oak_planks',
    'sapling': 'oak_sapling',
    'double_plant': 'sunflower',
    'redstone': 'redstone_wire',
  }

  if (aliases[blockName]) {
    blockName = aliases[blockName]
  }

  // Check multiplicity
  const countMatch = str.match(/_M_(\d+)/)
  const count = countMatch ? parseInt(countMatch[1], 10) : 1

  return { blockName, count }
}

export function getBlockStateId(blockName: string): number {
  if (!window.loadedData?.blocksByName) {
    return 1 // default stone
  }

  const blockInfo = window.loadedData.blocksByName[blockName]
  if (blockInfo && typeof blockInfo.defaultState === 'number') {
    return blockInfo.defaultState
  }

  // Fallback: try stone or first available block
  if (blockName === 'air') return 0
  const stone = window.loadedData.blocksByName['stone']
  if (stone?.defaultState) return stone.defaultState

  return 1
}