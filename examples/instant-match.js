/**
 * Example: deployment with `assignmentStrategy.instantMatch` (see repo root
 * `acurast.json` → project `test-instant-match`, and README → "Instant match").
 *
 * Instant match pins planned executions to specific processor account(s). When this
 * script runs, `_STD_.device.getAddress()` should match the SS58 you listed under
 * `instantMatch[].processor` for that network (replace the placeholder in config
 * before a real deploy).
 *
 * This script only uses `print` (no DevTools, no outbound HTTP) so it is safe to
 * use as a minimal canary/mainnet smoke job after you set your processor address.
 */

const jobId = _STD_.job.getId()
const deviceAddress = _STD_.device.getAddress()

const report = {
  example: 'instant-match',
  hint: 'Compare deviceAddress to assignmentStrategy.instantMatch[].processor',
  jobId,
  deviceAddress,
  timestampMs: Date.now(),
}

print('[instant-match] ' + JSON.stringify(report))
print('[instant-match] done')
