import pkg from 'elliptic'
const { ec } = pkg

import * as crypto from 'crypto'

import { getProcessorEncrypionKey } from './utils.js'
import type {
  EncKeyCurve,
  EncryptedValue,
  EnvVar,
  EnvVarEncrypted,
  JobAssignmentInfo,
  JobEnvironmentEncrypted,
  JobEnvironmentsEncrypted,
} from './types.js'
import { AcurastService } from './acurastService.js'
import type { KeyringPair } from '@polkadot/keyring/types'
import { LocalStorage } from '../../util/LocalStorage.js'

// Usage example
const localStorage = new LocalStorage()

export class JobEnvironmentService {
  constructor() {}

  private keyStorageId(
    type: 'publicKey' | 'privateKey',
    curve: EncKeyCurve
  ): string {
    return curve === 'p256' && localStorage.getItem(type)
      ? type // backwards compatiblity
      : `${type}_${curve}`
  }

  public getPublicKey(curve: EncKeyCurve): string | undefined {
    return (
      localStorage.getItem(this.keyStorageId('publicKey', curve)) ?? undefined
    )
  }

  public setPublicKey(key: string, curve: EncKeyCurve) {
    localStorage.setItem(this.keyStorageId('publicKey', curve), key)
  }

  public getPrivateKey(curve: EncKeyCurve): string | undefined {
    return (
      localStorage.getItem(this.keyStorageId('privateKey', curve)) ?? undefined
    )
  }

  public setPrivateKey(key: string, curve: EncKeyCurve) {
    localStorage.setItem(this.keyStorageId('privateKey', curve), key)
  }

  public async generateSharedSecret(
    processorPublicKeyHex: string,
    curve: EncKeyCurve
  ): Promise<string> {
    const EC = new ec(curve)

    let keyPair
    // Check if a private key exists in local storage
    const storedPrivateKeyHex = this.getPrivateKey(curve)
    if (storedPrivateKeyHex) {
      // Use the existing private key
      keyPair = EC.keyFromPrivate(storedPrivateKeyHex, 'hex')
    } else {
      // Generate a new key pair
      keyPair = EC.genKeyPair()
      // Store the new private key
      this.setPrivateKey(keyPair.getPrivate('hex'), curve)
      // store the compressed public key
      this.setPublicKey(keyPair.getPublic(true, 'hex'), curve)
    }

    const processorKey = EC.keyFromPublic(processorPublicKeyHex, 'hex')
    // Compute the shared secret ECDH
    const sharedSecret = keyPair.derive(processorKey.getPublic())

    // Convert the shared secret to a hex string (with proper padding)
    return Buffer.from(sharedSecret.toArray()).toString('hex')
  }

  public async generateSharedKey(
    processorPublicKeyHex: string,
    curve: EncKeyCurve
  ) {
    const sharedSecret = Buffer.from(
      await this.generateSharedSecret(processorPublicKeyHex, curve),
      'hex'
    )
    const sharedSecretSalt = Buffer.alloc(16) //empty 16 byte array for secred salt

    const EC = new ec(curve)

    let keyPair
    // Check if a private key exists in local storage
    const storedPrivateKeyHex = this.getPrivateKey(curve)
    if (storedPrivateKeyHex) {
      // Use the existing private key
      keyPair = EC.keyFromPrivate(storedPrivateKeyHex, 'hex')
    } else {
      // Generate a new key pair
      keyPair = EC.genKeyPair()
      // Store the new private key
      this.setPrivateKey(keyPair.getPrivate('hex'), curve)
      // store the compressed public key
      this.setPublicKey(keyPair.getPublic(true, 'hex'), curve)
    }

    const publicKey = Buffer.from(keyPair.getPublic(true, 'hex'), 'hex')
    const processorPublicKey = Buffer.from(processorPublicKeyHex, 'hex')

    // Sort the public keys
    const publicKeys = [publicKey, processorPublicKey].sort((a, b) => {
      if (a.length !== b.length) {
        return a.length - b.length
      } else {
        for (let i = 0; i < a.length; i++) {
          if (a[i] !== b[i]) {
            return a[i] - b[i]
          }
        }
        return 0
      }
    })

    const sharedCurveName =
      curve === 'p256' ? 'secp256r1' : curve === 'secp256k1' ? 'secp256k1' : ''

    const info = Buffer.concat([
      Buffer.from(`ECDH ${sharedCurveName} AES-256-GCM-SIV`, 'utf-8'),
      ...publicKeys,
    ])

    const derivedKey = await this.hkdf(sharedSecret, sharedSecretSalt, info, 32)

    return Buffer.from(derivedKey)
  }

