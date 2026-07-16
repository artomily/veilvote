// Builds the off-chain eligibility Merkle tree that `eligibleRoot` commits to,
// using the contract's own compiled `pureCircuits` — so the tree is built with
// exactly the same hash function the circuit checks against, never a
// reimplementation that could quietly drift out of sync.

import { pureCircuits } from "../managed/contract/index.js";

export const TREE_DEPTH = 4;
export const TREE_SIZE = 1 << TREE_DEPTH; // 16 members

export type MerkleProof = {
  readonly siblings: Uint8Array[];
  readonly indices: boolean[];
};

export class EligibilityTree {
  private readonly levels: Uint8Array[][];

  constructor(memberSecretKeys: Uint8Array[]) {
    if (memberSecretKeys.length !== TREE_SIZE) {
      throw new Error(
        `EligibilityTree requires exactly ${TREE_SIZE} member keys, got ${memberSecretKeys.length}`,
      );
    }
    const leaves = memberSecretKeys.map((sk) => pureCircuits.leafHash(sk));
    const levels: Uint8Array[][] = [leaves];
    let current = leaves;
    for (let depth = 0; depth < TREE_DEPTH; depth++) {
      const next: Uint8Array[] = [];
      for (let j = 0; j < current.length / 2; j++) {
        // isRight=false combines a (left, right) pair in canonical order,
        // independent of which side a later proof walks up through.
        next.push(pureCircuits.hashLevel(false, current[2 * j], current[2 * j + 1]));
      }
      levels.push(next);
      current = next;
    }
    this.levels = levels; // levels[0] = leaves, levels[TREE_DEPTH] = [root]
  }

  get root(): Uint8Array {
    return this.levels[TREE_DEPTH][0];
  }

  /** The sibling path + left/right directions for the member at `index`. */
  proofFor(index: number): MerkleProof {
    const siblings: Uint8Array[] = [];
    const indices: boolean[] = [];
    let pos = index;
    for (let depth = 0; depth < TREE_DEPTH; depth++) {
      const level = this.levels[depth];
      const isRightChild = (pos & 1) === 1;
      const siblingPos = isRightChild ? pos - 1 : pos + 1;
      siblings.push(level[siblingPos]);
      indices.push(isRightChild);
      pos = pos >> 1;
    }
    return { siblings, indices };
  }
}
