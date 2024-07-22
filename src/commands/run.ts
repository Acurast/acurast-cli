import { Command } from 'commander'

export const addCommandRun = (program: Command) => {
  program
    .command('run [project]')
    .alias('serve')
    .description('(v2) Run the project locally for development')
    .action(async (project: string) => {
      throw new Error('Not implemented')
    })
}
