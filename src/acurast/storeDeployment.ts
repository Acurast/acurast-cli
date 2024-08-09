import { existsSync, mkdirSync, writeFileSync } from 'fs'
import {
  AcurastDeployment,
  AcurastProjectConfig,
  JobRegistration,
} from '../types.js'
import path from 'path'

export const ensureDirectoryExistence = (filePath: string) => {
  var dirname = path.dirname(filePath)
  if (existsSync(dirname)) {
    return true
  }

  mkdirSync(dirname, { recursive: true })
}

export const storeDeployment = async (
  config: AcurastProjectConfig,
  job: JobRegistration
) => {
  const now = Date.now()

  const deployment: AcurastDeployment = {
    // transactionId: "",

    // deploymentId?: "",

    deployedAt: now,

    assignments: [
      //   {
      //   processorId: string,
      //   status: "matched" | "acknowledged" | "failed",
      // }
    ],

    status: 'init',
    config: config,
    registration: job,
  }

  const fileName = `./.acurast/deploy/${config.projectName}-${now}.json`
  ensureDirectoryExistence(fileName)

  writeFileSync(fileName, JSON.stringify(deployment, null, 2))
}
