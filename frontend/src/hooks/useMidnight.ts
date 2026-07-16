import { useCallback, useEffect, useRef, useState } from "react";
import type { ConnectedAPI, InitialAPI } from "@midnight-ntwrk/dapp-connector-api";
import type { ContractAddress } from "@midnight-ntwrk/compact-runtime";
import { findWallet, friendlyError, buildProviders, type VeilVoteProviders } from "../midnight/providers.js";
import { deployProposal, joinProposal } from "../midnight/deploy.js";
import { ledger, type Ledger } from "../../../managed/contract/index.js";
import { demoVoterLabels, demoVoterState, eligibilityRoot } from "../eligibility.js";

const NETWORK_ID = (import.meta.env.VITE_NETWORK_ID as string) ?? "preprod";
const DEFAULT_CONTRACT = (import.meta.env.VITE_CONTRACT_ADDRESS as string) ?? "";

export type WalletState = "detecting" | "no-wallet" | "ready" | "connecting" | "connected";

type FoundVeilVoteContract = Awaited<ReturnType<typeof joinProposal>>;

export function useMidnight() {
  const [walletState, setWalletState] = useState<WalletState>("detecting");
  const [walletAPI, setWalletAPI] = useState<InitialAPI | undefined>();
  const [connectedAPI, setConnectedAPI] = useState<ConnectedAPI | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [contractAddress, setContractAddress] = useState<string>(DEFAULT_CONTRACT);
  const [ledgerState, setLedgerState] = useState<Ledger | null>(null);
  const [voterIndex, setVoterIndex] = useState(0);

  const [busy, setBusy] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ txId: string } | null>(null);

  const providersRef = useRef<VeilVoteProviders | null>(null);
  const contractRef = useRef<FoundVeilVoteContract | null>(null);

  // Poll for the wallet extension for up to 5s.
  useEffect(() => {
    const found = findWallet();
    if (found) {
      setWalletAPI(found);
      setWalletState("ready");
      return;
    }
    let elapsed = 0;
    const t = setInterval(() => {
      elapsed += 100;
      const w = findWallet();
      if (w) {
        setWalletAPI(w);
        setWalletState("ready");
        clearInterval(t);
      } else if (elapsed >= 5_000) {
        setWalletState("no-wallet");
        clearInterval(t);
      }
    }, 100);
    return () => clearInterval(t);
  }, []);

  const connect = useCallback(async () => {
    if (!walletAPI) return;
    setWalletState("connecting");
    setError(null);
    try {
      const api = await walletAPI.connect(NETWORK_ID);
      const { unshieldedAddress } = await api.getUnshieldedAddress();
      setConnectedAPI(api);
      setAddress(unshieldedAddress);
      setWalletState("connected");
      providersRef.current = await buildProviders(api);
    } catch (e) {
      setError(friendlyError(e));
      setWalletState("ready");
    }
  }, [walletAPI]);

  const disconnect = useCallback(() => {
    setConnectedAPI(null);
    setAddress(null);
    setWalletState("ready");
    providersRef.current = null;
    contractRef.current = null;
    setContractAddress(DEFAULT_CONTRACT);
    setLedgerState(null);
    setLastResult(null);
  }, []);

  const refreshLedger = useCallback(async () => {
    const providers = providersRef.current;
    if (!providers || !contractAddress) return;
    const state = await providers.publicDataProvider.queryContractState(contractAddress);
    if (state) setLedgerState(ledger(state.data));
  }, [contractAddress]);

  useEffect(() => {
    if (walletState === "connected" && contractAddress) {
      void refreshLedger();
    }
  }, [walletState, contractAddress, refreshLedger]);

  const deploy = useCallback(async () => {
    if (!providersRef.current) return;
    setBusy("Deploying proposal contract...");
    setError(null);
    try {
      const proposalId = crypto.getRandomValues(new Uint8Array(32));
      const privateState = demoVoterState(voterIndex);
      const deployed = await deployProposal(
        providersRef.current,
        proposalId,
        eligibilityRoot(),
        privateState,
      );
      contractRef.current = deployed;
      setContractAddress(deployed.deployTxData.public.contractAddress);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }, [voterIndex]);

  const join = useCallback(
    async (addr: ContractAddress) => {
      if (!providersRef.current) return;
      setBusy("Joining contract...");
      setError(null);
      try {
        const privateState = demoVoterState(voterIndex);
        const found = await joinProposal(providersRef.current, addr, privateState);
        contractRef.current = found;
        setContractAddress(addr);
      } catch (e) {
        setError(friendlyError(e));
      } finally {
        setBusy(null);
      }
    },
    [voterIndex],
  );

  const castVote = useCallback(
    async (voteYes: boolean) => {
      const providers = providersRef.current;
      if (!providers || !contractAddress) return;
      setBusy("Generating proof & submitting...");
      setError(null);
      setLastResult(null);
      try {
        // Make sure the contract handle reflects the currently-selected demo
        // voter's identity before proving — switching voters updates their
        // private state (secret key + Merkle path), never anything public.
        if (!contractRef.current) {
          contractRef.current = await joinProposal(
            providers,
            contractAddress,
            demoVoterState(voterIndex),
          );
        } else {
          await providers.privateStateProvider.set(
            "veilVotePrivateState",
            demoVoterState(voterIndex),
          );
        }
        const result = await contractRef.current.callTx.castVote(voteYes);
        setLastResult({ txId: result.public.txId });
        await refreshLedger();
      } catch (e) {
        setError(friendlyError(e));
      } finally {
        setBusy(null);
      }
    },
    [contractAddress, voterIndex, refreshLedger],
  );

  return {
    walletState,
    address,
    error,
    setError,
    connect,
    disconnect,
    contractAddress,
    setContractAddress,
    ledgerState,
    refreshLedger,
    deploy,
    join,
    castVote,
    busy,
    lastResult,
    voterIndex,
    setVoterIndex,
    demoVoterLabels,
  };
}
