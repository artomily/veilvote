// Headless CLI deploy for VeilVote, bypassing the browser wallet extension
// entirely. Modeled on the wallet-building pattern in Midnight's official
// example-counter CLI (github.com/midnightntwrk/example-counter), adapted to
// build a fresh (or seed-restored) wallet directly via @midnight-ntwrk/wallet-sdk-*
// instead of talking to Lace/1AM's injected browser API.
//
// This exists because the browser wallet extension can get stuck at
// "syncing..." forever on an idle Preprod chain (a known, still-unresolved
// wallet-SDK issue — see the Midnight forum thread "Wallet syncing 50% for
// 3 days now"). Running headless doesn't dodge that root cause since it uses
// the exact same isSynced/state() mechanism under the hood — but it does let
// us apply an explicit timeout, so a stuck sync fails loudly instead of
// hanging the terminal silently.
//
// Usage:
//   MIDNIGHT_PREPROD_SEED=<64 hex chars> npm run deploy:preprod
// Omit the seed to generate a fresh one — it's printed once so you can save
// it (and the funded address that comes with it) for next time.
import path from "node:path";
import { WebSocket } from "ws";
import * as Rx from "rxjs";
import * as ledger from "@midnight-ntwrk/ledger-v8";
import { unshieldedToken } from "@midnight-ntwrk/ledger-v8";
import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import type { MidnightProviders, UnboundTransaction } from "@midnight-ntwrk/midnight-js-types";
import * as CompiledContract from "@midnight-ntwrk/compact-js/effect/CompiledContract";
import { WalletFacade } from "@midnight-ntwrk/wallet-sdk-facade";
import { DustWallet } from "@midnight-ntwrk/wallet-sdk-dust-wallet";
import { HDWallet, Roles, generateRandomSeed } from "@midnight-ntwrk/wallet-sdk-hd";
import { ShieldedWallet } from "@midnight-ntwrk/wallet-sdk-shielded";
import {
  createKeystore,
  PublicKey,
  UnshieldedWallet,
  type UnshieldedKeystore,
} from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import { NoOpTransactionHistoryStorage } from "@midnight-ntwrk/wallet-sdk-abstractions";
import {
  MidnightBech32m,
  ShieldedAddress,
  ShieldedCoinPublicKey,
  ShieldedEncryptionPublicKey,
} from "@midnight-ntwrk/wallet-sdk-address-format";
import { Contract, type Ledger } from "../managed/contract/index.js";
import type { WitnessContext } from "@midnight-ntwrk/compact-runtime";
import type { VeilVotePrivateState } from "../frontend/src/midnight/types.js";
import { eligibilityRoot, demoVoterState } from "../frontend/src/eligibility.js";
import { InMemoryPrivateStateProvider } from "../frontend/src/midnight/in-memory-private-state-provider.js";

// GraphQL subscriptions (wallet sync) need a WebSocket global in Node.
// @ts-expect-error: assigning the Node 'ws' package over the WHATWG global
globalThis.WebSocket = WebSocket;

setNetworkId("preprod");

const CONFIG = {
  indexer: "https://indexer.preprod.midnight.network/api/v3/graphql",
  indexerWS: "wss://indexer.preprod.midnight.network/api/v3/graphql/ws",
  node: "https://rpc.preprod.midnight.network",
  proofServer: process.env.PROOF_SERVER_URL ?? "http://127.0.0.1:6300",
};

const SYNC_TIMEOUT_MS = 3 * 60_000;
const FUNDING_TIMEOUT_MS = 10 * 60_000;
const PRIVATE_STATE_ID = "veilVotePrivateState";
const managedDir = path.resolve(import.meta.dirname, "..", "managed");

const witnesses = {
  voterSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, VeilVotePrivateState>): [VeilVotePrivateState, Uint8Array] => [
    privateState,
    privateState.secretKey,
  ],
  merkleSiblings: ({
    privateState,
  }: WitnessContext<Ledger, VeilVotePrivateState>): [VeilVotePrivateState, Uint8Array[]] => [
    privateState,
    privateState.merkleSiblings,
  ],
  merklePathIndices: ({
    privateState,
  }: WitnessContext<Ledger, VeilVotePrivateState>): [VeilVotePrivateState, boolean[]] => [
    privateState,
    privateState.merklePathIndices,
  ],
};

