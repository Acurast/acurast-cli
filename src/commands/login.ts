import { Command, Option } from 'commander'
import { randomBytes } from 'node:crypto'
import open from 'open'
import { cryptoWaitReady } from '@polkadot/util-crypto'

import { getHubUrl, CLI_NETWORKS, type CliNetwork } from '../config.js'
import { startLoginServer } from '../util/cliServer.js'
import { setAuth, type AuthScope } from '../util/authStore.js'
import {
  buildLoginChallenge,
  isChallengeRecent,
  verifyLoginSignature,
} from '../acurast/loginChallenge.js'
import { acurastColor } from '../util.js'

/**
 * Run the browser-wallet login flow: start a local server, open the hub, verify
 * the signed challenge, and persist the address in the given scope. Reused by
 * both the `login` command and `init`. Returns the logged-in address, or null
 * if login did not complete.
 */
export const runLogin = async (options: {
  network: CliNetwork
  scope: AuthScope
}): Promise<string | null> => {
  await cryptoWaitReady()

  const server = await startLoginServer()
  const nonce = randomBytes(16).toString('hex')
  const issuedAt = new Date().toISOString()
  const message = buildLoginChallenge(nonce, issuedAt)

  const hubUrl = getHubUrl()
  const loginUrl =
    `${hubUrl}/cli-login` +
    `?port=${server.port}` +
    `&challenge=${encodeURIComponent(message)}` +
    `&token=${encodeURIComponent(server.token)}`

  console.log('Opening the Acurast Hub in your browser to sign in...')
  console.log(`If it does not open automatically, visit:\n  ${loginUrl}\n`)

  try {
    await open(loginUrl)
  } catch {
    // Non-interactive environment — the URL was printed above.
  }

  try {
    const { address, signature, signatureType } = await server.waitForCallback()

    // Re-derive the expected message (do not trust anything the callback
    // claims) and verify the wallet signed exactly it, recently.
    if (!isChallengeRecent(issuedAt)) {
      console.log('Login failed: the challenge expired. Please run `acurast login` again.')
      return null
    }
    if (!verifyLoginSignature(message, signature, address)) {
      console.log(
        'Login failed: the signature could not be verified against the provided address.'
      )
      return null
    }

    const now = new Date().toISOString()
    setAuth(
      {
        address,
        signatureType: signatureType || 'unknown',
        network: options.network,
        loggedInAt: now,
        lastUsedAt: now,
      },
      options.scope
    )

    const scopeNote =
      options.scope === 'project'
        ? ' for this project'
        : ' (available in every project)'
    console.log(
      acurastColor(`\nLogged in as ${address}${scopeNote}`) +
        '\nThe CLI will now use this address and ask your browser wallet to sign deployments.'
    )
    return address
  } catch (error) {
    console.log(`Login failed: ${error instanceof Error ? error.message : String(error)}`)
    return null
  } finally {
    server.close()
  }
}

export const addCommandLogin = (program: Command) => {
  program
    .command('login')
    .description(
      'Log in with your browser wallet. Opens the Acurast Hub, asks you to sign a challenge, and stores your address.'
    )
    .addOption(
      new Option(
        '--network <network>',
        'Network to associate with this login (informational; deploy uses the project config).'
      )
        .choices(CLI_NETWORKS as unknown as string[])
        .default('mainnet')
    )
    .option(
      '--project',
      'Pin this login to the current project (./.acurast) instead of the global (~/.acurast) login.'
    )
    .action(async (options: { network: CliNetwork; project?: boolean }) => {
      await runLogin({ network: options.network, scope: options.project ? 'project' : 'global' })
    })
}
