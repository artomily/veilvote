import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  voterSecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  merkleSiblings(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array[]];
  merklePathIndices(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, boolean[]];
}

export type ImpureCircuits<PS> = {
  castVote(context: __compactRuntime.CircuitContext<PS>, voteYes_0: boolean): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  castVote(context: __compactRuntime.CircuitContext<PS>, voteYes_0: boolean): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  leafHash(sk_0: Uint8Array): Uint8Array;
  hashLevel(isRight_0: boolean, current_0: Uint8Array, sibling_0: Uint8Array): Uint8Array;
  computeRoot(sk_0: Uint8Array, siblings_0: Uint8Array[], indices_0: boolean[]): Uint8Array;
  deriveNullifier(propId_0: Uint8Array, sk_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  leafHash(context: __compactRuntime.CircuitContext<PS>, sk_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  hashLevel(context: __compactRuntime.CircuitContext<PS>,
            isRight_0: boolean,
            current_0: Uint8Array,
            sibling_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  computeRoot(context: __compactRuntime.CircuitContext<PS>,
              sk_0: Uint8Array,
              siblings_0: Uint8Array[],
              indices_0: boolean[]): __compactRuntime.CircuitResults<PS, Uint8Array>;
  deriveNullifier(context: __compactRuntime.CircuitContext<PS>,
                  propId_0: Uint8Array,
                  sk_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  castVote(context: __compactRuntime.CircuitContext<PS>, voteYes_0: boolean): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly proposalId: Uint8Array;
  readonly eligibleRoot: Uint8Array;
  readonly yesVotes: bigint;
  readonly noVotes: bigint;
  nullifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               initialProposalId_0: Uint8Array,
               initialEligibleRoot_0: Uint8Array): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
