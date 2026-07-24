import { useState } from "react";
import WalletConnect from "./components/WalletConnect.js";
import CircuitCall from "./components/CircuitCall.js";
import DemoFlow from "./demo/DemoFlow.js";
import { useMidnight } from "./hooks/useMidnight.js";

type Mode = "demo" | "live";

export default function App() {
  const m = useMidnight();
  const [joinInput, setJoinInput] = useState("");
  const [mode, setMode] = useState<Mode>("demo");

  const connected = m.walletState === "connected";
  const hasContract = connected && !!m.contractAddress;

  return (
    <main className="app">
      <header className="app__header">
        <h1>VeilVote</h1>
        <p>Private, eligibility-checked DAO voting on Midnight.</p>
        <div className="mode-toggle" role="tablist" aria-label="Demo mode">
          <button
            role="tab"
            aria-selected={mode === "demo"}
            className={`mode-toggle__button${mode === "demo" ? " mode-toggle__button--active" : ""}`}
            onClick={() => setMode("demo")}
          >
            Offline demo
          </button>
          <button
            role="tab"
            aria-selected={mode === "live"}
            className={`mode-toggle__button${mode === "live" ? " mode-toggle__button--active" : ""}`}
            onClick={() => setMode("live")}
          >
            Live wallet
          </button>
        </div>
        {mode === "live" && (
          <WalletConnect
            walletState={m.walletState}
            address={m.address}
            error={connected ? null : m.error}
            onConnect={m.connect}
            onDisconnect={m.disconnect}
          />
        )}
      </header>

      {mode === "demo" && (
        <section className="app__section">
          <h2>Orchestrated flow (offline demo)</h2>
          <DemoFlow />
        </section>
      )}

      {mode === "live" && connected && (
        <section className="app__section">
          <h2>Proposal contract</h2>
          {m.contractAddress ? (
            <p>
              Connected to <code>{m.contractAddress}</code>
            </p>
          ) : (
            <p>No proposal connected yet — deploy a new one or join an existing address.</p>
          )}
          <div className="app__contract-actions">
            <button disabled={!!m.busy} onClick={m.deploy}>
              {m.busy === "Deploying proposal contract..." ? "Deploying…" : "Deploy a new proposal"}
            </button>
            <input
              placeholder="Existing contract address"
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
            />
            <button disabled={!!m.busy || !joinInput} onClick={() => m.join(joinInput)}>
              Join
            </button>
          </div>
        </section>
      )}

      {mode === "live" && connected && (
        <section className="app__section">
          <h2>Your identity</h2>
          <label>
            Vote as:{" "}
            <select value={m.voterIndex} onChange={(e) => m.setVoterIndex(Number(e.target.value))}>
              {m.demoVoterLabels.map((label, i) => (
                <option key={label} value={i}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <p className="app__hint">
            Demo-only: each option is a fixed passphrase pre-registered in the eligibility
            tree, standing in for a real DAO member's private secret key.
          </p>
        </section>
      )}

      {mode === "live" && connected && hasContract && (
        <section className="app__section">
          <h2>Tally</h2>
          {m.ledgerState ? (
            <ul className="app__tally">
              <li>Yes: {m.ledgerState.yesVotes.toString()}</li>
              <li>No: {m.ledgerState.noVotes.toString()}</li>
              <li>Ballots cast: {m.ledgerState.nullifiers.size().toString()}</li>
            </ul>
          ) : (
            <p>Loading ledger state…</p>
          )}
        </section>
      )}

      {mode === "live" && connected && hasContract && (
        <section className="app__section">
          <h2>Cast your vote</h2>
          <CircuitCall
            disabled={!hasContract}
            busy={m.busy && m.busy !== "Deploying proposal contract..." ? m.busy : null}
            lastResult={m.lastResult}
            onCastVote={m.castVote}
          />
        </section>
      )}

      {mode === "live" && m.error && connected && <p className="app__error">{m.error}</p>}
    </main>
  );
}
