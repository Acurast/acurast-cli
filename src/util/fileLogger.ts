import { appendFileSync } from 'fs'
import type { JobId } from '../acurast/env/types.js'
import { jobToNumber } from './jobToNumber.js'

class FileLogger {
  private jobId?: JobId

  setJobId(jobId: JobId) {
    this.jobId = jobId
  }

  debug(message: string) {
    this.logToFile(`DEBUG - ${message}`)
  }

  info(message: string) {
    this.logToFile(`INFO - ${message}`)
  }

  log(message: string) {
    this.logToFile(`LOG - ${message}`)
  }

  warn(message: string) {
    this.logToFile(`WARN - ${message}`)
  }

  error(message: string) {
    this.logToFile(`ERROR - ${message}`)
  }

  private logToFile(message: string) {
    appendFileSync(
      '.acurast/acurast.log',
      `${new Date().toISOString()} - ${
        this.jobId ? `[${jobToNumber(this.jobId)}] ` : ''
      }${message}\n`
    )
  }
}

export const filelogger = new FileLogger()
