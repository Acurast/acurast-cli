import { Command, Option } from 'commander'
import { loadConfig } from '../acurast/loadConfig.js'
import { validateConfig } from '../util/validateConfig.js'
import { consoleOutput } from '../util/console-output.js'
import { filelogger } from '../util/fileLogger.js'
import { getWallet } from '../util/getWallet.js'
import * as ora from '../util/ora.js'
import { fetchAndDisplayPricing } from '../util/fetchPricingAdvice.js'

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
        config = loadConfig(project)
      } catch (e: any) {
        log(e.message)
        return
      }

      if (!config) {
        throw new Error('No project found')
      }

      const configResult = validateConfig(config)

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

      const wallet = await getWallet()
      const spinner = ora.default('Fetching market pricing data...')

      await fetchAndDisplayPricing(config, wallet.address, options, spinner)
    })
}
