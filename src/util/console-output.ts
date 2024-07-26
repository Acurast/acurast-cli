export const consoleOutput = (type: 'text' | 'json') => {
  return (message: string, json?: string) => {
    if (type === 'text') {
      console.log(message)
    } else if (type === 'json') {
      if (json) {
        if (typeof json === 'string') {
          console.log(json)
        } else {
          console.log(JSON.stringify(json))
        }
      } else {
        if (message.length > 0) {
          console.log(JSON.stringify({ message }))
        }
      }
    }
  }
}
