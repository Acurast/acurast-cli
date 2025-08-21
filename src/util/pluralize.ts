export const pluralize = (number: number, text: string) => {
  return number === 1 ? text : text + 's'
}
