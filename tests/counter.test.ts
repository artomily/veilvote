// VeilVote contract unit tests.
//
// These run the *compiled* circuits through the in-memory simulator, so they
// exercise the real ledger logic (tallies, nullifier set, asserts) exactly as
// they would on-chain, but without a proof server.

import { describe, it, expect } from "vitest";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { VeilVoteSimulator } from "./veilvote-simulator.js";

setNetworkId("undeployed");

// Deterministic, distinct 32-byte secret keys for repeatable tests.
const key = (seed: number): Uint8Array => {
  const k = new Uint8Array(32);
  k.fill(seed & 0xff);
  k[0] = seed & 0xff;
  k[31] = (seed >> 8) & 0xff;
  return k;
};

// Byte-equality helper for comparing Bytes<32> values.
const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

const nullifierSet = (sim: VeilVoteSimulator): Uint8Array[] => [
  ...sim.getLedger().nullifiers,
];

describe("VeilVote — private voting contract", () => {
  it("starts with empty tallies and an empty nullifier set", () => {
    const sim = new VeilVoteSimulator(key(1));
    const l = sim.getLedger();
    expect(l.yesVotes).toEqual(0n);
    expect(l.noVotes).toEqual(0n);
    expect(l.nullifiers.isEmpty()).toBe(true);
    expect(l.nullifiers.size()).toEqual(0n);
  });

  // (1) Circuit logic: a yes-vote and a no-vote move the correct tally.
  it("increments the yes tally on a yes-vote and the no tally on a no-vote", () => {
    const yes = new VeilVoteSimulator(key(10));
    const afterYes = yes.castVote(true);
    expect(afterYes.yesVotes).toEqual(1n);
    expect(afterYes.noVotes).toEqual(0n);

    const no = new VeilVoteSimulator(key(11));
    const afterNo = no.castVote(false);
    expect(afterNo.yesVotes).toEqual(0n);
    expect(afterNo.noVotes).toEqual(1n);
  });

  // (2) State transitions + anti-double-vote across multiple voters.
  it("accepts distinct voters and rejects a second vote from the same voter", () => {
    const sim = new VeilVoteSimulator(key(20));

    // Voter A votes yes.
    let l = sim.castVote(true);
    expect(l.yesVotes).toEqual(1n);
    expect(l.nullifiers.size()).toEqual(1n);

    // Voter B (a different secret key) votes no.
    sim.switchVoter(key(21));
    l = sim.castVote(false);
    expect(l.yesVotes).toEqual(1n);
    expect(l.noVotes).toEqual(1n);
    expect(l.nullifiers.size()).toEqual(2n);

    // Voter A tries to vote again -> rejected by the nullifier check.
    sim.switchVoter(key(20));
    expect(() => sim.castVote(false)).toThrow(
      "This voter has already cast a vote",
    );

    // Tallies and set are unchanged after the rejected attempt.
    const after = sim.getLedger();
    expect(after.yesVotes).toEqual(1n);
    expect(after.noVotes).toEqual(1n);
    expect(after.nullifiers.size()).toEqual(2n);
  });

  // (3) Privacy: the secret key never reaches public state.
  it("never exposes the secret key on-chain — only its one-way nullifier", () => {
    const secret = key(30);
    const sim = new VeilVoteSimulator(secret);
    sim.castVote(true);

    const stored = nullifierSet(sim);
    expect(stored.length).toBe(1);

    // The public set contains the derived nullifier, NOT the secret key.
    const expected = VeilVoteSimulator.nullifierFor(secret);
    expect(stored.some((n) => bytesEqual(n, expected))).toBe(true);
    expect(stored.some((n) => bytesEqual(n, secret))).toBe(false);

    // The raw secret bytes appear nowhere in the serialized public ledger.
    const publicDump = JSON.stringify(sim.getLedger(), (_k, v) =>
      v instanceof Uint8Array ? Array.from(v) : typeof v === "bigint" ? v.toString() : v,
    );
    expect(publicDump.includes(Array.from(secret).join(","))).toBe(false);

    // The private state still holds the secret key locally, untouched.
    expect(bytesEqual(sim.getPrivateState().secretKey, secret)).toBe(true);
  });

  // (3b) Different secret keys produce different public nullifiers (unlinkable).
  it("derives a distinct nullifier for each distinct secret key", () => {
    const nA = VeilVoteSimulator.nullifierFor(key(40));
    const nB = VeilVoteSimulator.nullifierFor(key(41));
    expect(bytesEqual(nA, nB)).toBe(false);
  });
});
