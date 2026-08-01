import Tally from "../components/Tally.js";
import { useDemoOrchestrator, type StepStatus } from "./useDemoOrchestrator.js";

const STATUS_ICON: Record<StepStatus, string> = {
  pending: "○",
  active: "◐",
  success: "✓",
  rejected: "✗",
};

// Screen-reader text for each marker — the glyphs above are decorative.
const STATUS_LABEL: Record<StepStatus, string> = {
  pending: "Pending",
  active: "In progress",
  success: "Succeeded",
  rejected: "Rejected by the contract",
};

export default function DemoFlow() {
  const { steps, log, ledgerState, proposalIdHex, running, done, run, reset } = useDemoOrchestrator();
  const settled = steps.filter((s) => s.status === "success" || s.status === "rejected").length;

  return (
    <div className="demo-flow">
      <div className="demo-flow__intro">
        <p>
          Runs the full VeilVote flow — deploy, three members voting privately, then two
          rejections that prove the contract's guarantees — entirely in your browser. No
          wallet, testnet, or proof server involved: this simulates the exact compiled
          circuit the real contract runs.
        </p>
        <div className="demo-flow__controls">
          <button className="btn-primary" onClick={run} disabled={running}>
            {running ? "Running…" : done ? "Run again" : "Run demo"}
          </button>
          {(done || log.length > 0) && !running && (
            <button className="btn-ghost" onClick={reset}>
              Reset
            </button>
          )}
          {(running || settled > 0) && (
            <span className="demo-flow__progress">
              {settled} / {steps.length} steps
            </span>
          )}
        </div>
        {proposalIdHex && (
          <p className="demo-flow__proposal">
            Proposal <code>{proposalIdHex}</code>
          </p>
        )}
      </div>

      <ol className="demo-flow__steps">
        {steps.map((step) => (
          <li key={step.id} className={`demo-flow__step demo-flow__step--${step.status}`}>
            <span className="demo-flow__step-icon">
              <span aria-hidden="true">{STATUS_ICON[step.status]}</span>
              <span className="sr-only">{STATUS_LABEL[step.status]}</span>
            </span>
            <div className="demo-flow__step-body">
              <p className="demo-flow__step-title">{step.title}</p>
              <p className="demo-flow__step-description">{step.description}</p>
              {step.detail && <p className="demo-flow__step-detail">{step.detail}</p>}
            </div>
          </li>
        ))}
      </ol>

      {ledgerState && (
        <div className="demo-flow__tally">
          <h3>Live tally (public ledger state)</h3>
          <Tally
            yes={ledgerState.yesVotes}
            no={ledgerState.noVotes}
            ballots={ledgerState.nullifiers.size()}
          />
        </div>
      )}

      {log.length > 0 && (
        <div className="demo-flow__log">
          <h3>Activity log</h3>
          <ul aria-live="polite">
            {log.map((entry) => (
              <li key={entry.id} className={`demo-flow__log-entry demo-flow__log-entry--${entry.kind}`}>
                {entry.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
