# Product Proposal

**Chosen idea (from the provided list): Private Voting — anonymous ballots with publicly
verifiable tallies.**

## What is the product, and who uses it?

VeilVote is a private ballot box for small, membership-based organizations — DAOs,
co-operatives, working groups, grant committees — where *who is allowed to vote* is
known and fixed, but *how each member voted* must stay secret.

The organization publishes a proposal as a deployed contract, committing to its member
list as a Merkle root. Each member votes from their own browser: their wallet proves, in
zero knowledge, that they are one of the committed members and that they have not already
voted, then moves the public tally without ever revealing which member they are.

Two groups use it:

- **Members** — cast a ballot without their vote being traceable back to them, so they can
  vote against a proposal a founder or large delegate is championing without social or
  professional retaliation.
- **Anyone (the organization, its community, an outside observer)** — audits the result.
  The tally, the member-set commitment, and the number of ballots cast are all public and
  independently verifiable, so a private vote does not mean an untrustworthy one.

The problem it solves: on a transparent chain, token- or address-based voting makes every
ballot permanently attributable. That produces well-documented distortions — members vote
with the visible majority, abstain on contentious items, or are pressured after the fact.
Off-chain private polls (Google Forms, Snapshot with hidden results) fix the privacy but
give up verifiability: you must trust whoever counted. VeilVote refuses that trade-off.

## Why Midnight specifically?

The product needs two properties *simultaneously*, and a transparent chain can only give
one at a time:

1. **The tally must be publicly verifiable.** Anyone can recompute it from on-chain state.
2. **The link between a member and their ballot must not exist anywhere** — not on-chain,
   not in a server's database, not with an administrator.

On a transparent chain, any vote transaction is signed by an address, so the link is
published by construction. The usual workarounds each fail somewhere: mixers and fresh
addresses leak through funding and timing; a trusted tallier can be subpoenaed, breached,
or simply lie; commit–reveal still discloses every ballot at reveal time.

Midnight gives what this product actually needs:

- **Witnesses are private by construction.** The voter's secret key and Merkle path are
  `witness` values that stay on their machine. The compiler *refuses to let them reach
  public state* unless explicitly wrapped in `disclose(...)`, so privacy is enforced by
  the type system rather than by developer discipline.
- **Selective disclosure is explicit and auditable.** VeilVote has exactly three
  `disclose(...)` calls — the recomputed Merkle root (only to compare against the public
  root), the nullifier, and the ballot direction. Anyone reading the contract can see the
  complete list of what becomes public; there is no fourth hidden leak.
- **ZK proofs let eligibility be checked without identity.** A voter proves "my secret key
  hashes into a leaf on a path to this public root" without revealing which leaf. The
  chain verifies membership while learning nothing about *which* member.
- **Public ledger state coexists with private inputs in one contract.** The tallies,
  member-set commitment, and nullifier set live in ordinary public ledger state and are
  verifiable by anyone — in the same contract whose inputs are private.
- **Nullifiers give Sybil resistance without identity.** A one-way hash bound to both the
  secret key and the proposal id makes a second ballot from the same member fail, while
  the same member's nullifier on a *different* proposal is unlinkable to this one.

Concretely: proving eligibility without revealing the member, and preventing double-votes
without an identity register, is the thing a transparent chain cannot do at all — not just
does less well.

## Data Model

| Data Point | Type | Disclosed To |
|------------|------|--------------|
| `proposalId` — which proposal this contract is for | Public ledger | Everyone |
| `eligibleRoot` — Merkle root committing to the member set | Public ledger | Everyone |
| `yesVotes` / `noVotes` — running tallies | Public ledger | Everyone |
| `nullifiers` — set of spent nullifier hashes | Public ledger | Everyone |
| Number of ballots cast (= size of nullifier set) | Public ledger | Everyone |
| Ballot direction of a single vote (yes/no) | Disclosed on `castVote`, by design | Everyone — but not linked to a voter |
| `voterSecretKey()` — the member's identity key | Private witness | No one |
| `merkleSiblings()` — sibling hashes on the member's path | Private witness | No one |
| `merklePathIndices()` — left/right directions on that path | Private witness | No one |
| Which member cast a given ballot | Never computed on-chain | No one |
| A member's position in the eligibility tree | Never computed on-chain | No one |
| Whether a specific named member voted at all | Not derivable from public state | No one |

**Honest scope note.** VeilVote hides voter *identity*, not the *direction of each ballot*:
an observer sees which tally moved, just not by whom. Hiding interim results as well would
require encrypted ballots opened by a trustee at close, which this contract deliberately
does not attempt. This is documented in the contract source and the README rather than
glossed over.

## Mainnet Feasibility

**Realistic to reach Mainnet by Level 6 — but only with the scope tightened, not widened.**

Already working today: the contract compiles, deploys, and runs end-to-end on Preprod
through a browser wallet; six tests exercise the compiled circuits; CI compiles and tests
on every push. The cryptography is not the risk.

The real gaps between here and Mainnet are product gaps, and they are bounded:

1. **Membership scale.** The eligibility tree is fixed at depth 4 (16 members) — sized for
   a demo. Real use needs a deeper tree and a proof cost that stays acceptable as depth
   grows. This is the single most important change and should be measured, not assumed.
2. **Member onboarding.** There is currently no product flow for a DAO to collect member
   key commitments and publish a root. A private vote is only as trustworthy as the member
   set it commits to, so this needs to be transparent and auditable.
3. **Key custody.** A member who loses their secret key loses their vote, and a member who
   shares it can have their vote cast by someone else. Deriving the voting key from the
   wallet, rather than storing a loose secret, is the likely answer.
4. **Proving UX.** Proof generation must be reliable and legible on ordinary hardware, with
   honest progress feedback — the current build already prefers wallet-delegated proving.
5. **Mainnet operational readiness.** Real fees, an audit of the circuit's disclosure
   surface, and a documented plan for what happens if a proposal contract is deployed with
   a wrong root.

A credible path is to keep the product deliberately small — one proposal per contract, a
fixed member set committed at deploy, no ballot-direction privacy — and make that narrow
version genuinely dependable, rather than adding trustee-based encrypted ballots or
delegation before the basics are proven. On that scope, Mainnet by Level 6 is achievable.

The most likely reason to *miss* it is not the contract but the surrounding wallet and
infrastructure maturity: this project already hit a multi-day Preprod wallet-sync bug that
had to be worked around by switching networks (documented in the README). That class of
upstream instability, not the ZK logic, is the schedule risk worth naming honestly.
