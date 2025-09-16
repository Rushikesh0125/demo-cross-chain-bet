import { ConnectedWallet as PrivyWallet } from "@privy-io/react-auth";
import { useSmartEmbeddedWallet } from "../hooks/use-smart-embedded-wallet";
import { useCallback, useState } from "react";
import type { Address, Hex } from "viem";

export const SmartWalletDemo = ({
  embeddedWallet,
}: {
  embeddedWallet: PrivyWallet;
}) => {
  const { client } = useSmartEmbeddedWallet({ embeddedWallet });

  const [status, setStatus] = useState<
    | { status: "idle" | "error" | "sending" }
    | { status: "success"; txHash: Hex }
  >({ status: "idle" });

  const delegateAndSend = useCallback(async () => {
    if (!client) {
      return;
    }

    setStatus({ status: "sending" });
    try {
      const {
        preparedCallIds: [callId],
      } = await client.sendCalls({
        capabilities: {
          eip7702Auth: true,
        },
        from: embeddedWallet.address as Address,
        calls: [
          {
            to: "0x0000000000000000000000000000000000000000",
            data: "0x",
          },
        ],
      });
      if (!callId) {
        throw new Error("Missing call id");
      }

      const { receipts } = await client.waitForCallsStatus({ id: callId });
      if (!receipts?.length) {
        throw new Error("Missing transaction receipts");
      }
      const [receipt] = receipts;
      if (receipt?.status !== "success") {
        throw new Error("Transaction failed");
      }
      setStatus({ status: "success", txHash: receipt.transactionHash });
    } catch (err) {
      console.error("Transaction failed:", err);
      setStatus({ status: "error" });
    }
  }, [client, embeddedWallet]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Embedded EOA Address
        </h2>
        <p className="text-gray-600 font-mono break-all">
          {embeddedWallet.address}
        </p>
      </div>
      <button
        onClick={delegateAndSend}
        disabled={!client || status.status === "sending"}
        className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
          status.status === "sending"
            ? "bg-indigo-400 cursor-not-allowed"
            : "bg-indigo-600 hover:bg-indigo-700"
        }`}
      >
        {status.status === "sending"
          ? "Sending..."
          : "Upgrade & Send Sponsored Transaction"}
      </button>
      {status.status === "success" && (
        <section className="bg-green-50 rounded-xl shadow-lg p-6 border border-green-200">
          <h2 className="text-lg font-semibold text-green-900 mb-4">
            Congrats! Sponsored transaction successful!
          </h2>
          <p className="text-green-700 mb-4">
            You've successfully upgraded your EOA to a smart account and sent
            your first sponsored transaction.{" "}
            <a
              href="https://www.alchemy.com/docs/wallets/react/using-7702"
              className="text-indigo-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Keep building
            </a>
            .
          </p>
          <p className="text-green-700">
            <strong>Transaction Hash:</strong>{" "}
            <span className="font-mono break-all">{status.txHash}</span>
          </p>
        </section>
      )}
      {status.status === "error" && (
        <section className="bg-red-50 rounded-xl shadow-lg p-6 border border-red-200">
          <h2 className="text-lg font-semibold text-red-900 mb-4">
            Transaction Failed
          </h2>
          <p className="text-red-700">
            There was an error sending your sponsored transaction. Please try
            again.
          </p>
        </section>
      )}
    </div>
  );
};
