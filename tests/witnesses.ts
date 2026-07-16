// Private state + witness implementations for the VeilVote contract.
//
// The only hidden state a voter needs is their secret identity key. It lives
// here, in memory on the voter's machine, and is exposed to the contract solely
// through the `voterSecretKey` witness — it is never written to the ledger.

import type { WitnessContext } from "@midnight-ntwrk/compact-runtime";
import type { Ledger } from "../managed/contract/index.js";

export type VeilVotePrivateState = {
  readonly secretKey: Uint8Array;
};

export const createVeilVotePrivateState = (
  secretKey: Uint8Array,
): VeilVotePrivateState => ({ secretKey });

// Each witness maps to a function returning `[newPrivateState, returnValue]`.
// `voterSecretKey` returns the secret key unchanged and leaves state untouched.
export const witnesses = {
  voterSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, VeilVotePrivateState>): [
    VeilVotePrivateState,
    Uint8Array,
  ] => [privateState, privateState.secretKey],
};
