import { startLoginServer, startSignServer } from '../src/util/cliServer.js'

const base = (port: number) => `http://127.0.0.1:${port}`

describe('startLoginServer', () => {
  let server: Awaited<ReturnType<typeof startLoginServer>>

  beforeEach(async () => {
    server = await startLoginServer()
  })
  afterEach(() => server.close())

  test('mints a high-entropy token and a /callback path', () => {
    expect(server.token).toMatch(/^[0-9a-f]{64}$/)
    expect(server.callbackPath).toBe('/callback')
  })

  test('rejects /callback without the token (403)', async () => {
    const res = await fetch(`${base(server.port)}/callback?address=5xx&signature=0x01`)
    expect(res.status).toBe(403)
  })

  test('rejects /callback with a wrong token (403)', async () => {
    const res = await fetch(`${base(server.port)}/callback?token=deadbeef&address=5xx&signature=0x01`)
    expect(res.status).toBe(403)
  })

  test('resolves waitForCallback on a valid tokened callback', async () => {
    const pending = server.waitForCallback(2000)
    const res = await fetch(
      `${base(server.port)}/callback?token=${server.token}` +
        `&address=5Alice&signature=0xabc&signatureType=sr25519`
    )
    expect(res.status).toBe(200)
    await expect(pending).resolves.toEqual({
      address: '5Alice',
      signature: '0xabc',
      signatureType: 'sr25519',
    })
  })

  test('accepts the hub cross-site top-level navigation to /callback', async () => {
    // The hub redirects the browser (https -> http://localhost) as a top-level
    // navigation; Chromium sends Sec-Fetch-Site: cross-site for it. That is the
    // legitimate login redirect and must be allowed (the token is the defense).
    const pending = server.waitForCallback(2000)
    const res = await fetch(
      `${base(server.port)}/callback?token=${server.token}` +
        `&address=5Alice&signature=0xabc&signatureType=sr25519`,
      {
        headers: {
          'sec-fetch-site': 'cross-site',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-dest': 'document',
        },
      }
    )
    expect(res.status).toBe(200)
    await expect(pending).resolves.toMatchObject({ address: '5Alice' })
  })

  test('400 + rejects when address/signature are missing', async () => {
    // Attach the rejection handler *before* triggering the reject.
    const assertion = expect(server.waitForCallback(2000)).rejects.toThrow(/missing/i)
    const res = await fetch(`${base(server.port)}/callback?token=${server.token}`)
    expect(res.status).toBe(400)
    await assertion
  })
})

describe('startSignServer', () => {
  let server: Awaited<ReturnType<typeof startSignServer>>

  beforeEach(async () => {
    server = await startSignServer('https://hub.acurast.com')
  })
  afterEach(() => server.close())

  test('bridgeUrl carries the id and token', () => {
    const url = server.bridgeUrl('req-1')
    expect(url).toContain('/sign?id=req-1')
    expect(url).toContain(`token=${server.token}`)
  })

  test('rejects /payload without the token (403)', async () => {
    const res = await fetch(`${base(server.port)}/payload?id=req-1`)
    expect(res.status).toBe(403)
  })

  test('rejects a cross-site fetch to /payload (403)', async () => {
    // A cross-site *fetch* (not a navigation) from another page must stay blocked.
    const res = await fetch(`${base(server.port)}/payload?id=req-1&token=${server.token}`, {
      headers: { 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'cors' },
    })
    expect(res.status).toBe(403)
  })

  test('404 for an unknown id', async () => {
    const res = await fetch(`${base(server.port)}/payload?id=nope&token=${server.token}`)
    expect(res.status).toBe(404)
  })

  test('serves the payload + summary, then resolves on a signature result', async () => {
    const payload = { method: '0x1234', address: '5Alice' }
    const summary = { kind: 'deploy', projectName: 'demo' }
    const pending = server.requestSignature('req-9', payload, summary as any, 2000)

    const payloadRes = await fetch(`${base(server.port)}/payload?id=req-9&token=${server.token}`)
    expect(payloadRes.status).toBe(200)
    await expect(payloadRes.json()).resolves.toEqual({ payload, summary })

    const resultRes = await fetch(`${base(server.port)}/result?id=req-9&token=${server.token}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ signature: '0xsig' }),
    })
    expect(resultRes.status).toBe(200)
    await expect(pending).resolves.toBe('0xsig')

    // The pending entry is consumed: a second /payload for the id is unknown.
    const again = await fetch(`${base(server.port)}/payload?id=req-9&token=${server.token}`)
    expect(again.status).toBe(404)
  })

  test('rejects the signature promise when the result carries an error', async () => {
    // Attach the rejection handler *before* triggering the reject.
    const assertion = expect(
      server.requestSignature('req-err', { method: '0x' }, undefined, 2000)
    ).rejects.toThrow(/user rejected/)
    await fetch(`${base(server.port)}/result?id=req-err&token=${server.token}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'user rejected' }),
    })
    await assertion
  })
})
