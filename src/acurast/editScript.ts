import { MultiOrigin } from '../types.js'
import { AcurastService } from './env/acurastService.js'
import { getWallet } from '../util/getWallet.js'

/**
 * Updates the script of a mutable deployment
 * @param deploymentId - The deployment ID in format [MultiOrigin, address, number]
 * @param script - The IPFS hash of the new script (must start with "ipfs://")
 * @returns Promise<string> - The transaction hash
 */
export const editScript = async (
  deploymentId: [MultiOrigin, string, number],
  script: string
): Promise<string> => {
  // Validate that script is an IPFS hash
  if (!script.startsWith('ipfs://')) {
    throw new Error('Script must be an IPFS hash starting with "ipfs://"')
  }

  const acurast = new AcurastService()
  const wallet = await getWallet()

  try {
    await acurast.connect()

    if (!acurast.api) {
      throw new Error('API not connected')
    }

    // Convert the deploymentId to the format expected by the extrinsic
    // The extrinsic expects (AcurastCommonMultiOrigin, u128) where:
    // - AcurastCommonMultiOrigin is { acurast: AccountId32 }
    // - u128 is the deployment number
    const jobId = [
      { acurast: deploymentId[1] }, // AcurastCommonMultiOrigin
      deploymentId[2], // u128 deployment number
    ]

    // Convert IPFS hash to Bytes format
    // Remove 'ipfs://' prefix and convert to bytes
    const ipfsHash = script.replace('ipfs://', '')
    const scriptBytes = `0x${Buffer.from(ipfsHash, 'utf8').toString('hex')}`

    // Call the extrinsic
    const tx = await acurast.api.tx.acurastMarketplace.editScript(
      jobId,
      scriptBytes
    )
    const signedTx = await tx.signAsync(wallet)
    const hash = await signedTx.send()

    return hash.toString()
  } finally {
    await acurast.disconnect()
  }
}
