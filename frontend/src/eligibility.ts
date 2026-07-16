// Builds the same 16-leaf eligibility Merkle tree the contract checks against,
// using the contract's own compiled `pureCircuits` so hashing can never drift
// from what the circuit does. See ../../tests/merkle.ts for the test-side
// twin of this file.
//
// For the hackathon demo, membership is a fixed list of passphrases baked
// into the app (DEMO_VOTERS below) rather than a real DAO member directory —
// that onboarding flow is out of scope for Level 2. Whoever deploys a
// proposal from this frontend uses `eligibilityRoot()` as the contract's
// `initialEligibleRoot`, so these are exactly the members who can vote on it.
import { pureCircuits } from "../../managed/contract/index.js";

const TREE_DEPTH = 4;
const TREE_SIZE = 1 << TREE_DEPTH; // 16

export type MerkleProof = {
  readonly siblings: Uint8Array[];
  readonly indices: boolean[];
};

export type DemoVoterState = {
  readonly secretKey: Uint8Array;
  readonly merkleSiblings: Uint8Array[];
  readonly merklePathIndices: boolean[];
};

// Demo-only passphrases. In a real deployment each DAO member would generate
// and keep their own secret key private; here they're fixed so a judge can
// pick "Demo Voter 1..4" and immediately have a valid membership proof.
const DEMO_PASSPHRASES = [
  "veilvote-demo-voter-1",
  "veilvote-demo-voter-2",
  "veilvote-demo-voter-3",
  "veilvote-demo-voter-4",
];

const textEncoder = new TextEncoder();

// Derive a 32-byte secret key from a passphrase via the contract's own
// domain-separated hash, so it's a valid Bytes<32> witness value.
function secretKeyFromPassphrase(passphrase: string): Uint8Array {
  const bytes = new Uint8Array(32);
  const encoded = textEncoder.encode(passphrase).slice(0, 32);
  bytes.set(encoded);
  return pureCircuits.leafHash(bytes);
}

// Deterministic filler keys for the unused tree slots — nobody "knows" these
// as a passphrase, so they can't be used to forge membership.
function fillerKey(index: number): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.fill(0xaa);
  bytes[0] = index;
  bytes[31] = 0xff;
  return bytes;
}

const memberKeys: Uint8Array[] = Array.from({ length: TREE_SIZE }, (_, i) =>
  i < DEMO_PASSPHRASES.length
    ? secretKeyFromPassphrase(DEMO_PASSPHRASES[i])
    : fillerKey(i),
);

class EligibilityTree {
  private readonly levels: Uint8Array[][];

  constructor(keys: Uint8Array[]) {
    const leaves = keys.map((sk) => pureCircuits.leafHash(sk));
    const levels: Uint8Array[][] = [leaves];
    let current = leaves;
    for (let depth = 0; depth < TREE_DEPTH; depth++) {
      const next: Uint8Array[] = [];
      for (let j = 0; j < current.length / 2; j++) {
        next.push(pureCircuits.hashLevel(false, current[2 * j], current[2 * j + 1]));
      }
      levels.push(next);
      current = next;
    }
    this.levels = levels;
  }

  get root(): Uint8Array {
    return this.levels[TREE_DEPTH][0];
  }

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

const tree = new EligibilityTree(memberKeys);

/** The public Merkle root to pass as a new proposal's `initialEligibleRoot`. */
export function eligibilityRoot(): Uint8Array {
  return tree.root;
}

export const demoVoterLabels = DEMO_PASSPHRASES.map((_, i) => `Demo Voter ${i + 1}`);

/** The private state (secret key + Merkle path) for a demo voter by index. */
export function demoVoterState(index: number): DemoVoterState {
  const proof = tree.proofFor(index);
  return {
    secretKey: memberKeys[index],
    merkleSiblings: proof.siblings,
    merklePathIndices: proof.indices,
  };
}
