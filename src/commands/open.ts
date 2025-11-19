import { select } from '@inquirer/prompts'
import { Command } from 'commander'
import open from 'open'
import { getRpcForNetwork } from '../config.js'

// TODO: Move to config
const acurastHub = 'https://hub.acurast.com'
const website = 'https://docs.acurast.com/'
const explorerMainnet = `https://polkadot.js.org/apps/?rpc=${encodeURIComponent(getRpcForNetwork('mainnet'))}#/explorer`
const explorerCanary = `https://polkadot.js.org/apps/?rpc=${encodeURIComponent(getRpcForNetwork('canary'))}#/explorer`
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
          { name: 'Hub', description: 'Acurast Hub', value: acurastHub },
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
            name: 'Explorer (Mainnet)',
            description: 'Acurast Mainnet Explorer',
            value: explorerMainnet,
          },
          {
            name: 'Explorer (Canary)',
            description: 'Acurast Canary Explorer',
            value: explorerCanary,
          },
          {
            name: 'Telegram Bot',
            description:
              'Telegram Bot to get notified about processor and balance changes',
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
