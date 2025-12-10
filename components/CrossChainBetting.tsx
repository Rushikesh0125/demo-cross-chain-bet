import React, { useEffect } from "react";
import type { ConnectedWallet as PrivyWallet } from "@privy-io/react-auth";
import { FlowSelector } from "./FlowSelector";
import { BaseTransferFlow } from "./BaseTransferFlow";
import { TransactionStatus } from "./TransactionStatus";
import { useWebSocketFeed } from "../hooks/useWebSocket";
import { useCrossChainBet } from "../hooks/useCrossChainBet";
import { ActivityLog, ActivityLogItem } from "./ActivityLog";
import { useToast } from "./ToastProvider";

export function CrossChainBetting({ embeddedWallet }: { embeddedWallet: PrivyWallet | null }) {
  const { messages, connected } = useWebSocketFeed();
  const {
    mode,
    setMode,
    flow,
    setFlow,
    status,
    setStatus,
    logs,
    executeBaseDeposit,
    env,
  } = useCrossChainBet(embeddedWallet);
  const toast = useToast();
  const wsLogItems: ActivityLogItem[] = messages.map((m) => ({
    t: Date.now(),
    m:
      m.type === "log"
        ? `[WS] ${m.message}`
        : m.type === "deposit_detected"
        ? `[WS] Deposit detected user=${m.user} amount=${m.amount} baseTx=${m.baseTxHash}`
        : m.type === "polygon_executed"
        ? `[WS] Polygon executed user=${m.user} amount=${m.amount} polygonTx=${m.polygonTxHash}`
        : m.type === "error"
        ? `[WS] Error phase=${m.phase || "unknown"} error=${m.error}`
        : `[WS] ${JSON.stringify(m)}`,
  }));

  useEffect(() => {
    if (!messages.length) return;
    const last = messages[messages.length - 1];
    if (last.type === "deposit_detected") {
      // Only show intermediate state when relying on WS flow
      if (mode === "websocket") {
        setStatus({
          phase: "executing-polygon",
          message: "Backend detected deposit; executing Polygon step...",
          baseTxHash: last.baseTxHash,
          amount: last.amount,
        });
      }
    } else if (last.type === "polygon_executed") {
      // Always reflect final success if backend reports it, regardless of mode
      setStatus({
        phase: "success",
        message: "Cross-chain execution completed",
        polygonTxHash: last.polygonTxHash,
        amount: last.amount,
      });
    } else if (last.type === "error") {
      setStatus({
        phase: "error",
        message: last.error,
      });
    }
  }, [messages, mode, setStatus]);

  useEffect(() => {
    if (status.phase === "success") {
      toast.success("Cross-chain flow completed!");
    } else if (status.phase === "error") {
      toast.error(status.message ? `Error: ${status.message}` : "Cross-chain flow failed.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.phase]);

  return (
    <section className="space-y-6">
      <h3 className="text-md font-semibold text-gray-800">
        Cross-Chain Betting (Base Sepolia → Polygon)
      </h3>
      <FlowSelector mode={mode} setMode={setMode} flow={flow} setFlow={setFlow} />

      <div className="p-3 text-xs rounded bg-gray-50 border">
        <div className="mb-1">
          <strong>WebSocket:</strong> {connected ? "connected" : "disconnected"}
        </div>
        <div>
          <strong>Mode:</strong> {mode} | <strong>Flow:</strong> {flow}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="p-4 border rounded-md">
          <h4 className="font-semibold mb-2 text-gray-800">1) Base Sepolia Deposit</h4>
          <BaseTransferFlow
            embeddedWallet={embeddedWallet}
            executeBaseDeposit={executeBaseDeposit}
            status={status}
            env={env}
          />
        </div>

        <div className="p-4 border rounded-md">
          <h4 className="font-semibold mb-2 text-gray-800">2) Cross-Chain Status</h4>
          <TransactionStatus status={status} />
          {flow === "twoClick" && (
            <div className="mt-4 p-3 text-sm bg-yellow-50 border border-yellow-200 rounded">
              Switch to Polygon and click to execute Approve + betFor (not implemented here).
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <ActivityLog title="Client Activity" items={logs} />
            <ActivityLog title="Backend WS" items={wsLogItems} />
          </div>
        </div>
      </div>
    </section>
  );
}


