import { proxy } from 'valtio'

export interface VmState {
  isOpen: boolean
  lastDeployedCommands: string[]
  currentXml: string
}

export const vmState = proxy<VmState>({
  isOpen: false,
  lastDeployedCommands: [],
  currentXml: ''
})