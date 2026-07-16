// A minimal, session-only PrivateStateProvider for the browser demo. Real
// wallets/CLIs persist private state to disk (see
// @midnight-ntwrk/midnight-js-level-private-state-provider); this demo never
// needs that, since VeilVote's private state (a voter's secret key + Merkle
// path) is re-derived per demo voter on each connect, not something that
// needs to survive a page reload. Signing-key storage and export/import are
// out of scope for a Level 2 demo, so those throw rather than silently doing
// the wrong thing.
import type {
  ExportPrivateStatesOptions,
  ExportSigningKeysOptions,
  ImportPrivateStatesOptions,
  ImportPrivateStatesResult,
  ImportSigningKeysOptions,
  ImportSigningKeysResult,
  PrivateStateExport,
  PrivateStateId,
  PrivateStateProvider,
  SigningKeyExport,
} from "@midnight-ntwrk/midnight-js-types";
import type { ContractAddress, SigningKey } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";

const unsupported = (op: string) => async (): Promise<never> => {
  throw new Error(`${op} is not supported by the demo in-memory private state provider.`);
};

export class InMemoryPrivateStateProvider<PS = unknown> implements PrivateStateProvider<PrivateStateId, PS> {
  private readonly states = new Map<PrivateStateId, PS>();
  private readonly signingKeys = new Map<ContractAddress, SigningKey>();

  setContractAddress(_address: ContractAddress): void {
    // No per-contract scoping needed for this session-only demo store.
  }

  async set(privateStateId: PrivateStateId, state: PS): Promise<void> {
    this.states.set(privateStateId, state);
  }

  async get(privateStateId: PrivateStateId): Promise<PS | null> {
    return this.states.get(privateStateId) ?? null;
  }

  async remove(privateStateId: PrivateStateId): Promise<void> {
    this.states.delete(privateStateId);
  }

  async clear(): Promise<void> {
    this.states.clear();
  }

  async setSigningKey(address: ContractAddress, signingKey: SigningKey): Promise<void> {
    this.signingKeys.set(address, signingKey);
  }

  async getSigningKey(address: ContractAddress): Promise<SigningKey | null> {
    return this.signingKeys.get(address) ?? null;
  }

  async removeSigningKey(address: ContractAddress): Promise<void> {
    this.signingKeys.delete(address);
  }

  async clearSigningKeys(): Promise<void> {
    this.signingKeys.clear();
  }

  exportPrivateStates: (options?: ExportPrivateStatesOptions) => Promise<PrivateStateExport> =
    unsupported("exportPrivateStates");
  importPrivateStates: (
    exportData: PrivateStateExport,
    options?: ImportPrivateStatesOptions,
  ) => Promise<ImportPrivateStatesResult> = unsupported("importPrivateStates");
  exportSigningKeys: (options?: ExportSigningKeysOptions) => Promise<SigningKeyExport> =
    unsupported("exportSigningKeys");
  importSigningKeys: (
    exportData: SigningKeyExport,
    options?: ImportSigningKeysOptions,
  ) => Promise<ImportSigningKeysResult> = unsupported("importSigningKeys");
}
