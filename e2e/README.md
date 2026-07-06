# Acurast CLI — Docker E2E Tests

End-to-end tests run the real `acurast` CLI in an isolated Docker container against live canary infrastructure (RPC, matcher). Interactive commands (`init`, `new`) are driven through a pseudo-TTY, so the same Inquirer wizard a user sees is exercised step by step. Deploy steps always use `--dry-run` so no cACU is spent.

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

You can also run the scenarios on the host (CLI must be built and linked). Scenario workspaces go to `e2e/.work` (not `/workspace`):

```bash
npm run build && npm link
export $(grep -v '^#' e2e/.env | xargs)
npm run test:e2e:local
```

The interactive scenarios need `expect(1)` to drive the prompts.

## How interactive prompts are driven

Inquirer prompts read keypresses in raw mode and pause stdin between prompts, so answers can't be piped ahead of time — they must be sent one prompt at a time. `expect(1)` handles that synchronisation via `scripts/lib/init.exp` and `scripts/lib/new.exp` (wrapped by `run_init_interactive` / `run_new_interactive`). No production CLI flags are added to bypass prompts.

`acurast new` clones its templates over the network. To keep the picker deterministic and offline, `setup_template_repo` builds a throwaway local git repo with a single template and points `ACURAST_TEMPLATES_REPO` at it.

## Scenarios

| Script | Description |
|--------|-------------|
| `00-smoke` | `--version`, `--help` |
| `01-init-greenfield` | Interactive `acurast init` on a blank fixture |
| `02-init-existing-json` | `acurast init` when `acurast.json` already exists (no prompts) |
| `03-blank-project-build-deploy-dry-run` | Build canary fixture, `deploy --dry-run` |
| `04-estimate-fee` | `estimate-fee` using repo root `acurast.json` |
| `05-new-nodejs` | Interactive `acurast new` against a local template repo |
| `06-new-init-deploy` | Interactive `new` → interactive `init` → build → deploy dry-run |

## CLI flags used in e2e

| Flag | Purpose |
|------|---------|
| `deploy --dry-run` | Full deploy path without submitting on-chain |
| `deploy --non-interactive --output json` | Machine-readable deploy output |

## CI

GitHub Actions job `e2e` expects repository secret `ACURAST_E2E_MNEMONIC`. Fork PRs without the secret skip the job with a clear message.

## Troubleshooting

- **Balance is 0**: fund the address via the canary faucet; preflight fails early with a direct link.
- **Deploy dry-run exits early**: deploy needs a funded wallet; mainnet configs with a 0 balance bail before the dry-run path, so scenarios use canary.
- **`expect(1)` not found**: install `expect`; required for the interactive scenarios.
- **Network errors**: container needs outbound HTTPS/WSS to Acurast endpoints.
