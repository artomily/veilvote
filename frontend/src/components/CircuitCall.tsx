type Props = {
  disabled: boolean;
  busy: string | null;
  lastResult: { txId: string } | null;
  onCastVote: (voteYes: boolean) => void;
};

// Calls the `castVote` circuit. The only private input to this circuit — the
// voter's secret key and Merkle path proving DAO membership — is generated
// and used entirely inside this component's call to `onCastVote`; it is
// never rendered, logged, or included in any state shown below.
export default function CircuitCall({ disabled, busy, lastResult, onCastVote }: Props) {
  return (
    <div className="circuit-call">
      <div className="circuit-call__buttons">
        <button
          className="circuit-call__vote--yes"
          disabled={disabled || !!busy}
          onClick={() => onCastVote(true)}
        >
          Vote Yes
        </button>
        <button
          className="circuit-call__vote--no"
          disabled={disabled || !!busy}
          onClick={() => onCastVote(false)}
        >
          Vote No
        </button>
      </div>

      {busy && (
        <p className="circuit-call__status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          {busy}
        </p>
      )}

      {lastResult && (
        <div className="circuit-call__result">
          <p>
            Submitted on-chain — tx <code>{lastResult.txId}</code>
          </p>
          <p className="circuit-call__proof-label">🔒 Proved without revealing your input</p>
          <p className="circuit-call__note">
            Your identity and eligibility proof were used only inside your browser to
            generate this transaction's proof — they were never sent anywhere or shown
            on this screen.
          </p>
        </div>
      )}
    </div>
  );
}
