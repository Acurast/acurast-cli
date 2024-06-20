import { Command } from 'commander'

export const addCommandTest = (program: Command) => {
  program
    .command('test')
    .description(
      '(v2) Test the project against the Acurast runtime environment'
    )
    .action(async () => {
      console.log('Not implemented yet!')
    })
}
