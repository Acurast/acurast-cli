// This file is compiled to devtools-snippet.js and injected at the beginning
// of user scripts when enableDevtools is true. It overrides console methods to
// forward logs to the Acurast DevTools API.
//
// Placeholder __DEVTOOLS_API_URL__ is replaced at injection time by the CLI.

;(() => {
  const DEVTOOLS_API_URL = '__DEVTOOLS_API_URL__'

  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug,
  }

  // --- Auth: obtain a Bearer token from the devtools API ---
  let apiKey: string | null = null
  const pendingLogs: string[] = [] // buffered payloads while awaiting auth

  const toHex = (str: string): string => {
    let hex = ''
    for (let i = 0; i < str.length; i++) {
      hex += str.charCodeAt(i).toString(16).padStart(2, '0')
    }
    return hex
  }

  const sendBuffered = () => {
    for (const body of pendingLogs.splice(0)) {
      httpPOST(
        `${DEVTOOLS_API_URL}/v1/logs`,
        body,
        { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
        () => {},
        (error: string) => { originalConsole.error('[devtools] buffered log post failed:', error) }
      )
    }
  }

  try {
    const jobId = String(_STD_.job.getId().id)
    const processorAddress = _STD_.device.getAddress()
    const pubKeyHex = _STD_.job.getPublicKeys().ed25519
    const timestamp = String(Math.floor(Date.now() / 1000))
    const message = pubKeyHex + ':' + timestamp
    const messageHex = toHex(message)
    const signatureHex = _STD_.signers.ed25519.sign(messageHex)

    httpPOST(
      `${DEVTOOLS_API_URL}/v1/auth/api-key`,
      JSON.stringify({ jobId, processorAddress }),
      {
        'Content-Type': 'application/json',
        'X-Signature': signatureHex,
        'X-PublicKey': pubKeyHex,
        'X-Timestamp': timestamp,
      },
      (response: string, _certificate: string) => {
        try {
          const parsed = JSON.parse(response)
          apiKey = parsed.apiKey
          sendBuffered()
        } catch (_e) {
          originalConsole.error('[devtools] failed to parse auth response:', response)
        }
      },
      (error: string) => {
        originalConsole.error('[devtools] auth failed:', error)
      }
    )
  } catch (e: any) {
    originalConsole.error('[devtools] auth setup failed:', e?.message ?? String(e))
  }

  // --- Rate limiting ---
  const RATE_LIMIT_MAX = 20
  const RATE_LIMIT_WINDOW_MS = 10_000
  let rateBucketStart = Date.now()
  let rateBucketCount = 0
  let dropped = 0

  const sendLog = (level: string, args: unknown[]) => {
    const now = Date.now()

    if (now - rateBucketStart >= RATE_LIMIT_WINDOW_MS) {
      if (dropped > 0) {
        enqueue([{ type: 'warn', data: `[devtools] rate limit ended: ${dropped} log(s) were dropped`, timestamp: now }])
      }
      rateBucketStart = now
      rateBucketCount = 0
      dropped = 0
    }

    if (rateBucketCount >= RATE_LIMIT_MAX) {
      dropped++
      return
    }
    rateBucketCount++

    try {
      const data = args.length === 1 ? args[0] : args
      let serializable: unknown
      try {
        JSON.stringify(data)
        serializable = data
      } catch {
        serializable = String(data)
      }

      enqueue([{ type: level, data: serializable, timestamp: now }])
    } catch (_e) {
      // Silently ignore serialization errors to avoid breaking user scripts
    }
  }

  const enqueue = (entries: { type: string; data: unknown; timestamp: number }[]) => {
    const body = JSON.stringify(entries)

    if (apiKey) {
      httpPOST(
        `${DEVTOOLS_API_URL}/v1/logs`,
        body,
        { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
        () => {},
        (error: string) => { originalConsole.error('[devtools] log post failed:', error) }
      )
    } else {
      pendingLogs.push(body)
    }
  }

  for (const level of Object.keys(originalConsole) as Array<
    keyof typeof originalConsole
  >) {
    ;(console as any)[level] = (...args: unknown[]) => {
      originalConsole[level](...(args as [any, ...any[]]))
      sendLog(level, args)
    }
  }
})()
