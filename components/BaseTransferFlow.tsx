import React, { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import type { ConnectedWallet as PrivyWallet } from "@privy-io/react-auth";
import type { CrossChainStatus } from "../hooks/useCrossChainBet";
import { useToast } from "./ToastProvider";

type Env = {
  base: {
    token?: Address;
    proxy?: Address;
    external?: Address;
    approvalSpender?: Address;
  };
  polygon: {
    proxy?: Address;
    token?: Address;
    external?: Address;
  };
  backend: {
    apiUrl: string;
  };
};

export function BaseTransferFlow({
  embeddedWallet,
  executeBaseDeposit,
  status,
  env,
}: {
  embeddedWallet: PrivyWallet | null;
  executeBaseDeposit: (amountStr: string) => Promise<string | void>;
  status: CrossChainStatus;
  env: Env;
}) {
  const [amount, setAmount] = useState("");
  const toast = useToast();

  const baseToken = env.base.token || "Not set";
  const baseProxy = env.base.proxy || "Not set";
  const spender = env.base.approvalSpender || env.base.proxy || "Not set";

  const isProcessing = useMemo(() => {
    return (
      status.phase === "approving-base" ||
      status.phase === "depositing-base" ||
      status.phase === "verifying" ||
      status.phase === "executing-polygon"
    );
  }, [status.phase]);

  useEffect(() => {
    if (status.phase === "success") {
      toast.success("Success! Cross-chain execution completed.");
    } else if (status.phase === "error") {
      toast.error(status.message ? `Error: ${status.message}` : "Transaction failed.");
    }
    // Only react to phase changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.phase]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Amount to deposit on Base (DEMO)
        </label>
        <input
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="1.0"
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
        />
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-sm text-blue-800">
        This will batch:
        <ol className="ml-4 list-decimal">
          <li>Approve Base Proxy to spend DEMO</li>
          <li>Call depositeForBet(amount) on Base Proxy</li>
        </ol>
      </div>
      <button
        onClick={() => executeBaseDeposit(amount)}
        className="w-full py-3 px-4 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed"
        disabled={!amount || isProcessing}
      >
        {isProcessing ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
            Processing...
          </span>
        ) : (
          "Approve + Deposit on Base"
        )}
      </button>
      <div className="p-3 bg-gray-50 rounded text-xs text-gray-700 break-all">
        <div><strong>Base DEMO:</strong> {baseToken as Address}</div>
        <div><strong>Base Proxy:</strong> {baseProxy as Address}</div>
        <div><strong>Approval Spender:</strong> {spender as Address}</div>
      </div>
    </div>
  );
}


