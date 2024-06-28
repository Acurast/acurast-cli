export const humanTime = (
  ms: number,
  includeSeconds: boolean = false
): string => {
  const seconds = Math.floor(Math.abs(ms) / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(weeks / 4)
  const years = Math.floor(months / 12)

  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`
  } else if (minutes < 60) {
    const remainingSeconds = seconds % 60
    return `${minutes} minute${minutes !== 1 ? 's' : ''}${
      includeSeconds
        ? ` ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`
        : ``
    }`
  } else if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`
  } else if (days < 7) {
    return `${days} day${days !== 1 ? 's' : ''}`
  } else if (weeks < 4) {
    return `${weeks} week${weeks !== 1 ? 's' : ''}`
  } else if (months < 12) {
    return `${months} month${months !== 1 ? 's' : ''}`
  } else {
    return `${years} year${years !== 1 ? 's' : ''}`
  }
}
