import { readFileSync, writeFileSync } from 'fs'
import { ensureDirectoryExistence } from '../acurast/storeDeployment.js'
import { ACURAST_BASE_PATH } from '../constants.js'

interface LiveCodeProcessor {
  // address: string
  publicKey: string
  // endsAt: number
  // TODO: Re-enable and add "start time"
  // TODO: Add job info (eg. to re-create link, look up status, etc.)
}

const file = `${ACURAST_BASE_PATH}/live-code-processors.json`

export const readLiveCodeProcessors = (): LiveCodeProcessor[] => {
  return (() => {
    try {
      return JSON.parse(readFileSync(file, 'utf8'))
    } catch (e) {
      return []
    }
  })()
}

export const addLiveCodeProcessor = (processor: LiveCodeProcessor) => {
  ensureDirectoryExistence(file)

  const liveCodeProcessors = readLiveCodeProcessors()

  liveCodeProcessors.unshift(processor)

  writeFileSync(file, JSON.stringify(liveCodeProcessors, null, 2))
}
