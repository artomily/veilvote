type Props = {
  yes: bigint;
  no: bigint;
  ballots: bigint;
};

// Shared tally readout — three stat cards plus a Yes/No share bar. Used by
// both the offline demo and the live-wallet view so the two modes present the
// same public ledger state identically.
export default function Tally({ yes, no, ballots }: Props) {
  const total = yes + no;
  const yesPct = total === 0n ? 0 : Number((yes * 100n) / total);

  return (
    <div>
      <ul className="tally">
        <li className="tally__item tally__item--yes">
          <span className="tally__label">Yes</span>
          <span className="tally__value">{yes.toString()}</span>
        </li>
        <li className="tally__item tally__item--no">
          <span className="tally__label">No</span>
          <span className="tally__value">{no.toString()}</span>
        </li>
        <li className="tally__item">
          <span className="tally__label">Ballots</span>
          <span className="tally__value">{ballots.toString()}</span>
        </li>
      </ul>
      {total > 0n && (
        <div
          className="tally-bar"
          role="img"
          aria-label={`${yes.toString()} yes, ${no.toString()} no`}
        >
          <div className="tally-bar__yes" style={{ width: `${yesPct}%` }} />
          <div className="tally-bar__no" style={{ width: `${100 - yesPct}%` }} />
        </div>
      )}
    </div>
  );
}
