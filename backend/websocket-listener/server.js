import express from "express";
import { WebSocketServer } from "ws";
import { CONFIG } from "./config.js";
import { createBaseListener } from "./contractListener.js";
import { createPolygonExecutor } from "./polygonExecutor.js";

const app = express();
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "websocket-listener" });
});

const server = app.listen(CONFIG.wsPort, () => {
  console.log(`[ws] HTTP/WS server listening on :${CONFIG.wsPort}`);
  console.log(`[ws] BASE_RPC_URL: ${CONFIG.baseRpcUrl ? "set" : "missing"}`);
  console.log(`[ws] BASE_WS_URL: ${CONFIG.baseWsUrl ? "set" : "missing"}`);
  console.log(`[ws] BASE_PROXY_ADDRESS: ${CONFIG.baseProxyAddress}`);
});

const wss = new WebSocketServer({ server });

function broadcast(message) {
  const payload = typeof message === "string" ? message : JSON.stringify(message);
  for (const client of wss.clients) {
    try {
      client.send(payload);
    } catch {
      /* ignore */
    }
  }
}

const polygon = createPolygonExecutor({
  onLog: (m) => {
    console.log(`[polygon] ${m}`);
    broadcast({ type: "log", message: m });
  },
});

const listener = createBaseListener({
  onLog: (m) => {
    console.log(`[base] ${m}`);
    broadcast({ type: "log", message: m });
  },
  onDeposited: async ({ user, amount, txHash }) => {
    console.log(`[base] deposit detected user=${user} amount=${amount.toString()} tx=${txHash}`);
    broadcast({
      type: "deposit_detected",
      chain: "base",
      user,
      amount: amount.toString(),
      baseTxHash: txHash,
    });
    try {
      const polygonTxHash = await polygon.executeBetFor({ user, amount });
      console.log(`[polygon] executed betFor user=${user} amount=${amount.toString()} polygonTx=${polygonTxHash}`);
      broadcast({
        type: "polygon_executed",
        chain: "polygon",
        user,
        amount: amount.toString(),
        polygonTxHash,
      });
    } catch (err) {
      console.error(`[polygon] execution error`, err);
      broadcast({
        type: "error",
        phase: "polygon_execute",
        error: err?.message || String(err),
      });
    }
  },
});

listener.start();

wss.on("connection", (socket) => {
  console.log(`[ws] client connected (total=${wss.clients.size})`);
  socket.on("close", () => {
    console.log(`[ws] client disconnected (total=${wss.clients.size})`);
  });
});

process.on("SIGINT", () => {
  listener.stop();
  server.close(() => process.exit(0));
});


