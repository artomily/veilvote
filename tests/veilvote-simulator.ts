// A lightweight in-memory test harness that runs the compiled VeilVote circuits
// without a proof server or a live network, so unit tests stay fast and offline.

import {
  type CircuitContext,
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  type Ledger,
  ledger,
  pureCircuits,
} from "../managed/contract/index.js";
import {
  type VeilVotePrivateState,
  witnesses,
} from "./witnesses.js";

export class VeilVoteSimulator {
  readonly contract: Contract<VeilVotePrivateState>;
  circuitContext: CircuitContext<VeilVotePrivateState>;

  constructor(secretKey: Uint8Array) {
    this.contract = new Contract<VeilVotePrivateState>(witnesses);
    const { currentPrivateState, currentContractState, currentZswapLocalState } =
      this.contract.initialState(
        createConstructorContext({ secretKey }, "0".repeat(64)),
      );
    this.circuitContext = createCircuitContext(
      sampleContractAddress(),
      currentZswapLocalState,
      currentContractState,
      currentPrivateState,
    );
  }

  /** Impersonate a different voter (a distinct secret key) on the same board. */
  public switchVoter(secretKey: Uint8Array): void {
    this.circuitContext.currentPrivateState = { secretKey };
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public getPrivateState(): VeilVotePrivateState {
    return this.circuitContext.currentPrivateState;
  }

  /** Cast a vote as the current voter; returns the updated public ledger. */
  public castVote(voteYes: boolean): Ledger {
    this.circuitContext = this.contract.impureCircuits.castVote(
      this.circuitContext,
      voteYes,
    ).context;
    return this.getLedger();
  }

  /** The public nullifier that would be produced by a given secret key. */
  public static nullifierFor(secretKey: Uint8Array): Uint8Array {
    return pureCircuits.deriveNullifier(secretKey);
  }
}
