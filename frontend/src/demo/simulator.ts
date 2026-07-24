// In-browser twin of ../../../tests/veilvote-simulator.ts — runs the same
// *compiled* circuits (Merkle eligibility check, tallies, nullifier set,
// asserts) through compact-runtime's in-memory context, so the offline demo
// exercises exactly the same contract logic a real deployment would, with no
// wallet, proof server, or network involved.
import {
  type CircuitContext,
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
} from "../../../shared/compact-runtime.js";
import { Contract, type Ledger, ledger } from "../../../managed/contract/index.js";
import type { VeilVotePrivateState } from "../midnight/types.js";

const witnesses = {
  voterSecretKey: ({
    privateState,
  }: {
    privateState: VeilVotePrivateState;
  }): [VeilVotePrivateState, Uint8Array] => [privateState, privateState.secretKey],
  merkleSiblings: ({
    privateState,
  }: {
    privateState: VeilVotePrivateState;
  }): [VeilVotePrivateState, Uint8Array[]] => [privateState, privateState.merkleSiblings],
  merklePathIndices: ({
    privateState,
  }: {
    privateState: VeilVotePrivateState;
  }): [VeilVotePrivateState, boolean[]] => [privateState, privateState.merklePathIndices],
};

export class DemoSimulator {
  readonly contract: Contract<VeilVotePrivateState>;
  private circuitContext: CircuitContext<VeilVotePrivateState>;

  constructor(privateState: VeilVotePrivateState, proposalId: Uint8Array, eligibleRoot: Uint8Array) {
    this.contract = new Contract<VeilVotePrivateState>(witnesses);
    const { currentPrivateState, currentContractState, currentZswapLocalState } =
      this.contract.initialState(
        createConstructorContext(privateState, "0".repeat(64)),
        proposalId,
        eligibleRoot,
      );
    this.circuitContext = createCircuitContext(
      sampleContractAddress(),
      currentZswapLocalState,
      currentContractState,
      currentPrivateState,
    );
  }

  switchVoter(privateState: VeilVotePrivateState): void {
    this.circuitContext.currentPrivateState = privateState;
  }

  getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  /** Cast a vote as the current voter. Throws the contract's own assertion message on rejection. */
  castVote(voteYes: boolean): Ledger {
    this.circuitContext = this.contract.impureCircuits.castVote(this.circuitContext, voteYes).context;
    return this.getLedger();
  }
}
