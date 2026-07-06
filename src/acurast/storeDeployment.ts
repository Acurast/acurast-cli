import { readdir, readFileSync, writeFileSync } from 'fs'
import type {
  AcurastDeployment,
  AcurastProjectConfig,
  JobRegistration,
  JobId,
} from '@acurast/sdk/types'
import { jobToNumber } from '@acurast/sdk/chain'
import { ACURAST_DEPLOYMENTS_PATH } from '../constants.js'
import { ensureDirectoryExistence } from '../util/ensureDirectoryExistence.js'

// Re-exported for existing importers; the implementation lives in util so
// `constants.js` can use it without an import cycle.
export { ensureDirectoryExistence }

const getFileByDeploymentTime = async (
  deploymentTime: string
): Promise<
  { filename: string; contentJson: AcurastDeployment } | undefined
> => {
  return new Promise((resolve, reject) => {
    readdir(ACURAST_DEPLOYMENTS_PATH, (err, files) => {
      if (err) {
        console.error('Error reading directory:', err)
        return
      }

      const matchingFile = files.find((file) => file.includes(deploymentTime))

      if (matchingFile) {
        // console.log('Files containing "deploymentTime":', matchingFile)

        const fileContents = readFileSync(
          `${ACURAST_DEPLOYMENTS_PATH}/${matchingFile}`,
          'utf8'
        )

        try {
          const json = JSON.parse(fileContents)
          resolve({ filename: matchingFile, contentJson: json })
        } catch (e) {
          reject(e)
        }
      } else {
        // console.log(`No files contain deploymentTime "${deploymentTime}".`)
        resolve(undefined)
      }
    })
  })
}

export const storeDeployment = async (
  deploymentTime: Date,
  config: AcurastProjectConfig,
  job: JobRegistration,
  jobId?: JobId
) => {
  const existingFile = await getFileByDeploymentTime(
    deploymentTime.getTime().toString()
  )

  if (!existingFile) {
    const deployment: AcurastDeployment = {
      // transactionId: "",

      // deploymentId?: "",

      deployedAt: deploymentTime.toISOString(),

      assignments: [
        //   {
        //   processorId: string,
        //   status: "matched" | "acknowledged" | "failed",
        // }
      ],

      status: 'init',
      config: config,
      registration: job,

      deploymentId: jobId,
    }

    const fileName = `${ACURAST_DEPLOYMENTS_PATH}/${config.projectName}-${deploymentTime.getTime().toString()}.json`

    ensureDirectoryExistence(fileName)

    writeFileSync(fileName, JSON.stringify(deployment, null, 2))
  } else {
    if (jobId) {
      const newFilename =
        existingFile.filename.substring(0, existingFile.filename.length - 5) +
        `-${jobToNumber(jobId)}.json`
      const newContent = {
        ...existingFile.contentJson,
        deploymentId: jobId,
      }

      // console.log('NEW CONTENT', newFilename, newContent)

      writeFileSync(
        `${ACURAST_DEPLOYMENTS_PATH}/${newFilename}`,
        JSON.stringify(newContent, null, 2)
      )
    }
  }
}
