import { Command } from 'commander'

export const addCommandJobs = (program: Command) => {
  program
    .command('jobs')
    .alias('job')
    .argument('<jobId>', 'The ID of the job to get information about')
    .description('Get information about your deployed jobs')
    .action(async () => {
      console.log('Not implemented yet!')
    })
}
