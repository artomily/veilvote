import { useState } from "react";
import WalletConnect from "./components/WalletConnect.js";
import CircuitCall from "./components/CircuitCall.js";
import CopyableAddress from "./components/CopyableAddress.js";
import Tally from "./components/Tally.js";
import DemoFlow from "./demo/DemoFlow.js";
import { useMidnight } from "./hooks/useMidnight.js";

type Mode = "demo" | "live";

export default function App() {
  const m = useMidnight();
  const [joinInput, setJoinInput] = useState("");
  const [mode, setMode] = useState<Mode>("demo");

  const connected = m.walletState === "connected";
  const hasContract = connected && !!m.contractAddress;
  const deploying = m.busy === "Deploying proposal contract...";

  return (
    <main className="app">
      <header className="app__header">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            ◈
          </span>
          <h1>VeilVote</h1>
        </div>
        <p className="app__tagline">
          Private, eligibility-checked DAO voting on Midnight. Prove you're a member and
          cast a ballot — without revealing who you are or what you voted.
        </p>
        <ul className="app__badges">
          <li className="badge">Zero-knowledge ballots</li>
          <li className="badge">Double-vote proof</li>
          <li className="badge">Midnight testnet</li>
        </ul>

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
          <h2>Orchestrated flow</h2>
          <DemoFlow />
        </section>
      )}

      {mode === "live" && !connected && (
        <section className="app__section">
          <h2>Connect to go live</h2>
          <p className="section__lead">
            Live mode runs against the deployed Midnight contract and needs a Lace wallet.
            No wallet handy? Switch back to <strong>Offline demo</strong> — it runs the
            identical circuit entirely in this browser.
          </p>
          <button className="btn-ghost" onClick={() => setMode("demo")}>
            ← Back to the offline demo
          </button>
        </section>
      )}

      {mode === "live" && connected && (
        <>
          <section className="app__section">
            <h2>Proposal contract</h2>
            {m.contractAddress ? (
              <CopyableAddress value={m.contractAddress} label="contract address" />
            ) : (
              <p className="section__lead">
                No proposal connected yet — deploy a new one, or join an existing address.
              </p>
            )}
            <div className="app__contract-actions">
              <button className="btn-primary" disabled={!!m.busy} onClick={m.deploy}>
                {deploying ? "Deploying…" : "Deploy a new proposal"}
              </button>
              <input
                placeholder="Existing contract address"
                aria-label="Existing contract address"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
              />
              <button disabled={!!m.busy || !joinInput} onClick={() => m.join(joinInput)}>
                Join
              </button>
            </div>
          </section>

          <section className="app__section">
            <h2>Your identity</h2>
            <label className="app__field">
              Vote as
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
        </>
      )}

      {mode === "live" && hasContract && (
        <>
          <section className="app__section">
            <h2>Tally</h2>
            <p className="section__lead">Public ledger state — counts only, never voters.</p>
            {m.ledgerState ? (
              <Tally
                yes={m.ledgerState.yesVotes}
                no={m.ledgerState.noVotes}
                ballots={m.ledgerState.nullifiers.size()}
              />
            ) : (
              <p className="circuit-call__status">
                <span className="spinner" aria-hidden="true" />
                Loading ledger state…
              </p>
            )}
          </section>

          <section className="app__section">
            <h2>Cast your vote</h2>
            <p className="section__lead">
              Your secret key and Merkle proof never leave this browser.
            </p>
            <CircuitCall
              disabled={!hasContract}
              busy={m.busy && !deploying ? m.busy : null}
              lastResult={m.lastResult}
              onCastVote={m.castVote}
            />
          </section>
        </>
      )}

      {mode === "live" && m.error && connected && (
        <p className="app__error" role="alert">
          {m.error}
        </p>
      )}

      <footer className="app__footer">
        <a href="https://github.com/artomily/veilvote" target="_blank" rel="noreferrer">
          Source on GitHub
        </a>{" "}
        · Built with Compact on Midnight
      </footer>
    </main>
  );
}
