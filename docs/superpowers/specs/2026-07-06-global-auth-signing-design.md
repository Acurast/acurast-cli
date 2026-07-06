# Global browser-wallet auth + signing-mode selection

Date: 2026-07-06
Branch: `feat/cli-playground`
Status: approved design

## Problem

The CLI-playground feature added browser-wallet remote signing (`login`,
`logout`, `whoami`, `RemoteSigner`), but:

1. `acurast init` never offers it — onboarding writes a local `ACURAST_MNEMONIC`
   to `.env` and steers every user to key-on-disk signing. Remote signing is
   undiscoverable.
2. Login state is stored per-project. `ACURAST_BASE_PATH` is `./.acurast`
   (cwd-relative, `src/constants.ts:8`), so `auth.json` lives inside each
   project. Logging in for one project does not carry to others.
3. No account switching. `authStore` keeps a single record under key `auth`;
   `setAuth` overwrites.
4. Signing mode is only written to the file log, never surfaced to the user, so
   there is no visible signal that a local mnemonic (private key on disk) is in
   use.

## Goals

- `init` asks how to sign, defaulting to browser wallet.
- Global logged-in state: log in once, every project without its own mnemonic
  uses it.
- A project can pin a specific account (override the global login).
- Account switching by re-login (single active account).
- Deploy visibly reports the signing mode, calling out local-mnemonic use.

## Non-goals (YAGNI)

Multi-account registry, `account use <addr>`, org/team accounts, migrating any
existing per-project `auth.json` (feature is unreleased on this branch).

## Storage layout

| Path | Scope | Contents |
|------|-------|----------|
| `~/.acurast/auth.json` | global (new) | single active account, mode `0600` |
| `./.acurast/auth.json` | project pin (optional) | account pinned for this dir |
| `./.acurast/deploy`, `keys.json`, … | per-project (unchanged) | deployments, ECDH keys |

- New constant `ACURAST_GLOBAL_BASE_PATH` = `<os.homedir()>/.acurast`.
- Existing `ACURAST_BASE_PATH` (`./.acurast`) is unchanged.
- `LocalStorage` gains an optional base-directory argument so one class serves
  both scopes:
  `new LocalStorage(fileName, mode?, basePath = ACURAST_BASE_PATH)`.
  The auth store passes the global path for global auth and the default (cwd)
  path for the project pin.

`AuthRecord` shape is unchanged (address, signatureType, network?, loggedInAt,
lastUsedAt?). It stores **no private key** — signing is delegated to the
browser wallet.

## Resolution order (`getSigningMode`)

Highest priority first:

1. `ACURAST_SIGNING_MODE` env = `local` | `remote` — explicit force.
2. project pin `./.acurast/auth.json` present → **remote** (that account).
3. `ACURAST_MNEMONIC` present → **local**.
4. global `~/.acurast/auth.json` present → **remote**.
5. none → **local** (falls through to the existing deploy-time error that tells
   the user to run `acurast login` or set `ACURAST_MNEMONIC`).

Rationale: an ambient global login must never silently change how an existing
mnemonic project signs (mnemonic wins over global login). A deliberate project
pin, however, does override a mnemonic.

## authStore refactor

```
getGlobalAuth(): AuthRecord | null      // ~/.acurast/auth.json
getProjectAuth(): AuthRecord | null     // ./.acurast/auth.json
getActiveAuth(): AuthRecord | null      // project ?? global
getLoggedInAddress(): string | undefined // getActiveAuth()?.address
isLoggedIn(): boolean

setAuth(record, scope: 'global' | 'project' = 'global')
clearAuth(scope: 'global' | 'project')  // plus an --all path in the command
touchAuth()                             // updates lastUsedAt on the active record's scope

getSigningMode(): 'local' | 'remote'    // implements the order above
getAuthSource(): 'project' | 'global' | 'mnemonic' | 'none'  // for whoami/deploy
```

Expiry (`SESSION_MAX_AGE_MS`, 14 days) applies per record, both scopes.

## Command surface

- `acurast login [--network <n>] [--project]`
  Default writes global auth. `--project` writes the project pin. Switching
  accounts = run `login` again (overwrites the active record in that scope).
- `acurast logout [--project] [--all]`
  Default clears global active. `--project` clears the pin. `--all` clears both.
- `acurast whoami`
  Prints active address, **source** (project pin / global / mnemonic / none),
  and signing mode.

## init prompt

New first question in `init` (default = browser wallet):

```
How do you want to sign deployments?
> Browser wallet — no private key stored (recommended)
  Local mnemonic — generate & store in .env
```

- **Browser wallet**: do not generate or write `ACURAST_MNEMONIC`; skip the
  mnemonic/faucet output. If already globally logged in, print that address.
  If not, offer to run the login flow now (opens the hub); otherwise instruct
  the user to run `acurast login`.
- **Local mnemonic**: exactly the current behavior (generate, write to `.env`,
  print address + faucet link).

## Deploy signing notice

Deploy currently logs `Signing mode: <mode>` only to the file logger
(`src/commands/deploy.ts:455`). Add a visible console line before signing:

- local: `Signing with local mnemonic (<address>) — private key is read from
  your environment.`
- remote: `Signing with your browser wallet (<address>).`

The local wording makes key-on-disk use explicit every deploy.

## Testing

- **authStore**: full precedence matrix (all 5 cases), global vs project scope,
  `getActiveAuth` override (project beats global), expiry, `getAuthSource`.
  In-memory `LocalStorage` mock keyed by base directory so global and project
  stores are independent.
- **init**: mode selection — browser path writes no `ACURAST_MNEMONIC`;
  mnemonic path unchanged. Mock the prompt and fs.
- **login / logout**: `--project` and `--all` flags write/clear the correct
  file/scope.
- **deploy notice**: asserts the correct console line per mode (unit-level on
  the notice helper, to avoid a full deploy round-trip).

## Affected files

- `src/constants.ts` — add `ACURAST_GLOBAL_BASE_PATH`.
- `src/util/LocalStorage.ts` — optional base-dir arg.
- `src/util/authStore.ts` — scopes, resolution order, `getAuthSource`.
- `src/commands/login.ts` — `--project` flag + scoped `setAuth`.
- `src/commands/logout.ts` — `--project` / `--all`.
- `src/commands/whoami.ts` — source + mode output.
- `src/commands/init.ts` — signing-mode prompt.
- `src/commands/deploy.ts` — visible signing notice.
- Tests under `test/`.
