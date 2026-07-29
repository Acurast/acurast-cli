import type { AuthRecord, AuthScope, SigningMode } from './authStore.js'

/**
 * One-line, user-facing notice shown at deploy time so it is always clear how
 * the deployment is being signed — in particular that a local mnemonic means a
 * private key is being read from the environment.
 */
export const signingNoticeLine = (mode: SigningMode, address: string): string =>
  mode === 'local'
    ? `Signing with local mnemonic (${address}) — private key is read from your environment.`
    : `Signing with your browser wallet (${address}).`

const daysAgo = (iso: string): number | null => {
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return null
  return Math.floor((Date.now() - at) / (24 * 60 * 60 * 1000))
}

/**
 * Shown when the only thing standing between the user and a deploy is an aged-out
 * login. Without this they get `"ACURAST_MNEMONIC" is not defined in the
 * environment.` — technically true (the expired session dropped the signing mode
 * back to `local`) but it points at the wrong fix.
 */
export const expiredSessionMessage = (expired: {
  scope: AuthScope
  record: AuthRecord
}): string => {
  const { scope, record } = expired
  const days = daysAgo(record.loggedInAt)
  const since = days === null ? '' : ` ${days} days ago`
  const where =
    scope === 'project'
      ? 'This project is pinned to an account whose session expired'
      : 'Your Acurast session expired'

  return [
    `${where}${since} (${record.address}).`,
    '',
    'Run `acurast login` to sign in with your browser wallet again,',
    'or set ACURAST_MNEMONIC to sign locally instead.',
  ].join('\n')
}
