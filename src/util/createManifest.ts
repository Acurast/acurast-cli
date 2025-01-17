import type { RestartPolicy } from '../types.js'

export const createManifest = (
  name: string,
  entrypoint: string,
  restartPolicy: RestartPolicy
) => {
  return JSON.stringify({
    name,
    version: 1,
    entrypoint,
    restartPolicy,
  })
}
