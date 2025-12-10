import React from "react";
import type { CrossChainStatus } from "../hooks/useCrossChainBet";

export function TransactionStatus({ status }: { status: CrossChainStatus }) {
  if (!status) return null;
  return (
    <div className="p-4 rounded-md border bg-gray-50">
      <div className="text-sm text-gray-800">
        <div className="font-semibold mb-1">Status: {status.phase}</div>
        {status.message ? <div className="mb-1">{status.message}</div> : null}
        {status.baseTxHash ? (
          <div className="break-all">
            <span className="font-semibold">Base tx:</span> {status.baseTxHash}
          </div>
        ) : null}
        {status.polygonTxHash ? (
          <div className="break-all">
            <span className="font-semibold">Polygon tx:</span> {status.polygonTxHash}
          </div>
        ) : null}
        {status.amount ? (
          <div className="break-all">
            <span className="font-semibold">Amount:</span> {status.amount}
          </div>
        ) : null}
      </div>
    </div>
  );
}


