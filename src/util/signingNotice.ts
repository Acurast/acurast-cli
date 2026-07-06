import type { SigningMode } from './authStore.js'

/**
 * One-line, user-facing notice shown at deploy time so it is always clear how
 * the deployment is being signed — in particular that a local mnemonic means a
 * private key is being read from the environment.
 */
export const signingNoticeLine = (mode: SigningMode, address: string): string =>
  mode === 'local'
    ? `Signing with local mnemonic (${address}) — private key is read from your environment.`
    : `Signing with your browser wallet (${address}).`
