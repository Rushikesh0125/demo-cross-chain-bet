import { useEffect, useRef, useState } from "react";

export type CrossChainWsEvent =
  | { type: "log"; message: string }
  | { type: "deposit_detected"; chain: "base"; user: string; amount: string; baseTxHash: string }
  | { type: "polygon_executed"; chain: "polygon"; user: string; amount: string; polygonTxHash: string }
  | { type: "error"; phase?: string; error: string };

export function useWebSocketFeed(url?: string) {
  const [messages, setMessages] = useState<CrossChainWsEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const wsUrl = url || process.env.NEXT_PUBLIC_BACKEND_WEBSOCKET_URL || "";

  useEffect(() => {
    if (!wsUrl) return;
    let isCancelled = false;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => {
      if (isCancelled) return;
      setConnected(true);
    };
    ws.onclose = () => {
      if (isCancelled) return;
      setConnected(false);
    };
    ws.onerror = () => {
      // swallow
    };
    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data as string);
        setMessages((prev) => [...prev, data]);
      } catch {
        // ignore parse errors
      }
    };
    return () => {
      isCancelled = true;
      ws.close();
    };
  }, [wsUrl]);

  return { messages, connected };
}


