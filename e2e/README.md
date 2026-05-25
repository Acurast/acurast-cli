# Acurast CLI — Docker E2E Tests

End-to-end tests run the real `acurast` CLI in an isolated Docker container against live canary infrastructure (RPC, matcher). Deploy steps always use `--dry-run` so no cACU is spent.

## Prerequisites

1. **Docker** and Docker Compose (or `docker compose`)
2. A **canary test mnemonic** with a small cACU balance (faucet: https://faucet.acurast.com)
3. Set `ACURAST_E2E_MNEMONIC` (never commit the real value)

Docker build context is the **repository root**; exclusions live in [`.dockerignore`](../.dockerignore) and [`e2e/.dockerignore`](.dockerignore).

### Derive the faucet address

From the repo root after `npm run build`:

```bash
node --input-type=module -e "
import { walletFromMnemonic } from '@acurast/sdk/chain';
const w = await walletFromMnemonic(process.env.ACURAST_E2E_MNEMONIC, { name: 'AcurastCli' });
console.log(w.address);
"
```

## Run locally

```bash
cp e2e/.env.example e2e/.env
# edit e2e/.env, then:
export $(grep -v '^#' e2e/.env | xargs)

npm run test:e2e
```

Uses `docker-compose` or `docker compose` depending on what is installed.

Run the same scenarios on the host (CLI must be built and linked). Scenario workspaces go to `e2e/.work` (not `/workspace`):

```bash
npm run build && npm link
export $(grep -v '^#' e2e/.env | xargs)
npm run test:e2e:local
```

### Interactive init (local TTY only)

Exercises the full Inquirer wizard (not run in default Docker CI):

```bash
npm run test:e2e:interactive
```

Requires a terminal and `script(1)`. Skips automatically when stdout is not a TTY.

## Scenarios

| Script | Description |
|--------|-------------|
| `00-smoke` | `--version`, `--help` |
| `01-init-greenfield` | `acurast init --defaults` on blank fixture |
| `02-init-existing-json` | `acurast init` when `acurast.json` exists |
| `03-blank-project-build-deploy-dry-run` | `init --defaults --instant-match`, build, `deploy --dry-run` |
| `04-estimate-fee` | `estimate-fee` using repo root `acurast.json` |
| `05-new-nodejs` | `acurast new --template nodejs` |
| `06-new-init-deploy` | `new` → `init --defaults --instant-match` → build → deploy dry-run |
| `07-init-interactive` | Interactive `acurast init` via pseudo-TTY (`test:e2e:interactive` only) |

## CLI flags used in e2e

| Flag | Purpose |
|------|---------|
| `init --defaults` | Non-interactive init from `package.json` |
| `init --network canary` | Canary network with `--defaults` |
| `init --instant-match` | Pin stable canary processor (requires `--defaults`) |
| `deploy --dry-run` | Full deploy path without submitting on-chain |
| `new --template nodejs` | Scaffold project (upstream `blank` template is docs-only) |

## CI

GitHub Actions job `e2e` expects repository secret `ACURAST_E2E_MNEMONIC`. Fork PRs without the secret skip the job with a clear message.

## Troubleshooting

- **Balance is 0**: fund the address via the canary faucet; preflight fails early with a direct link.
- **Init prompts hang in Docker**: use `init --defaults` (scenario `01`); use `test:e2e:interactive` for the wizard locally.
- **Network errors**: container needs outbound HTTPS/WSS to Acurast endpoints.
