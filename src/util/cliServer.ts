import http from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import type { DeploySummary } from '../acurast/deploySummary.js'

/** Result delivered by the hub to the CLI's local server after `acurast login`. */
export interface LoginCallback {
  address: string
  signature: string
  signatureType: string
}

/** Default time the local servers wait for the browser before giving up. */
const DEFAULT_TIMEOUT_MS = 5 * 60_000

const SUCCESS_PAGE = (message: string): string => `<!doctype html>
<html><head><meta charset="utf-8"><title>Acurast CLI</title>
<style>body{font-family:system-ui,sans-serif;background:#0b0b0b;color:#c0e700;display:flex;
align-items:center;justify-content:center;height:100vh;margin:0}div{text-align:center}</style></head>
<body><div><h2>Acurast CLI</h2><p>${message}</p><p>You can close this tab and return to the terminal.</p></div></body></html>`

const send = (
  res: http.ServerResponse,
  status: number,
  body: string,
  contentType = 'text/html; charset=utf-8',
): void => {
  res.writeHead(status, { 'content-type': contentType })
  res.end(body)
}

/** Constant-time string comparison that never throws on length mismatch. */
const timingEqual = (a: string, b: string): boolean => {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) {
    // Still compare against a same-length buffer to keep timing uniform.
    timingSafeEqual(ab, ab)
    return false
  }
  return timingSafeEqual(ab, bb)
}

/**
 * Reject requests that look cross-origin. Top-level navigations (the hub's
 * https→http redirect to `/callback`, and the browser opening `/sign`) carry
 * no `Origin` header — those are allowed, and the per-session token is the real
 * defense there. The `Origin`/`Sec-Fetch-Site` checks protect the fetch-based
 * `/payload` and `/result` endpoints from being driven by another local page.
 */
const assertSameOriginLocalhost = (req: http.IncomingMessage, port: number): boolean => {
  const secFetchSite = req.headers['sec-fetch-site']
  if (secFetchSite === 'cross-site' || secFetchSite === 'same-site') {
    return false
  }
  const originHeader = req.headers['origin'] ?? req.headers['referer']
  if (originHeader) {
    try {
      const origin = new URL(String(originHeader)).origin
      if (origin !== `http://localhost:${port}` && origin !== `http://127.0.0.1:${port}`) {
        return false
      }
    } catch {
      return false
    }
  }
  return true
}

/**
 * Start an ephemeral local server that waits for the hub to redirect back with
 * a signed login challenge. The hub navigates the browser (top-level redirect,
 * not `fetch`, to avoid https→http mixed-content) to
 * `http://localhost:<port>/callback?address=…&signature=…&signatureType=…&token=…`.
 *
 * A high-entropy `token` is minted here and embedded in the hub URL the CLI
 * opens; the hub echoes it back verbatim on the redirect, and any `/callback`
 * whose token does not match is rejected — so a different local process or
 * visited page cannot forge a login callback.
 */