// Node equivalent of frontend/src/midnight/contract.ts: same contract binding
// and witnesses, but pointed at the managed/ directory on disk instead of a
// browser-fetched URL.
const veilVoteCompiledContract = CompiledContract.make<Contract<VeilVotePrivateState>>(
  "VeilVote",
  Contract,
).pipe(CompiledContract.withWitnesses(witnesses), CompiledContract.withCompiledFileAssets(managedDir));

type VeilVoteCircuitId = "castVote";
type VeilVoteProviders = MidnightProviders<VeilVoteCircuitId, string, VeilVotePrivateState>;

interface WalletContext {
  wallet: WalletFacade;
  shieldedSecretKeys: ledger.ZswapSecretKeys;
  dustSecretKey: ledger.DustSecretKey;
  unshieldedKeystore: UnshieldedKeystore;
}

const formatBalance = (balance: bigint): string => balance.toLocaleString();

/** Animated console spinner while an async step runs. */
async function withStatus<T>(message: string, fn: () => Promise<T>): Promise<T> {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r  ${frames[i++ % frames.length]} ${message}`);
  }, 80);
  try {
    const result = await fn();
    clearInterval(interval);
    process.stdout.write(`\r  ✓ ${message}\n`);
    return result;
  } catch (e) {
    clearInterval(interval);
    process.stdout.write(`\r  ✗ ${message}\n`);
    throw e;
  }
}

/**
 * Wait for the wallet to report fully synced, or fail loudly after
 * SYNC_TIMEOUT_MS instead of hanging forever. On an idle Preprod chain the
 * dust sub-wallet can wait indefinitely for a chain tip that never arrives —
 * this timeout is the one thing headless mode buys you over the browser
 * extension's silent spinner.
 */
function waitForSync(wallet: WalletFacade) {
  return Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(5_000),
      Rx.filter((state) => state.isSynced),
      Rx.timeout({
        each: SYNC_TIMEOUT_MS,
        with: () =>
          Rx.throwError(
            () =>
              new Error(
                `Wallet did not report synced within ${SYNC_TIMEOUT_MS / 1000}s. This usually means Preprod ` +
                  "infra (indexer/node) is degraded right now, not a problem with this script — see the " +
                  "Midnight Discord #dev-chat or forum.midnight.network for current status.",
              ),
          ),
      }),
    ),
  );
}

function waitForFunds(wallet: WalletFacade): Promise<bigint> {
  return Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(10_000),
      Rx.filter((state) => state.isSynced),
      Rx.map((s) => s.unshielded.balances[unshieldedToken().raw] ?? 0n),
      Rx.filter((balance) => balance > 0n),
      Rx.timeout({
        each: FUNDING_TIMEOUT_MS,
        with: () =>
          Rx.throwError(
            () =>
              new Error(
                `No tNight arrived within ${FUNDING_TIMEOUT_MS / 1000}s. Fund the address printed above from ` +
                  "the Preprod faucet (https://midnight-tmnight-preprod.nethermind.dev/), then re-run this " +
                  "script with the same MIDNIGHT_PREPROD_SEED.",
              ),
          ),
      }),
    ),
  );
}

const buildShieldedConfig = () => ({
  networkId: "preprod",
  indexerClientConnection: { indexerHttpUrl: CONFIG.indexer, indexerWsUrl: CONFIG.indexerWS },
  provingServerUrl: new URL(CONFIG.proofServer),
  relayURL: new URL(CONFIG.node.replace(/^http/, "ws")),
});

const buildUnshieldedConfig = () => ({
  networkId: "preprod",
  indexerClientConnection: { indexerHttpUrl: CONFIG.indexer, indexerWsUrl: CONFIG.indexerWS },
  // A one-shot deploy script doesn't need persisted tx history.
  txHistoryStorage: new NoOpTransactionHistoryStorage(),
});

const buildDustConfig = () => ({
  networkId: "preprod",
  costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
  indexerClientConnection: { indexerHttpUrl: CONFIG.indexer, indexerWsUrl: CONFIG.indexerWS },
  provingServerUrl: new URL(CONFIG.proofServer),
  relayURL: new URL(CONFIG.node.replace(/^http/, "ws")),
});

function deriveKeysFromSeed(seed: string) {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, "hex"));
  if (hdWallet.type !== "seedOk") throw new Error("Failed to initialize HDWallet from seed");
  const derivation = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
  if (derivation.type !== "keysDerived") throw new Error("Failed to derive keys from seed");
  hdWallet.hdWallet.clear();
  return derivation.keys;
}

function printWalletSummary(state: any, unshieldedKeystore: UnshieldedKeystore) {
  const unshieldedBalance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
  const coinPubKey = ShieldedCoinPublicKey.fromHexString(state.shielded.coinPublicKey.toHexString());
  const encPubKey = ShieldedEncryptionPublicKey.fromHexString(state.shielded.encryptionPublicKey.toHexString());
  const shieldedAddress = MidnightBech32m.encode(
    "preprod",
    new ShieldedAddress(coinPubKey, encPubKey),
  ).toString();
  const DIV = "─".repeat(64);
  console.log(`
${DIV}
  Wallet Overview                            Network: preprod
${DIV}

  Shielded (ZSwap)
  └─ Address: ${shieldedAddress}

  Unshielded
  ├─ Address: ${unshieldedKeystore.getBech32Address()}
  └─ Balance: ${formatBalance(unshieldedBalance)} tNight

  Dust
  └─ Address: ${MidnightBech32m.encode("preprod", state.dust.address).toString()}
${DIV}`);
}

async function registerForDustGeneration(wallet: WalletFacade, unshieldedKeystore: UnshieldedKeystore): Promise<void> {
  const state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));

  if (state.dust.availableCoins.length > 0) {
    console.log(`  ✓ Dust tokens already available (${formatBalance(state.dust.balance(new Date()))} DUST)`);
    return;
  }

  const nightUtxos = state.unshielded.availableCoins.filter(
    (coin: any) => coin.meta?.registeredForDustGeneration !== true,
  );
  if (nightUtxos.length === 0) {
    await withStatus("Waiting for dust tokens to generate", () =>
      Rx.firstValueFrom(
        wallet.state().pipe(
          Rx.throttleTime(5_000),
          Rx.filter((s) => s.isSynced),
          Rx.filter((s) => s.dust.balance(new Date()) > 0n),
        ),
      ),
    );
    return;
  }

  await withStatus(`Registering ${nightUtxos.length} NIGHT UTXO(s) for dust generation`, async () => {
    const recipe = await wallet.registerNightUtxosForDustGeneration(
      nightUtxos,
      unshieldedKeystore.getPublicKey(),
      (payload: Uint8Array) => unshieldedKeystore.signData(payload),
    );
    const finalized = await wallet.finalizeRecipe(recipe);
    await wallet.submitTransaction(finalized);
  });

  await withStatus("Waiting for dust tokens to generate", () =>
    Rx.firstValueFrom(
      wallet.state().pipe(
        Rx.throttleTime(5_000),
        Rx.filter((s) => s.isSynced),
        Rx.filter((s) => s.dust.balance(new Date()) > 0n),
      ),
    ),
  );
}

async function buildWalletAndWaitForFunds(seed: string): Promise<WalletContext> {
  console.log("");

  const { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore } = await withStatus(
    "Building wallet",
    async () => {
      const keys = deriveKeysFromSeed(seed);
      const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
      const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
      const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], "preprod" as any);

      const walletConfig = { ...buildShieldedConfig(), ...buildUnshieldedConfig(), ...buildDustConfig() };
      const wallet = await WalletFacade.init({
        configuration: walletConfig,
        shielded: (cfg: any) => ShieldedWallet(cfg).startWithSecretKeys(shieldedSecretKeys),
        unshielded: (cfg: any) => UnshieldedWallet(cfg).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
        dust: (cfg: any) =>
          DustWallet(cfg).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust),
      });
      await wallet.start(shieldedSecretKeys, dustSecretKey);
      return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
    },
  );

  const DIV = "─".repeat(64);
  console.log(`
${DIV}
  Unshielded Address (send tNight here):
  ${unshieldedKeystore.getBech32Address()}

  Fund via the Preprod faucet if you haven't already:
  https://midnight-tmnight-preprod.nethermind.dev/
${DIV}
`);

  const syncedState = await withStatus("Syncing with network (up to 3 min before failing loudly)", () =>
    waitForSync(wallet),
  );
  printWalletSummary(syncedState, unshieldedKeystore);

  const balance = syncedState.unshielded.balances[unshieldedToken().raw] ?? 0n;
  if (balance === 0n) {
    const funded = await withStatus("Waiting for incoming tNight (up to 10 min)", () => waitForFunds(wallet));
    console.log(`    Balance: ${formatBalance(funded)} tNight\n`);
  }

  await registerForDustGeneration(wallet, unshieldedKeystore);
  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
}

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

async function createWalletAndMidnightProvider(ctx: WalletContext) {
  // buildWalletAndWaitForFunds already awaited a synced state before this is
  // called, so a fresh synced snapshot here resolves immediately.
  const state = await Rx.firstValueFrom(ctx.wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  return {
    getCoinPublicKey() {
      return state.shielded.coinPublicKey.toHexString();
    },
    getEncryptionPublicKey() {
      return state.shielded.encryptionPublicKey.toHexString();
    },
    async balanceTx(tx: UnboundTransaction, ttl?: Date) {
      const recipe = await ctx.wallet.balanceUnboundTransaction(
        tx as any,
        { shieldedSecretKeys: ctx.shieldedSecretKeys, dustSecretKey: ctx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      return ctx.wallet.finalizeRecipe(recipe) as any;
    },
    async submitTx(tx: any) {
      return ctx.wallet.submitTransaction(tx) as any;
    },
  };
}

async function main() {
  const seedArg = process.env.MIDNIGHT_PREPROD_SEED;
  const seed = seedArg ?? toHex(Buffer.from(generateRandomSeed()));
  if (!seedArg) {
    const DIV = "─".repeat(64);
    console.log(`
${DIV}
  New Wallet Seed — save this in .env as MIDNIGHT_PREPROD_SEED
  before running this script again, it will NOT be shown again
${DIV}
  ${seed}
${DIV}
`);
  }

  const ctx = await buildWalletAndWaitForFunds(seed);
  const walletAndMidnightProvider = await createWalletAndMidnightProvider(ctx);

  const zkConfigProvider = new NodeZkConfigProvider<VeilVoteCircuitId>(managedDir);
  const providers: VeilVoteProviders = {
    privateStateProvider: new InMemoryPrivateStateProvider<VeilVotePrivateState>(),
    publicDataProvider: indexerPublicDataProvider(CONFIG.indexer, CONFIG.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(CONFIG.proofServer, zkConfigProvider),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider,
  } as VeilVoteProviders;

  const proposalId = crypto.getRandomValues(new Uint8Array(32));
  const voterIndex = Number(process.env.DEPLOYER_VOTER_INDEX ?? "0");
  const initialPrivateState = demoVoterState(voterIndex);

  const deployed = await withStatus("Deploying VeilVote proposal contract", () =>
    deployContract(providers, {
      compiledContract: veilVoteCompiledContract,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState,
      args: [proposalId, eligibilityRoot()],
    }),
  );

  const address = deployed.deployTxData.public.contractAddress;
  const DIV = "─".repeat(64);
  console.log(`
${DIV}
  Deployed! Contract address (Preprod):

  ${address}

  Paste this into the "Contract Address" table in README.md.
${DIV}
`);

  process.exit(0);
}

main().catch((e) => {
  console.error("\nDeploy failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
