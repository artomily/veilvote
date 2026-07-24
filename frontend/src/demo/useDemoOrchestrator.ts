// Drives a scripted, offline run of the full VeilVote flow — deploy a
// proposal, several eligible members cast votes, then two rejections that
// demonstrate the contract's guarantees (no double-voting, no non-member
// voting) — entirely in-browser via DemoSimulator. No wallet, indexer, or
// proof server involved, so this always works for a live demo regardless of
// testnet health.
import { useCallback, useMemo, useRef, useState } from "react";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import { pureCircuits, type Ledger } from "../../../managed/contract/index.js";
import { demoVoterLabels, demoVoterState, eligibilityRoot } from "../eligibility.js";
import { DemoSimulator } from "./simulator.js";
import type { VeilVotePrivateState } from "../midnight/types.js";

export type StepKind = "deploy" | "vote" | "reject";
export type StepStatus = "pending" | "active" | "success" | "rejected";

export type DemoStep = {
  readonly id: string;
  readonly kind: StepKind;
  readonly actor: string;
  readonly title: string;
  readonly description: string;
  status: StepStatus;
  detail?: string;
};

export type LogEntry = {
  readonly id: string;
  readonly kind: "info" | "success" | "error";
  readonly message: string;
};

// A key nobody's passphrase derives — has no leaf in the eligibility tree.
function outsiderKey(): Uint8Array {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes;
}

const PROVING_DELAY_MS = 700;

function buildSteps(): DemoStep[] {
  return [
    {
      id: "deploy",
      kind: "deploy",
      actor: "Proposer",
      title: "Deploy proposal contract",
      description: "Constructs the contract with a fresh proposalId and the eligibility Merkle root.",
      status: "pending",
    },
    {
      id: "vote-0",
      kind: "vote",
      actor: demoVoterLabels[0],
      title: `${demoVoterLabels[0]} votes YES`,
      description: "Proves membership in zero knowledge and publishes a nullifier.",
      status: "pending",
    },
    {
      id: "vote-1",
      kind: "vote",
      actor: demoVoterLabels[1],
      title: `${demoVoterLabels[1]} votes NO`,
      description: "A different eligible member — unlinkable to the first ballot.",
      status: "pending",
    },
    {
      id: "vote-2",
      kind: "vote",
      actor: demoVoterLabels[2],
      title: `${demoVoterLabels[2]} votes YES`,
      description: "A third eligible member casts their ballot.",
      status: "pending",
    },
    {
      id: "reject-double-vote",
      kind: "reject",
      actor: demoVoterLabels[0],
      title: `${demoVoterLabels[0]} tries to vote again`,
      description: "Same secret key -> same nullifier -> rejected by the contract.",
      status: "pending",
    },
    {
      id: "reject-outsider",
      kind: "reject",
      actor: "Outsider",
      title: "An outsider tries to vote",
      description: "Random key, no path into the eligibility tree -> rejected.",
      status: "pending",
    },
  ];
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const shortHex = (bytes: Uint8Array) => `0x${toHex(bytes).slice(0, 12)}…`;

export function useDemoOrchestrator() {
  const [steps, setSteps] = useState<DemoStep[]>(buildSteps);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [ledgerState, setLedgerState] = useState<Ledger | null>(null);
  const [proposalId, setProposalId] = useState<Uint8Array | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const simRef = useRef<DemoSimulator | null>(null);
  const logIdRef = useRef(0);

  const appendLog = useCallback((kind: LogEntry["kind"], message: string) => {
    logIdRef.current += 1;
    setLog((prev) => [...prev, { id: `log-${logIdRef.current}`, kind, message }]);
  }, []);

  const setStepStatus = useCallback((id: string, status: StepStatus, detail?: string) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status, detail } : s)));
  }, []);

  const reset = useCallback(() => {
    setSteps(buildSteps());
    setLog([]);
    setLedgerState(null);
    setProposalId(null);
    setRunning(false);
    setDone(false);
    simRef.current = null;
  }, []);

  const run = useCallback(async () => {
    if (running) return;
    reset();
    setRunning(true);

    const propId = crypto.getRandomValues(new Uint8Array(32));
    setProposalId(propId);
    const root = eligibilityRoot();

    // Step: deploy
    setStepStatus("deploy", "active");
    appendLog("info", `Deploying proposal ${shortHex(propId)} with eligibility root ${shortHex(root)}…`);
    await delay(PROVING_DELAY_MS);
    const sim = new DemoSimulator(demoVoterState(0), propId, root);
    simRef.current = sim;
    setLedgerState(sim.getLedger());
    setStepStatus("deploy", "success", "Contract deployed");
    appendLog("success", "Proposal contract deployed.");

    const castAs = async (voterIndex: number, voteYes: boolean, stepId: string) => {
      setStepStatus(stepId, "active");
      appendLog(
        "info",
        `${demoVoterLabels[voterIndex]} is generating a zero-knowledge membership proof…`,
      );
      await delay(PROVING_DELAY_MS);
      sim.switchVoter(demoVoterState(voterIndex));
      try {
        const ledgerAfter = sim.castVote(voteYes);
        setLedgerState(ledgerAfter);
        const nullifier = pureCircuits.deriveNullifier(propId, demoVoterState(voterIndex).secretKey);
        setStepStatus(stepId, "success", `Nullifier ${shortHex(nullifier)}`);
        appendLog(
          "success",
          `${demoVoterLabels[voterIndex]} voted ${voteYes ? "YES" : "NO"} — nullifier ${shortHex(nullifier)} recorded. Identity stayed private.`,
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setStepStatus(stepId, "rejected", message);
        appendLog("error", `Rejected: ${message}`);
      }
    };

    await castAs(0, true, "vote-0");
    await castAs(1, false, "vote-1");
    await castAs(2, true, "vote-2");

    // Step: double vote, expected rejection
    setStepStatus("reject-double-vote", "active");
    appendLog("info", `${demoVoterLabels[0]} attempts a second ballot on the same proposal…`);
    await delay(PROVING_DELAY_MS);
    sim.switchVoter(demoVoterState(0));
    try {
      sim.castVote(false);
      setStepStatus("reject-double-vote", "success", "Unexpectedly accepted");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setStepStatus("reject-double-vote", "rejected", message);
      appendLog("error", `Rejected: ${message}`);
    }
    setLedgerState(sim.getLedger());

    // Step: outsider, expected rejection
    setStepStatus("reject-outsider", "active");
    appendLog("info", "An outsider (no real membership path) attempts to vote…");
    await delay(PROVING_DELAY_MS);
    const forged: VeilVotePrivateState = {
      secretKey: outsiderKey(),
      merkleSiblings: demoVoterState(0).merkleSiblings,
      merklePathIndices: demoVoterState(0).merklePathIndices,
    };
    sim.switchVoter(forged);
    try {
      sim.castVote(true);
      setStepStatus("reject-outsider", "success", "Unexpectedly accepted");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setStepStatus("reject-outsider", "rejected", message);
      appendLog("error", `Rejected: ${message}`);
    }
    setLedgerState(sim.getLedger());

    setRunning(false);
    setDone(true);
  }, [running, reset, setStepStatus, appendLog]);

  const proposalIdHex = useMemo(() => (proposalId ? shortHex(proposalId) : null), [proposalId]);

  return { steps, log, ledgerState, proposalIdHex, running, done, run, reset };
}
