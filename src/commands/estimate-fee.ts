import { Command, Option } from 'commander'
import { loadAcurastConfig } from '@acurast/sdk/deploy'
import { walletFromMnemonic } from '@acurast/sdk/chain'

import { validateCliConfig } from '../util/validateCliConfig.js'
import { consoleOutput } from '../util/console-output.js'
import { filelogger } from '../util/fileLogger.js'
import * as ora from '../util/ora.js'
import { fetchAndDisplayPricing } from '../util/fetchAndDisplayPricing.js'
import { getEnv } from '../config.js'

export const addCommandEstimateFee = (program: Command) => {
  program
    .command('estimate-fee [project]')
    .description('Estimate the fees for the specified project deployment.')
    .addOption(
      new Option(
        '-o, --output <format>',
        'Output a json with the estimation or human-readable text.'
      )
        .choices(['text', 'json'])
        .default('text')
    )
    .action(async (project: string, options: { output: 'text' | 'json' }) => {
      const log = consoleOutput(options.output)

      let config
      try {
        config = loadAcurastConfig({ project })
      } catch (e: any) {
        log(e.message)
        return
      }

      if (!config) {
        throw new Error('No project found')
      }

      const configResult = validateCliConfig(config)

      if (!configResult.success) {
        log('')
        log('⚠️ Project config is invalid:')
        log('')
        log(configResult.error)

        filelogger.error(
          `Config is invalid ${JSON.stringify(configResult.error)}`
        )
        return
      }

      if (options.output === 'text') {
        log('')
        log(`Estimating fees for project "${config.projectName}"`)
        log('')
      }

      const wallet = await walletFromMnemonic(getEnv('ACURAST_MNEMONIC'), {
        name: 'AcurastCli',
      })
      const spinner = ora.default('Fetching market pricing data...')

      await fetchAndDisplayPricing(config, wallet.address, options, spinner)
    })
}
