export interface VmBlockRecord {
  x: number
  y: number
  z: number
  prevBlockStateId: number
  newBlockStateId: number
}

export interface VmExecutionSession {
  id: string
  commandName: string
  timestamp: number
  blocks: VmBlockRecord[]
}

export interface VmDeployPayload {
  type: 'VM_DEPLOY'
  code: string
  xml: string
  playerName: string
  lang?: string
}