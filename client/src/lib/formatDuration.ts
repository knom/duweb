export function formatDuration(runtimeMs?: number): string {
  if (runtimeMs === undefined || !Number.isFinite(runtimeMs) || runtimeMs < 0) {
    return '0s'
  }

  const totalSeconds = Math.floor(runtimeMs / 1000)
  const seconds = totalSeconds % 60
  const minutes = Math.floor(totalSeconds / 60) % 60
  const hours = Math.floor(totalSeconds / 3600)

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }

  return `${seconds}s`
}