import type { VoidFn } from '@polkadot/api/types'
import { AcurastService } from './acurastService.js'
import type { EnvVar, Job, JobAssignmentInfo } from './types.js'
import { sameJobIds } from './utils.js'

export class JobEnvHelper {
  public assignments: JobAssignmentInfo[] = []

  private jobAssignmentUnsub?: VoidFn

  public async setEnvVars(job: Job, envVars: EnvVar[]) {
    console.log('Setting env variables', job, envVars)

    this.watchJobAssignments(job)
  }

  private async watchJobAssignments(job: Job) {
    this.unsubJobAssignment()
    const acurast = new AcurastService()
    this.jobAssignmentUnsub = await acurast.subscribeToJobAssignmentEvents(
      (assignment) => {
        if (!sameJobIds(assignment.id, job.id)) {
          return
        }
        const index = this.assignments.findIndex(
          (value) => assignment.processor === value.processor
        )
        if (index < 0) {
          this.assignments = [...this.assignments, assignment]
        } else {
          const current = this.assignments
          current[index] = assignment
          this.assignments = current
        }

        console.log('assignments', this.assignments)
      }
    )
  }

  private unsubJobAssignment() {
    if (this.jobAssignmentUnsub) {
      this.jobAssignmentUnsub()
      this.jobAssignmentUnsub = undefined
    }
  }
}
