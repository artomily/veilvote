// The private state a voter's browser session holds locally: their secret
// identity key and the Merkle path proving it belongs to the eligibility
// tree. None of this is ever sent to the contract directly — only derived,
// disclosed values (the nullifier, the vote direction) are.
export type VeilVotePrivateState = {
  readonly secretKey: Uint8Array;
  readonly merkleSiblings: Uint8Array[];
  readonly merklePathIndices: boolean[];
};
