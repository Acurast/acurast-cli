import Module from 'node:module'
import { subtle } from 'crypto'

const require = Module.createRequire(import.meta.url)
import type { AcurastClient } from '@acurast/dapp'
const Acurast = require('@acurast/dapp')

import { packDataBytes, unpackDataBytes } from '@taquito/michel-codec'

const client: AcurastClient = new Acurast.AcurastClient([
  'wss://websocket-proxy-1.prod.gke.acurast.com/',
  'wss://websocket-proxy-2.prod.gke.acurast.com/',
])

export const sendCode = async (
  recipientPublicKey: string,
  code: string,
  callback: (event: { type: 'log' | 'success' | 'error'; data: string }) => void
) => {
  const keyPair = await subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['sign']
  )

  const [privateKeyRaw, publicKeyRaw] = await Promise.all([
    subtle
      .exportKey('jwk', keyPair.privateKey)
      .then((jwk) => Buffer.from(jwk.d as any, 'base64')),
    subtle
      .exportKey('raw', keyPair.publicKey)
      .then((arrayBuffer) => Buffer.from(arrayBuffer)),
  ])

  await client.start({
    secretKey: privateKeyRaw.toString('hex'),
    publicKey: publicKeyRaw.toString('hex'),
  })

  client.onMessage((message: any) => {
    const payload = unpackDataBytes({
      bytes: Buffer.from(message.payload).toString('hex'),
    })
    // console.log({
    //   sender: Buffer.from(message.sender).toString('hex'),
    //   recipient: Buffer.from(message.recipient).toString('hex'),
    //   payload,
    // })
    try {
      callback(JSON.parse((payload as any).string))
    } catch (e) {
      callback((payload as any).string)
    }
  })

  const wrapper = `(() => { ${code} })()`

  const packed = packDataBytes({
    string: wrapper,
  })

  client.send(recipientPublicKey, packed.bytes)
}
