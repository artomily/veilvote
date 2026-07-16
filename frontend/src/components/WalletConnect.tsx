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
    return <div className="wallet-connect wallet-connect--detecting">Looking for a wallet…</div>;
  }

  if (walletState === "no-wallet") {
    return (
      <div className="wallet-connect wallet-connect--missing">
        <p>No Midnight wallet found.</p>
        <a href="https://docs.midnight.network/develop/tutorial/using/wallet" target="_blank" rel="noreferrer">
          Install the Lace wallet
        </a>
      </div>
    );
  }

  if (walletState === "connected" && address) {
    return (
      <div className="wallet-connect wallet-connect--connected">
        <span className="wallet-connect__dot" aria-hidden="true" />
        <span className="wallet-connect__address">{truncate(address)}</span>
        <button onClick={onDisconnect}>Disconnect</button>
      </div>
    );
  }

  return (
    <div className="wallet-connect wallet-connect--disconnected">
      <button onClick={onConnect} disabled={walletState !== "ready"}>
        {walletState === "connecting" ? "Connecting…" : "Connect Wallet"}
      </button>
      {error && <p className="wallet-connect__error">{error}</p>}
    </div>
  );
}
