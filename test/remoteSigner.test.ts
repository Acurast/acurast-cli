import { jest } from '@jest/globals'

const openMock = jest.fn(async (_url: string) => undefined)
jest.unstable_mockModule('open', () => ({ default: openMock }))

const { RemoteSigner } = await import('../src/acurast/remoteSigner.js')

describe('RemoteSigner', () => {
  beforeEach(() => openMock.mockClear())

  const makeDeps = () => {
    const requestSignature = jest.fn(
      async (_id: string, _payload: unknown, _summary?: unknown) => '0xSIGNATURE'
    )
    const bridgeUrl = jest.fn((id: string) => `http://localhost:5555/sign?id=${id}&token=tok`)
    const getSummary = jest.fn((_payload: unknown, callIndex: number) => ({
      kind: callIndex === 0 ? 'deploy' : 'setEnvironments',
    }))
    const onOpen = jest.fn()
    return { requestSignature, bridgeUrl, getSummary, onOpen }
  }

  test('signPayload registers an unguessable id, opens the bridge, returns the signature', async () => {
    const deps = makeDeps()
    const signer = new RemoteSigner(deps as any)

    const result = await signer.signPayload({ method: '0x01' } as any)

    expect(result.signature).toBe('0xSIGNATURE')
    expect(result.id).toBe(1)

    expect(deps.requestSignature).toHaveBeenCalledTimes(1)
    const [reqId, payload, summary] = deps.requestSignature.mock.calls[0]
    expect(reqId).toMatch(/^[0-9a-f]{32}$/) // random 16-byte hex, not a guessable counter
    expect(payload).toEqual({ method: '0x01' })
    expect(summary).toEqual({ kind: 'deploy' })

    const url = `http://localhost:5555/sign?id=${reqId}&token=tok`
    expect(deps.onOpen).toHaveBeenCalledWith(reqId, url)
    expect(openMock).toHaveBeenCalledWith(url)
  })

  test('labels the second signature as setEnvironments and increments the result id', async () => {
    const deps = makeDeps()
    const signer = new RemoteSigner(deps as any)

    await signer.signPayload({ method: '0x01' } as any)
    const second = await signer.signRaw({ data: '0x02' } as any)

    expect(second.id).toBe(2)
    expect(deps.getSummary.mock.calls[1][1]).toBe(1) // callIndex 1
    expect(deps.requestSignature.mock.calls[1][2]).toEqual({ kind: 'setEnvironments' })
  })

  test('propagates a rejection from the bridge', async () => {
    const deps = makeDeps()
    deps.requestSignature.mockRejectedValueOnce(new Error('user rejected') as never)
    const signer = new RemoteSigner(deps as any)
    await expect(signer.signPayload({ method: '0x' } as any)).rejects.toThrow('user rejected')
  })
})
