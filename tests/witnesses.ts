// Private state + witness implementations for the VeilVote contract.
//
// The hidden state a voter needs is (a) their secret identity key and (b) the
// sibling hashes / path directions proving that key's leaf belongs to the
// eligibility Merkle tree. None of this ever reaches the ledger — it's only
// used locally to satisfy the `assert` inside `castVote`.

import type { WitnessContext } from "@midnight-ntwrk/compact-runtime";
import type { Ledger } from "../managed/contract/index.js";

export type VeilVotePrivateState = {
  readonly secretKey: Uint8Array;
  readonly merkleSiblings: Uint8Array[];
  readonly merklePathIndices: boolean[];
};

export const createVeilVotePrivateState = (
  secretKey: Uint8Array,
  merkleSiblings: Uint8Array[],
  merklePathIndices: boolean[],
): VeilVotePrivateState => ({ secretKey, merkleSiblings, merklePathIndices });

// Each witness maps to a function returning `[newPrivateState, returnValue]`.
// None of these mutate private state; they just expose it to the circuit.
export const witnesses = {
  voterSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, VeilVotePrivateState>): [
    VeilVotePrivateState,
    Uint8Array,
  ] => [privateState, privateState.secretKey],

  merkleSiblings: ({
    privateState,
  }: WitnessContext<Ledger, VeilVotePrivateState>): [
    VeilVotePrivateState,
    Uint8Array[],
  ] => [privateState, privateState.merkleSiblings],

  merklePathIndices: ({
    privateState,
  }: WitnessContext<Ledger, VeilVotePrivateState>): [
    VeilVotePrivateState,
    boolean[],
  ] => [privateState, privateState.merklePathIndices],
};