export const startLoginServer = async (options?: {
  timeoutMs?: number
}): Promise<{
  port: number
  token: string
  callbackPath: string
  waitForCallback: (timeoutMs?: number) => Promise<LoginCallback>
  close: () => void
}> => {
  const token = randomBytes(32).toString('hex')
  let port = 0

  let resolveCb: (v: LoginCallback) => void
  let rejectCb: (e: Error) => void
  const callbackPromise = new Promise<LoginCallback>((resolve, reject) => {
    resolveCb = resolve
    rejectCb = reject
  })

  const server = http.createServer((req, res) => {
    if (!assertSameOriginLocalhost(req, port)) {
      send(res, 403, 'Forbidden', 'text/plain')
      return
    }
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname !== '/callback') {
      send(res, 404, 'Not found', 'text/plain')
      return
    }
    if (!timingEqual(url.searchParams.get('token') ?? '', token)) {
      send(res, 403, SUCCESS_PAGE('Login failed: invalid request token.'))
      return
    }
    const address = url.searchParams.get('address') ?? ''
    const signature = url.searchParams.get('signature') ?? ''
    const signatureType = url.searchParams.get('signatureType') ?? ''
    if (!address || !signature) {
      send(res, 400, SUCCESS_PAGE('Login failed: missing parameters.'))
      rejectCb(new Error('Login callback missing address or signature'))
      return
    }
    send(res, 200, SUCCESS_PAGE('Login successful. ✅'))
    resolveCb({ address, signature, signatureType })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  server.unref() // don't let the open socket keep the CLI process alive
  port = (server.address() as AddressInfo).port

  const waitForCallback = (timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS): Promise<LoginCallback> =>
    Promise.race([
      callbackPromise,
      new Promise<LoginCallback>((_, reject) => {
        const t = setTimeout(
          () => reject(new Error('Timed out waiting for the browser login')),
          timeoutMs,
        )
        t.unref?.()
      }),
    ])

  return { port, token, callbackPath: '/callback', waitForCallback, close: () => server.close() }
}

interface PendingSign {
  payload: unknown
  /** Human-readable description of what is being signed (shown on the hub). */
  summary?: DeploySummary
  resolve: (signature: string) => void
  reject: (error: Error) => void
}

/**
 * The HTML bridge page the CLI serves at `/sign?id=…&token=…`. It runs on the
 * local (http) origin, so it can `fetch` the large payload from the CLI server,
 * then relays it to the hub (https) `cli-sign` popup via cross-origin
 * `postMessage` (immune to mixed-content), and POSTs the returned signature
 * back to the CLI. The hub popup is told this page's origin via `?bridgeOrigin`
 * so its "ready" ping targets a scoped origin rather than `*`.
 */
const SIGN_BRIDGE_PAGE = (hubUrl: string, id: string, token: string): string => `<!doctype html>
<html><head><meta charset="utf-8"><title>Acurast CLI – Sign</title>
<style>body{font-family:system-ui,sans-serif;background:#0b0b0b;color:#c0e700;display:flex;
align-items:center;justify-content:center;height:100vh;margin:0}div{text-align:center}
button{background:#c0e700;color:#0b0b0b;border:0;border-radius:8px;padding:12px 20px;font-size:16px;cursor:pointer}</style></head>
<body><div><h2>Acurast CLI</h2><p id="msg">Preparing signature request…</p>
<button id="btn" style="display:none">Open wallet to sign</button></div>
<script>
  var HUB = ${JSON.stringify(hubUrl)};
  var HUB_ORIGIN = new URL(HUB).origin;
  var ID = ${JSON.stringify(id)};
  var TOKEN = ${JSON.stringify(token)};
  var msg = document.getElementById('msg');
  var btn = document.getElementById('btn');
  var payload = null, summary = null, popup = null, done = false;

  function qs(){ return 'id='+encodeURIComponent(ID)+'&token='+encodeURIComponent(TOKEN); }
  function post(body){ return fetch('/result?'+qs(),{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify(body)}); }

  window.addEventListener('message', function(event){
    if (event.origin !== HUB_ORIGIN) return;
    var data = event.data || {};
    if (data.type === 'acurast-cli-ready' && popup) {
      popup.postMessage({ type:'acurast-cli-sign', payload: payload, summary: summary }, HUB_ORIGIN);
    } else if (data.type === 'acurast-cli-signature') {
      done = true;
      post({ signature: data.signature }).finally(function(){
        msg.textContent = 'Signature received. ✅ You can close this tab.';
        try { popup && popup.close(); } catch(e){}
      });
    } else if (data.type === 'acurast-cli-error') {
      done = true;
      post({ error: String(data.error || 'unknown') }).finally(function(){
        msg.textContent = 'Signing failed: ' + data.error;
      });
    }
  });

  function openWallet(){
    var url = HUB + '/cli-sign?bridgeOrigin=' + encodeURIComponent(location.origin);
    popup = window.open(url, 'acurast-cli-sign', 'width=480,height=760');
    if (!popup) { btn.style.display='inline-block'; msg.textContent='Please allow popups, then click below.'; return; }
    msg.textContent = 'Waiting for your wallet…';
  }
  btn.addEventListener('click', openWallet);

  fetch('/payload?'+qs()).then(function(r){return r.json();}).then(function(j){
    payload = j.payload;
    summary = j.summary || null;
    openWallet();
  }).catch(function(e){ msg.textContent = 'Could not load payload: ' + e; });
</script></body></html>`

/**
 * Long-lived local server used by the remote signer. Holds pending sign
 * requests keyed by id and survives multiple sequential signatures (a deploy
 * signs `deploy` then, minutes later, `setEnvironments`).
 *
 * All endpoints require the per-session `token` minted here (embedded in the
 * bridge URL the CLI opens and forwarded by the bridge page), and reject
 * cross-origin requests, so another local page cannot read the payload to be
 * signed or POST a forged signature.
 */
export const startSignServer = async (
  hubUrl: string,
  options?: { timeoutMs?: number },
): Promise<{
  port: number
  token: string
  bridgeUrl: (id: string) => string
  requestSignature: (
    id: string,
    payload: unknown,
    summary?: DeploySummary,
    timeoutMs?: number,
  ) => Promise<string>
  close: () => void
}> => {
  const token = randomBytes(32).toString('hex')
  const defaultTimeout = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  let port = 0
  const pending = new Map<string, PendingSign>()

  const server = http.createServer((req, res) => {
    if (!assertSameOriginLocalhost(req, port)) {
      send(res, 403, 'Forbidden', 'text/plain')
      return
    }
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (!timingEqual(url.searchParams.get('token') ?? '', token)) {
      send(res, 403, 'Forbidden', 'text/plain')
      return
    }
    const id = url.searchParams.get('id') ?? ''

    if (req.method === 'GET' && url.pathname === '/sign') {
      send(res, 200, SIGN_BRIDGE_PAGE(hubUrl, id, token))
      return
    }

    if (req.method === 'GET' && url.pathname === '/payload') {
      const entry = pending.get(id)
      if (!entry) {
        send(res, 404, JSON.stringify({ error: 'unknown id' }), 'application/json')
        return
      }
      send(
        res,
        200,
        JSON.stringify({ payload: entry.payload, summary: entry.summary ?? null }),
        'application/json',
      )
      return
    }

    if (req.method === 'POST' && url.pathname === '/result') {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk
        if (body.length > 5_000_000) req.destroy()
      })
      req.on('end', () => {
        const entry = pending.get(id)
        if (!entry) {
          send(res, 404, JSON.stringify({ error: 'unknown id' }), 'application/json')
          return
        }
        try {
          const parsed = JSON.parse(body || '{}') as { signature?: string; error?: string }
          if (parsed.error) {
            entry.reject(new Error(parsed.error))
          } else if (parsed.signature) {
            entry.resolve(parsed.signature)
          } else {
            entry.reject(new Error('Signing response missing signature'))
          }
        } catch (e) {
          entry.reject(e instanceof Error ? e : new Error(String(e)))
        } finally {
          pending.delete(id)
          send(res, 200, JSON.stringify({ ok: true }), 'application/json')
        }
      })
      return
    }

    send(res, 404, 'Not found', 'text/plain')
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  server.unref() // don't let the open socket keep the CLI process alive
  port = (server.address() as AddressInfo).port

  const bridgeUrl = (id: string): string =>
    `http://localhost:${port}/sign?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`

  const requestSignature = (
    id: string,
    payload: unknown,
    summary?: DeploySummary,
    timeoutMs = defaultTimeout,
  ): Promise<string> =>
    new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error('Timed out waiting for the browser wallet signature'))
      }, timeoutMs)
      timer.unref?.()
      pending.set(id, {
        payload,
        summary,
        resolve: (sig) => {
          clearTimeout(timer)
          resolve(sig)
        },
        reject: (err) => {
          clearTimeout(timer)
          reject(err)
        },
      })
    })

  return { port, token, bridgeUrl, requestSignature, close: () => server.close() }
}
