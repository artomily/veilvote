# VeilVote

> A privacy-preserving DAO voting contract on Midnight: anonymous, eligibility-checked ballots with cryptographic double-vote protection.

## Contract Address

| Network  | Address                              |
|----------|--------------------------------------|
| Preview  | _[PASTE ADDRESS AFTER DEPLOY]_       |
| Preprod  | _[PASTE ADDRESS AFTER DEPLOY]_       |

> Not yet deployed on-chain. Deploying requires a running Docker proof server and a
> faucet-funded wallet — see [Deploying to a network](#deploying-to-a-network). The
> contract **compiles** (`managed/` is generated) and **all tests pass** locally today.

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

## Tech Stack

- **Midnight** network (Preview / Preprod testnets)
- **Compact** smart-contract language — `pragma language_version 0.23`, compiler `0.31.1`
- **`@midnight-ntwrk/compact-runtime`** `0.16.0` (contract runtime + test simulator)
- **Node.js v22**, **Docker** (proof server), **Vitest** (tests)

## Prerequisites

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
- **Docker** — required only to deploy (runs the proof server). Install
  [Docker Desktop](https://docs.docker.com/desktop/) and start it.

## Setup

```bash
git clone <this-repo> veilvote
cd veilvote
nvm use 22
npm install
npm run compact      # compiles contracts/counter.compact -> managed/
```

`npm run compact` regenerates the `managed/` directory (circuits, proving/verifier keys,
and the TypeScript contract API).

## Run Tests

```bash
npm test             # vitest run — exercises the compiled circuits via the simulator
# or, compile first then test:
npm run test:compile
```

The suite ([`tests/counter.test.ts`](tests/counter.test.ts), 6 tests) covers: circuit logic
(tallies move correctly), **eligibility / Sybil resistance** (a non-member key is rejected
even with a forged path), state transitions (multiple eligible members + double-vote
rejection), **cross-proposal unlinkability** (the same member's nullifier differs across
two proposals), and privacy (the secret key and Merkle path never reach public state).
[`tests/merkle.ts`](tests/merkle.ts) builds the eligibility tree off-chain using the
contract's own compiled `pureCircuits`, so tests hash exactly the way the circuit does.

## Deploying to a network

Deploy is **not** run automatically (it needs Docker + a funded wallet). Once ready:

```bash
# 1. Start the proof server (in a separate terminal)
docker pull midnightnetwork/proof-server
docker run -p 6300:6300 midnightnetwork/proof-server

# 2. Deploy (Node needs extra heap for proof generation)
nvm use 22
NODE_OPTIONS="--max-old-space-size=12288" npm run deploy -- --network preview
```

Stop when the **wallet address** prints, fund it at the **Preview faucet**, then let the
deploy finish. Paste the resulting **contract address** into the table at the top of this
file.

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
├── src/                        # frontend (Level 2)
├── .github/workflows/          # CI/CD (Level 3)
└── README.md
```

## Initial Idea

_[LEAVE PLACEHOLDER — fill this in manually.]_

## Screenshots

_[LEAVE PLACEHOLDER — add `compact compile` output and the deployed contract address.]_
