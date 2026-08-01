import type { WalletState } from "../hooks/useMidnight.js";

type Props = {
  walletState: WalletState;
  address: string | null;
  error: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
};

function truncate(addr: string): string {
  return addr.length <= 20 ? addr : `${addr.slice(0, 10)}...${addr.slice(-8)}`;
}

export default function WalletConnect({ walletState, address, error, onConnect, onDisconnect }: Props) {
  if (walletState === "detecting") {
    return (
      <div className="wallet-connect wallet-connect--detecting" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        Looking for a wallet…
      </div>
    );
  }

  if (walletState === "no-wallet") {
    return (
      <div className="wallet-connect wallet-connect--missing">
        <span>No Midnight wallet found.</span>
        <a href="https://docs.midnight.network/develop/tutorial/using/wallet" target="_blank" rel="noreferrer">
          Install the Lace wallet →
        </a>
      </div>
    );
  }

  if (walletState === "connected" && address) {
    return (
      <div className="wallet-connect wallet-connect--connected">
        <span className="wallet-connect__dot" aria-hidden="true" />
        <span className="wallet-connect__address" title={address}>
          {truncate(address)}
        </span>
        <button className="btn-ghost" onClick={onDisconnect}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-connect wallet-connect--disconnected">
      <button className="btn-primary" onClick={onConnect} disabled={walletState !== "ready"}>
        {walletState === "connecting" ? "Connecting…" : "Connect wallet"}
      </button>
      {error && (
        <p className="wallet-connect__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
