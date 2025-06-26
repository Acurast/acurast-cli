import { MultiOrigin } from '../types.js'
import { AcurastService } from './env/acurastService.js'
import { getWallet } from '../util/getWallet.js'

/**
 * Transfers editor permissions for a mutable deployment
 * @param deploymentId - The deployment ID in format [MultiOrigin, address, number]
 * @param newEditor - The AccountId32 address of the new editor
 * @returns Promise<string> - The transaction hash
 */
export const transferEditor = async (
  deploymentId: [MultiOrigin, string, number],
  newEditor: string
): Promise<string> => {
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

    // The newEditor parameter is an Option<AccountId32>
    // We wrap it in an Option structure
    const newEditorOption = { Some: newEditor }

    // Call the extrinsic
    const tx = await acurast.api.tx.acurastMarketplace.transferEditor(
      jobId,
      newEditorOption
    )
    const signedTx = await tx.signAsync(wallet)
    const hash = await signedTx.send()

    return hash.toString()
  } finally {
    await acurast.disconnect()
  }
}
