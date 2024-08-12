import type {
  JobAssignmentInfo,
  PubKey,
  EncKeyCurve,
  ProcessorEncryptionKey,
} from './types.js'

function findProcessorEncrypionKey(
  assignment: JobAssignmentInfo,
  type: [keyof PubKey, EncKeyCurve]
): ProcessorEncryptionKey | undefined {
  return assignment.assignment.pubKeys
    .map((keyObj): ProcessorEncryptionKey | undefined => {
      const publicKey = keyObj[type[0]]

      return publicKey ? { publicKey, curve: type[1] } : undefined
    })
    .find((key) => key !== undefined)
}

export function getProcessorEncrypionKey(
  assignment: JobAssignmentInfo
): ProcessorEncryptionKey | undefined {
  const key =
    findProcessorEncrypionKey(assignment, ['SECP256r1Encryption', 'p256']) ??
    findProcessorEncrypionKey(assignment, [
      'SECP256k1Encryption',
      'secp256k1',
    ]) ??
    /* backwards compatibility */ findProcessorEncrypionKey(assignment, [
      'SECP256r1',
      'p256',
    ])

  return key !== undefined
    ? { ...key, publicKey: key.publicKey.replace('0x', '') }
    : undefined
}
