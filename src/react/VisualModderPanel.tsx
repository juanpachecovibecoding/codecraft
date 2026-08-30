import React, { useEffect, useRef, useState } from 'react'
import { useSnapshot } from 'valtio'
import { vmState } from '../visualmodder/state'
import { visualModderRuntime } from '../visualmodder/runtime'
import { hideModal } from '../globalState'
import { useIsModalActive } from './utilsApp'
import { showNotification } from './NotificationProvider'
import { displayClientChat } from '../botUtils'
import './VisualModderPanel.css'

export default () => {
  const isModalActive = useIsModalActive('visualmodder-panel')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Exit pointerlock whenever panel opens
  useEffect(() => {
    if (isModalActive) {
      if (document.pointerLockElement) {
        document.exitPointerLock?.()
      }
      const timer = setTimeout(() => {
        if (document.pointerLockElement) {
          document.exitPointerLock?.()
        }
        iframeRef.current?.contentWindow?.postMessage({ type: 'VM_RESIZE' }, '*')
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isModalActive, isFullscreen])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return
      const data = event.data

      if (data.type === 'VM_DEPLOY') {
        const result = visualModderRuntime.registerCode(data.code, data.playerName || bot?.username || 'player')
        
        if (result.status === 'OK') {
          vmState.lastDeployedCommands = result.functions
          const cmdName = result.functions[0] || 'nombre'
          showNotification('Code Craft Desplegado', `Escribe /vm ${cmdName} en el chat para ejecutarlo.`, false, 'label-alt')
          displayClientChat(`§a[Code Craft] Código compilado con éxito. Ejecuta §e/vm ${cmdName}§a en el chat.`)

          iframeRef.current?.contentWindow?.postMessage({
            type: 'VM_DEPLOY_RESULT',
            status: 'OK',
            message: `¡Guardado! Usa /vm ${cmdName} en el chat`,
            playerName: data.playerName
          }, '*')
        } else {
          displayClientChat(`§c[Code Craft] ${result.message}`)
          iframeRef.current?.contentWindow?.postMessage({
            type: 'VM_DEPLOY_RESULT',
            status: 'ERROR',
            message: result.message
          }, '*')
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const handleIframeLoad = () => {
    const username = bot?.username || 'player'
    const savedXml = localStorage.getItem('vm_last_xml') || ''
    
    iframeRef.current?.contentWindow?.postMessage({
      type: 'VM_INIT',
      playerName: username,
      xml: savedXml
    }, '*')
    iframeRef.current?.contentWindow?.postMessage({ type: 'VM_RESIZE' }, '*')
  }

  if (!isModalActive) return null

  return (
    <div
      className={`vm-panel-container ${isFullscreen ? 'vm-fullscreen' : ''}`}
      onMouseEnter={() => { if (document.pointerLockElement) document.exitPointerLock?.() }}
      onMouseDown={() => { if (document.pointerLockElement) document.exitPointerLock?.() }}
    >
      <div className="vm-panel-header">
        <div className="vm-panel-title-area">
          <span className="vm-panel-title">🧩 Code Craft</span>
          <span className="vm-panel-subtitle">Programa con bloques | /vm &lt;nombre&gt;</span>
        </div>
        <div className="vm-panel-actions">
          <button
            className="vm-btn-icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Vista dividida' : 'Pantalla completa'}
          >
            {isFullscreen ? '🗗 Reducir' : '🗖 Expandir'}
          </button>
          <button
            className="vm-btn-icon vm-btn-close"
            onClick={() => {
              hideModal({ reactType: 'visualmodder-panel' })
              vmState.isOpen = false
            }}
            title="Cerrar (V)"
          >
            ✕ Cerrar
          </button>
        </div>
      </div>
      <iframe
        ref={iframeRef}
        src="./blockly/editor/minecraft/index.html?lang=en"
        className="vm-panel-iframe"
        onLoad={handleIframeLoad}
        allow="fullscreen"
      />
    </div>
  )
}