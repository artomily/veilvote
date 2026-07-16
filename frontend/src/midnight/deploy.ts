// Deploys a new VeilVote proposal contract, or joins one already deployed at
// a known address. Both run entirely from the browser via the connected
// wallet — no separate CLI deploy step is required.
import { deployContract, findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import type { ContractAddress } from "@midnight-ntwrk/compact-runtime";
import { veilVoteCompiledContract } from "./contract.js";
import type { VeilVoteProviders } from "./providers.js";
import type { VeilVotePrivateState } from "./types.js";

const PRIVATE_STATE_ID = "veilVotePrivateState";

export async function deployProposal(
  providers: VeilVoteProviders,
  proposalId: Uint8Array,
  eligibleRoot: Uint8Array,
  initialPrivateState: VeilVotePrivateState,
) {
  return deployContract(providers, {
    compiledContract: veilVoteCompiledContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState,
    args: [proposalId, eligibleRoot],
  });
}

export async function joinProposal(
  providers: VeilVoteProviders,
  contractAddress: ContractAddress,
  initialPrivateState: VeilVotePrivateState,
) {
  return findDeployedContract(providers, {
    contractAddress,
    compiledContract: veilVoteCompiledContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState,
  });
}

export { PRIVATE_STATE_ID };
