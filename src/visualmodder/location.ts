import { Vec3 } from 'vec3'

export class VmLocation {
  x: number
  y: number
  z: number
  yaw: number // in degrees
  pitch: number // in degrees

  constructor(x = 0, y = 0, z = 0, yaw = 0, pitch = 0) {
    this.x = x
    this.y = y
    this.z = z
    this.yaw = yaw
    this.pitch = pitch
  }

  clone(): VmLocation {
    return new VmLocation(this.x, this.y, this.z, this.yaw, this.pitch)
  }

  getX(): number { return this.x }
  getY(): number { return this.y }
  getZ(): number { return this.z }
  getYaw(): number { return this.yaw }
  getPitch(): number { return this.pitch }

  toVec3(): Vec3 {
    return new Vec3(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z))
  }

  /**
   * Move the turtle in relative or absolute direction
   */
  move(times: number, direction: string): VmLocation {
    const d = (direction || 'FW').toUpperCase().trim()
    const radYaw = (this.yaw * Math.PI) / 180
    const radPitch = (this.pitch * Math.PI) / 180

    // Standard Minecraft forward vector
    const forwardX = -Math.sin(radYaw) * Math.cos(radPitch)
    const forwardY = -Math.sin(radPitch)
    const forwardZ = Math.cos(radYaw) * Math.cos(radPitch)

    // Horizontal forward (for ground-relative movement)
    const hForwardX = -Math.sin(radYaw)
    const hForwardZ = Math.cos(radYaw)

    // Right vector (perpendicular to horizontal forward)
    const rightX = Math.cos(radYaw)
    const rightZ = Math.sin(radYaw)

    let dx = 0
    let dy = 0
    let dz = 0

    switch (d) {
      case 'FW':
      case 'FORWARD':
        if (Math.abs(this.pitch) > 1) {
          dx = forwardX * times
          dy = forwardY * times
          dz = forwardZ * times
        } else {
          dx = hForwardX * times
          dz = hForwardZ * times
        }
        break
      case 'BW':
      case 'BACK':
      case 'BACKWARD':
        if (Math.abs(this.pitch) > 1) {
          dx = -forwardX * times
          dy = -forwardY * times
          dz = -forwardZ * times
        } else {
          dx = -hForwardX * times
          dz = -hForwardZ * times
        }
        break
      case 'LEFT':
        dx = -rightX * times
        dz = -rightZ * times
        break
      case 'RIGHT':
        dx = rightX * times
        dz = rightZ * times
        break
      case 'UP':
        dy = times
        break
      case 'DOWN':
        dy = -times
        break
      case 'EAST':
        dx = times
        break
      case 'WEST':
        dx = -times
        break
      case 'NORTH':
        dz = -times
        break
      case 'SOUTH':
        dz = times
        break
      default:
        dx = hForwardX * times
        dz = hForwardZ * times
        break
    }

    return new VmLocation(
      Math.round((this.x + dx) * 1000) / 1000,
      Math.round((this.y + dy) * 1000) / 1000,
      Math.round((this.z + dz) * 1000) / 1000,
      this.yaw,
      this.pitch
    )
  }

  rotate(angle: number): VmLocation {
    const newYaw = (this.yaw + angle) % 360
    return new VmLocation(this.x, this.y, this.z, newYaw, this.pitch)
  }

  setRotation(angle: number | string): VmLocation {
    let numAngle = typeof angle === 'number' ? angle : parseFloat(angle)
    if (isNaN(numAngle)) numAngle = 0
    return new VmLocation(this.x, this.y, this.z, numAngle % 360, this.pitch)
  }

  setElevation(angle: number | string): VmLocation {
    let numAngle = typeof angle === 'number' ? angle : parseFloat(angle)
    if (isNaN(numAngle)) numAngle = 0
    return new VmLocation(this.x, this.y, this.z, this.yaw, Math.max(-90, Math.min(90, numAngle)))
  }

  setElevationRelative(angle: number): VmLocation {
    const newPitch = Math.max(-90, Math.min(90, this.pitch + angle))
    return new VmLocation(this.x, this.y, this.z, this.yaw, newPitch)
  }
}