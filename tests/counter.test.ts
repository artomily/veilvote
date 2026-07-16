// VeilVote contract unit tests.
//
// These run the *compiled* circuits through the in-memory simulator, so they
// exercise the real ledger logic (Merkle eligibility check, tallies, nullifier
// set, asserts) exactly as they would on-chain, but without a proof server.

import { describe, it, expect } from "vitest";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { VeilVoteSimulator } from "./veilvote-simulator.js";
import { EligibilityTree, TREE_SIZE } from "./merkle.js";
import { createVeilVotePrivateState, type VeilVotePrivateState } from "./witnesses.js";

setNetworkId("undeployed");

// Deterministic, distinct 32-byte secret keys for repeatable tests.
const key = (seed: number): Uint8Array => {
  const k = new Uint8Array(32);
  k.fill(seed & 0xff);
  k[0] = seed & 0xff;
  k[31] = (seed >> 8) & 0xff;
  return k;
};

const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

const proposalId = (seed: number): Uint8Array => key(1000 + seed);

// A 16-member DAO allowlist. Seeds 0 and 1 are our two named test voters;
// seeds 2..15 are other members whose keys nobody in the test knows (they
// simply need to exist so the tree has a realistic, full membership set).
const memberKeys = Array.from({ length: TREE_SIZE }, (_, i) => key(i));
const tree = new EligibilityTree(memberKeys);

const privateStateFor = (memberIndex: number): VeilVotePrivateState => {
  const proof = tree.proofFor(memberIndex);
  return createVeilVotePrivateState(
    memberKeys[memberIndex],
    proof.siblings,
    proof.indices,
  );
};

const nullifierSet = (sim: VeilVoteSimulator): Uint8Array[] => [
  ...sim.getLedger().nullifiers,
];

describe("VeilVote — private, eligibility-checked DAO voting", () => {
  it("starts with the constructed proposal id, eligibility root, and empty tallies", () => {
    const propId = proposalId(1);
    const sim = new VeilVoteSimulator(privateStateFor(0), propId, tree.root);
    const l = sim.getLedger();
    expect(bytesEqual(l.proposalId, propId)).toBe(true);
    expect(bytesEqual(l.eligibleRoot, tree.root)).toBe(true);
    expect(l.yesVotes).toEqual(0n);
    expect(l.noVotes).toEqual(0n);
    expect(l.nullifiers.isEmpty()).toBe(true);
  });

  // (1) Circuit logic: a yes-vote and a no-vote move the correct tally.
  it("increments the yes tally on a yes-vote and the no tally on a no-vote", () => {
    const yes = new VeilVoteSimulator(privateStateFor(0), proposalId(2), tree.root);
    const afterYes = yes.castVote(true);
    expect(afterYes.yesVotes).toEqual(1n);
    expect(afterYes.noVotes).toEqual(0n);

    const no = new VeilVoteSimulator(privateStateFor(1), proposalId(2), tree.root);
    const afterNo = no.castVote(false);
    expect(afterNo.yesVotes).toEqual(0n);
    expect(afterNo.noVotes).toEqual(1n);
  });

  // (2) Eligibility / Sybil resistance: a key with no path in the tree is rejected.
  it("rejects a voter whose secret key is not in the eligibility set", () => {
    const outsiderKey = key(999);
    // An attacker who isn't a member has no real path — they can only guess,
    // e.g. reusing a real member's path with a different key.
    const forgedState = createVeilVotePrivateState(
      outsiderKey,
      tree.proofFor(0).siblings,
      tree.proofFor(0).indices,
    );
    const sim = new VeilVoteSimulator(forgedState, proposalId(3), tree.root);
    expect(() => sim.castVote(true)).toThrow(
      "Not an eligible member of this vote",
    );
    // The rejected attempt must not move any public state.
    const l = sim.getLedger();
    expect(l.yesVotes).toEqual(0n);
    expect(l.nullifiers.isEmpty()).toBe(true);
  });

  // (3) State transitions + anti-double-vote across multiple eligible members.
  it("accepts distinct eligible members and rejects a second vote from the same member", () => {
    const propId = proposalId(4);
    const sim = new VeilVoteSimulator(privateStateFor(0), propId, tree.root);

    // Member 0 votes yes.
    let l = sim.castVote(true);
    expect(l.yesVotes).toEqual(1n);
    expect(l.nullifiers.size()).toEqual(1n);

    // Member 1 (a different eligible member) votes no.
    sim.switchVoter(privateStateFor(1));
    l = sim.castVote(false);
    expect(l.yesVotes).toEqual(1n);
    expect(l.noVotes).toEqual(1n);
    expect(l.nullifiers.size()).toEqual(2n);

    // Member 0 tries to vote again -> rejected by the nullifier check.
    sim.switchVoter(privateStateFor(0));
    expect(() => sim.castVote(false)).toThrow(
      "This member has already voted on this proposal",
    );

    // Tallies and set are unchanged after the rejected attempt.
    const after = sim.getLedger();
    expect(after.yesVotes).toEqual(1n);
    expect(after.noVotes).toEqual(1n);
    expect(after.nullifiers.size()).toEqual(2n);
  });

  // (4) Cross-proposal unlinkability: the same member on two proposals
  // produces two different nullifiers, so their votes can't be correlated.
  it("derives unlinkable nullifiers for the same member across two different proposals", () => {
    const propA = proposalId(5);
    const propB = proposalId(6);

    const simA = new VeilVoteSimulator(privateStateFor(2), propA, tree.root);
    const lA = simA.castVote(true);

    const simB = new VeilVoteSimulator(privateStateFor(2), propB, tree.root);
    const lB = simB.castVote(true);

    const nullifierA = [...lA.nullifiers][0];
    const nullifierB = [...lB.nullifiers][0];
    expect(bytesEqual(nullifierA, nullifierB)).toBe(false);

    // Sanity: both match the pure-circuit prediction for their own proposal.
    expect(bytesEqual(nullifierA, VeilVoteSimulator.nullifierFor(propA, memberKeys[2]))).toBe(true);
    expect(bytesEqual(nullifierB, VeilVoteSimulator.nullifierFor(propB, memberKeys[2]))).toBe(true);
  });

  // (5) Privacy: the secret key and Merkle path never reach public state.
  it("never exposes the secret key or Merkle path on-chain — only the nullifier", () => {
    const secret = memberKeys[3];
    const sim = new VeilVoteSimulator(privateStateFor(3), proposalId(7), tree.root);
    sim.castVote(true);

    const stored = nullifierSet(sim);
    expect(stored.length).toBe(1);

    const expectedNullifier = VeilVoteSimulator.nullifierFor(proposalId(7), secret);
    expect(stored.some((n) => bytesEqual(n, expectedNullifier))).toBe(true);
    expect(stored.some((n) => bytesEqual(n, secret))).toBe(false);

    // The raw secret bytes and every sibling hash on the path must appear
    // nowhere in the serialized public ledger.
    const publicDump = JSON.stringify(sim.getLedger(), (_k, v) =>
      v instanceof Uint8Array ? Array.from(v) : typeof v === "bigint" ? v.toString() : v,
    );
    expect(publicDump.includes(Array.from(secret).join(","))).toBe(false);
    for (const sibling of tree.proofFor(3).siblings) {
      expect(publicDump.includes(Array.from(sibling).join(","))).toBe(false);
    }

    // The private state still holds the secret key + path locally, untouched.
    expect(bytesEqual(sim.getPrivateState().secretKey, secret)).toBe(true);
  });
});
