import { Command } from 'commander'

export const addCommandLogin = (program: Command) => {
  program
    .command('login')
    .description('(v2) Log in to the Acurast CLI with your manager account')
    .action(async () => {
      console.log('Not implemented yet!')
      console.log('Initializing Acurast CLI')
    })
}