  public async hkdf(
    keyMaterial: Buffer,
    salt: Uint8Array,
    info: Uint8Array,
    length: number
  ): Promise<ArrayBuffer> {
    const key = await crypto.subtle.importKey(
      'raw',
      keyMaterial,
      { name: 'HKDF' },
      false,
      ['deriveBits']
    )
    return await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        salt: salt,
        info: info,
        hash: 'SHA-256',
      },
      key,
      length * 8
    )
  }

  public encrypt(data: string, key: Buffer): EncryptedValue {
    const iv = crypto.randomBytes(12) // iv for AES-GCM should be 12 bytes
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    return {
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      authTag: cipher.getAuthTag().toString('hex'),
    }
  }

  public processEncryptedHex(hex: string): EncryptedValue {
    hex = hex.replace('0x', '')
    //slice first 12 bytes for iv, last 16 bytes for authTag
    const iv: string = hex.substring(0, 24) // First 12 bytes
    const ciphertext: string = hex.substring(24, hex.length - 32) // Middle portion
    const authTag: string = hex.substring(hex.length - 32) // Last 16 bytes

    return {
      ciphertext: ciphertext,
      iv: iv,
      authTag: authTag,
    }
  }

  public decrypt(data: EncryptedValue, key: Buffer): string {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(data.iv, 'hex')
    )
    decipher.setAuthTag(Buffer.from(data.authTag, 'hex'))

    let decrypted = decipher.update(data.ciphertext, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }

  public async setEnvironmentVariables(
    keyring: KeyringPair,
    assignment: JobAssignmentInfo,
    jobId: number,
    jobEnvironmentVariables: EnvVar[]
  ) {
    const processorEncryptionKey = getProcessorEncrypionKey(assignment)
    if (processorEncryptionKey !== undefined) {
      const sharedKey = await this.generateSharedKey(
        processorEncryptionKey.publicKey,
        processorEncryptionKey.curve
      )

      //encrypt environment variables
      const encryptedEnvironment: EnvVarEncrypted[] =
        jobEnvironmentVariables.map((envVar: EnvVar) => ({
          key: envVar.key,
          encryptedValue: this.encrypt(envVar.value, sharedKey),
        }))

      const publicKey = this.getPublicKey(processorEncryptionKey.curve)
      if (publicKey !== undefined) {
        const jobEnvironment: JobEnvironmentEncrypted = {
          publicKey,
          variables: encryptedEnvironment,
        }

        return this.setEnvironment(keyring, jobId, jobEnvironment)
      }
      return undefined
    }
    return undefined
  }

  private async setEnvironment(
    keyring: KeyringPair,
    jobId: number,
    jobEnvironment: JobEnvironmentEncrypted
  ): Promise<{ hash: string }> {
    return new Promise(async (resolve, reject) => {
      try {
        const acurast = new AcurastService()
        const hash = await acurast
          .setEnvironment(keyring, jobId, jobEnvironment)
          .then((v) => v.toString())
          .catch(reject)
        if (hash) {
          resolve({
            hash,
          })
        }
      } catch (e) {
        reject(e)
      }
    })
  }

  public async setEnvironmentVariablesMulti(
    keyring: KeyringPair,
    assignments: JobAssignmentInfo[],
    jobId: number,
    jobEnvironmentVariables: EnvVar[]
  ) {
    let jobEnvironments: JobEnvironmentsEncrypted = []

    for (let assignment of assignments) {
      const processorEncryptionKey = getProcessorEncrypionKey(assignment)

      if (processorEncryptionKey !== undefined) {
        const sharedKey = await this.generateSharedKey(
          processorEncryptionKey.publicKey,
          processorEncryptionKey.curve
        )

        //encrypt environment variables
        const encryptedEnvironment: EnvVarEncrypted[] =
          jobEnvironmentVariables.map((envVar: EnvVar) => ({
            key: envVar.key,
            encryptedValue: this.encrypt(envVar.value, sharedKey),
          }))

        const publicKey = this.getPublicKey(processorEncryptionKey.curve)
        if (publicKey !== undefined) {
          const jobEnvironment: JobEnvironmentEncrypted = {
            publicKey,
            variables: encryptedEnvironment,
          }

          jobEnvironments.push({
            processor: assignment.processor,
            jobEnvironment: jobEnvironment,
          })
        }
      }
    }

    return this.setEnvironments(keyring, jobId, jobEnvironments)
  }

  private async setEnvironments(
    keyring: KeyringPair,
    jobId: number,
    jobEnvironments: JobEnvironmentsEncrypted
  ): Promise<{ hash: string }> {
    return new Promise(async (resolve, reject) => {
      try {
        const acurast = new AcurastService()
        const hash = await acurast
          .setEnvironments(keyring, jobId, jobEnvironments)
          .then((v) => v.toString())
          .catch(reject)
        if (hash) {
          resolve({
            hash,
          })
        }
      } catch (e) {
        reject(e)
      }
    })
  }
}
