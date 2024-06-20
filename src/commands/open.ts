import { select } from '@inquirer/prompts'
import { Command } from 'commander'
import open from 'open'

// TODO: Move to config
const webConsole = 'https://console.acurast.com'
const website = 'https://docs.acurast.com/'
const explorer =
  'https://polkadot.js.org/apps/?rpc=wss://acurast-canarynet-ws.prod.gke.acurast.com#/explorer'
const telegramBot = 'https://t.me/AcurastBot'
const telegramGroup = 'https://t.me/acurastnetwork'
const discordGroup = 'https://discord.gg/wqgC6b6aKe'
const faucet = 'https://faucet.acurast.com/'

export const addCommandOpen = (program: Command) => {
  program
    .command('open')
    .description('Open Acurast websites in your browser')
    .action(async () => {
      const answer = await select({
        message: 'Which website do you want to open?',
        choices: [
          { name: 'Console', description: 'Web Console', value: webConsole },
          {
            name: 'Docs',
            description: 'Acurast Documentation',
            value: website,
          },
          {
            name: 'Faucet',
            description: 'Get some cACU to get started',
            value: faucet,
          },
          {
            name: 'Explorer',
            description: 'Acurast Network Explorer',
            value: explorer,
          },
          {
            name: 'Telegram Bot',
            description:
              'Telegram Bot to get notified about processor and job changes',
            value: telegramBot,
          },
          {
            name: 'Telegram Group',
            description: 'Telegram Group for the latest updates and community',
            value: telegramGroup,
          },
          {
            name: 'Discord Group',
            description: 'Discord Group for the latest updates and community',
            value: discordGroup,
          },
        ],
      })
      console.log(`Opening ${answer} in browser...`)
      await open(answer)
    })
}
