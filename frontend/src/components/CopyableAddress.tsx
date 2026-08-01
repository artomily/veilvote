import { useState } from "react";

type Props = {
  value: string;
  label?: string;
};

// Contract addresses are 64 hex chars — unusable unless they can be copied,
// so the address is always paired with a copy button that confirms in place.
export default function CopyableAddress({ value, label = "address" }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (insecure context / permission) — leave the text
      // selectable so the user can copy it manually.
    }
  };

  return (
    <div className="address-row">
      <code>{value}</code>
      <button className="btn-ghost" onClick={copy} aria-label={`Copy ${label}`}>
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}
