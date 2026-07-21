# VeilVote

> A privacy-preserving DAO voting contract on Midnight: anonymous, eligibility-checked ballots with cryptographic double-vote protection.

## Live Demo

_[PASTE LIVE URL AFTER DEPLOYING THE FRONTEND — see "Deploying the frontend" below]_

## Contract Address

| Network  | Address                          |
|----------|----------------------------------|
| Preprod  | _[PASTE ADDRESS AFTER DEPLOY]_   |

> **Not yet deployed — blocked by a confirmed upstream Midnight/Preprod issue, not
> incomplete work.** Everything that doesn't require a live network is done and verified:
> the contract **compiles**, **all 6 tests pass**, and the frontend **builds with no
> errors** (`npm run build` in `frontend/`, confirmed against the compiled contract).
>
> Deployment itself has been attempted repeatedly via both the browser wallet (Lace/1AM)
> and a [headless CLI path](#deploying-without-the-browser-wallet) built specifically to
> rule out browser-extension flakiness. Both hit the same root cause: wallet sync against
> Preprod never completes. Concretely, under `scripts/deploy-cli.ts`'s per-sub-wallet
> progress logging, the `unshielded` sync throws an internal `Wallet.Sync` error (from
> `@midnight-ntwrk/wallet-sdk-unshielded-wallet`) partway through, after which sync either
> stalls permanently (Node 22) or the retry loop grows memory unbounded until the process
> OOMs (Node 24) — reproduced independently on two Node majors. This matches a broader,
> still-open pattern of Preprod wallet-sync issues reported on the [Midnight
> forum](https://forum.midnight.network/t/wallet-syncing-50-for-3-days-now/742).
>
> Once Preprod stabilizes (or a fix lands) and a deploy succeeds — via either path — paste
> the resulting contract address here.

### Deploying without the browser wallet

The browser wallet extension (Lace/1AM) can get stuck at "syncing..." indefinitely on an
idle Preprod chain — a known, still-unresolved issue in the wallet SDK, not something
specific to this app (see the Midnight forum thread ["Wallet syncing 50% for 3 days
now"](https://forum.midnight.network/t/wallet-syncing-50-for-3-days-now/742)). If you hit
that, `scripts/deploy-cli.ts` deploys headlessly from a seed phrase instead, the same way
Midnight's own [example-counter](https://github.com/midnightntwrk/example-counter) CLI
does — no browser extension involved.

```bash
# needs a local proof server (see below), same as the browser flow
docker run -p 6300:6300 midnightnetwork/proof-server

MIDNIGHT_PREPROD_SEED=<64 hex chars> npm run deploy:preprod
# omit the seed to generate a fresh one — it's printed once, save it
```

This still needs a funded Preprod wallet (fund the printed address from the
[faucet](https://midnight-tmnight-preprod.nethermind.dev/), same two-step tNight → tDUST
process as [Prerequisites](#prerequisites)) and it uses the *same* underlying sync
mechanism as the browser wallet, so it isn't a guaranteed fix for Preprod infra being
degraded — but it fails with a clear timeout error after a few minutes instead of hanging
the terminal silently, and gives you real log output instead of an opaque UI spinner.

## What This Does

VeilVote runs a **DAO yes/no proposal vote** with a fixed, known set of eligible members.
Each deployed contract instance is one proposal: it's constructed with a `proposalId` and
an `eligibleRoot` — a Merkle root committing to every member's secret-key commitment,
built off-chain from the DAO's member list. To vote, a member proves in zero-knowledge
that their secret key belongs to that tree, without revealing *which* member they are, and
publishes only a one-way **nullifier** (bound to both their key and this proposal) so a
second vote from the same member on the same proposal is rejected. A key with no path
into the tree — i.e. not a real member — is rejected outright: **membership can't be
forged, and non-members can't vote.**

## Privacy Model

- **PUBLIC (on-chain, visible to anyone):**
  - `proposalId` — which proposal this contract instance is for.
  - `eligibleRoot` — the Merkle root committing to the eligible member set.
  - `yesVotes` / `noVotes` — the running tallies (`Counter`).
  - `nullifiers` — the set of used nullifier hashes (`Set<Bytes<32>>`).
  - The **direction** of each individual ballot (which tally moved) is inherently public.
- **PRIVATE (witnesses — never leave the voter's machine, never on-chain):**
  - `voterSecretKey()` — the voter's secret identity key.
  - `merkleSiblings()` / `merklePathIndices()` — the private Merkle path proving that key
    is a leaf in `eligibleRoot`, without revealing its position.
- **What the voter PROVES without revealing it:**
  - "I am one of the members committed to by `eligibleRoot`, **and** I have not voted on
    this proposal before" — proven by (a) recomputing the Merkle root from a private path
    and checking it equals the public root, and (b) publishing only
    `persistentHash("veilvote:nullifier:" ‖ proposalId ‖ secretKey)`. Voter **identity and
    membership position** stay hidden; a member voting on a *different* proposal produces
    an unlinkable nullifier.

**Eligibility / Sybil resistance:** membership is fixed at deploy time — an attacker cannot
mint new eligible voters, because their key has no path to the published root.

**Scope of privacy:** VeilVote hides voter identity and membership position. The direction
of each individual ballot is inherently public — an observer sees which tally moves — so
`castVote` discloses that boolean on purpose. Hiding *interim results* (not just per-ballot
identity) would require encrypted ballots opened by a trustee at close; that's a natural
next step, not part of this contract.

The three deliberate `disclose(...)` calls in [`contracts/counter.compact`](contracts/counter.compact)
are the only points where private data becomes public: the recomputed Merkle root (used
only for comparison), the nullifier hash, and the vote direction. The secret key and
Merkle path are never disclosed — everything else is private by default, enforced by the
Compact compiler.

## Privacy Claim

**What an on-chain observer sees:** which contract instance (proposal) a transaction
called, that *some* eligible member cast a ballot, which way that ballot went (yes/no —
the running tally), and an opaque 32-byte nullifier that prevents that same member voting
again on this proposal.

**What an on-chain observer cannot see, ever:** which member voted (their secret key and
Merkle path are never transmitted or disclosed — only proven, in zero-knowledge, to
satisfy the membership check), their position in the member list, or any link between a
member's votes across two different proposals (nullifiers are proposal-bound, so the same
member's ballots on different proposals are cryptographically unlinkable).

## Tech Stack

- **Midnight** network (Preprod testnet)
- **Compact** smart-contract language — `pragma language_version 0.23`, compiler `0.31.1`
- **Midnight.js SDK** — `midnight-js-contracts`, `-fetch-zk-config-provider`,
  `-http-client-proof-provider`, `-indexer-public-data-provider`, `-network-id`,
  `-types`, `-utils` (all `4.1.1`), plus `@midnight-ntwrk/compact-js` `2.5.1` and
  `@midnight-ntwrk/dapp-connector-api` `4.0.1`
- **React + Vite** frontend (`frontend/`), **Lace wallet** for wallet connection and
  proving
- **Node.js v22**, **Vitest** (contract tests)

## Prerequisites

- **Lace wallet** installed in your browser, connected to **Preprod**, with some tDUST
  from the [Preprod faucet](https://docs.midnight.network/develop/tutorial/using/faucet).
- **Node.js v22** (the Midnight toolchain is pinned to v22; newer majors can break builds).
  Recommended via [nvm](https://github.com/nvm-sh/nvm): `nvm install 22 && nvm use 22`.
- **Compact toolchain** — install the devtools, then the compiler:
  ```bash
  curl --proto '=https' --tlsv1.2 -LsSf \
    https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
  # restart your shell (adds ~/.local/bin to PATH), then:
  compact update          # installs the latest compiler (0.31.x)
  compact --version
  ```

### Proving: no Docker required (usually)

VeilVote's frontend prefers **wallet-delegated proving**: it fetches the compiled
circuit's ZK artifacts itself (over HTTP, from wherever the frontend is hosted) and hands
them to the wallet via `connectedAPI.getProvingProvider(...)`, so the *wallet* generates
the proof. If your installed Lace version doesn't yet support that, the app falls back to
the older model, which needs a **local proof server on `localhost:6300`**:
```bash
docker run -p 6300:6300 midnightnetwork/proof-server
```
and your wallet's proof-server setting pointed at it. Either way, proving always happens
on the machine running the wallet — this codebase never sends your private inputs
anywhere to be proven.

## Run Locally

```bash
git clone <this-repo> veilvote
cd veilvote
nvm use 22
npm install
npm run compact          # compiles contracts/counter.compact -> managed/

cd frontend
npm install
cp .env.example .env     # set VITE_CONTRACT_ADDRESS once you've deployed (optional)
npm run dev              # http://localhost:5173
```

`npm run compact` (from the repo root) regenerates `managed/` (circuits, proving/verifier
keys, the TypeScript contract API) — run it again any time you edit the `.compact` file.
`frontend`'s `dev`/`build` scripts copy `managed/keys` and `managed/zkir` into
`frontend/public/` automatically, so the ZK artifacts ship with the app.

## Run Tests

```bash
npm test             # vitest run — exercises the compiled circuits via the simulator
# or, compile first then test:
npm run test:compile

npm run typecheck                  # type-checks tests/ and scripts/
cd frontend && npm run typecheck   # frontend type-checks against the compiled contract
```

The contract suite ([`tests/counter.test.ts`](tests/counter.test.ts), 6 tests) covers:
circuit logic (tallies move correctly), **eligibility / Sybil resistance** (a non-member
key is rejected even with a forged path), state transitions (multiple eligible members +
double-vote rejection), **cross-proposal unlinkability** (the same member's nullifier
differs across two proposals), and privacy (the secret key and Merkle path never reach
public state). [`tests/merkle.ts`](tests/merkle.ts) builds the eligibility tree off-chain
using the contract's own compiled `pureCircuits`, so tests hash exactly the way the
circuit does.

## Deploying the frontend

`vercel.json` (or `netlify.toml`) at the repo root builds the `frontend/` app while
keeping `managed/` (one level up) in the build context — **don't** set the platform's
"Root Directory" to `frontend`, or the build loses access to the compiled contract.

```bash
# Vercel
npm i -g vercel
vercel login
vercel --prod        # run from the repo root

# Netlify
npm i -g netlify-cli
netlify login
netlify deploy --prod   # run from the repo root
```

Set `VITE_NETWORK_ID=preprod` and, once you've deployed a proposal contract,
`VITE_CONTRACT_ADDRESS=<address>` as environment variables on the hosting platform (or
leave `VITE_CONTRACT_ADDRESS` unset and use the in-app "Deploy a new proposal" /
"Join" flow instead). Paste the resulting live URL into **Live Demo** above.

## Project Structure

```
veilvote/
├── contracts/counter.compact   # the VeilVote Compact contract
├── managed/                    # generated by `npm run compact` (circuits + keys)
├── tests/                      # simulator + Vitest suite
│   ├── witnesses.ts            # private state + witness implementations
│   ├── merkle.ts                # off-chain eligibility Merkle tree builder
│   ├── veilvote-simulator.ts   # in-memory test harness
│   └── counter.test.ts         # the tests
├── scripts/deploy-cli.ts       # headless Preprod deploy (bypasses the browser wallet)
├── frontend/                   # React + Vite DApp UI (Level 2)
│   ├── src/
│   │   ├── components/
│   │   │   ├── WalletConnect.tsx   # connect/disconnect + address display
│   │   │   └── CircuitCall.tsx     # cast-vote button, proof/result UI
│   │   ├── hooks/useMidnight.ts    # wallet + providers + deploy/join/vote
│   │   ├── midnight/                # providers, compiled-contract binding, deploy/join
│   │   ├── eligibility.ts           # demo eligibility Merkle tree
│   │   └── App.tsx
│   ├── vite.config.ts
│   └── vercel.json-friendly build (see repo-root vercel.json)
├── .github/workflows/          # CI/CD (Level 3)
├── vercel.json / netlify.toml  # frontend deploy config
└── README.md
```

## Initial Idea

_[LEAVE PLACEHOLDER — fill this in manually.]_

## Screenshots

_[LEAVE PLACEHOLDER — add `compact compile` output and the deployed contract address.]_

## Demo Video

_[PLACEHOLDER — add the link after recording. See the demo checklist provided alongside this README for what to capture.]_
