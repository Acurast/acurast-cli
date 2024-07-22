export const shortenString = (str: string): string => {
  if (str.length <= 10) return str
  return str.slice(0, 5) + '...' + str.slice(-5)
}
