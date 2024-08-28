import { ensureDirectoryExistence } from './acurast/storeDeployment.js'

export const ENV_HELP_LINK = 'https://github.com/Acurast/acurast-cli' // TODO: Remove
export const getFaucetLinkForAddress = (address: string) => {
  return `https://faucet.acurast.com?address=${address}`
}

export const ACURAST_BASE_PATH = './.acurast'
ensureDirectoryExistence(ACURAST_BASE_PATH)

export const ACURAST_DEPLOYMENTS_PATH = `${ACURAST_BASE_PATH}/deploy`
ensureDirectoryExistence(ACURAST_DEPLOYMENTS_PATH)
