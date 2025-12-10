import express from "express";
import morgan from "morgan";
import cors from "cors";
import { CONFIG } from "./config.js";
import { createVerifyDepositRouter } from "./routes/verify-deposit.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (_req, res) => res.json({ ok: true, service: "api-service" }));
app.use("/api", createVerifyDepositRouter());

app.listen(CONFIG.port, () => {
  console.log(`[api] server listening on :${CONFIG.port}`);
  console.log(`[api] BASE_RPC_URL: ${CONFIG.baseRpcUrl ? "set" : "missing"}`);
  console.log(`[api] POLYGON_RPC_URL: ${CONFIG.polygonRpcUrl ? "set" : "missing"}`);
  console.log(`[api] BASE_PROXY_ADDRESS: ${CONFIG.baseProxyAddress}`);
  console.log(`[api] POLYGON_PROXY_ADDRESS: ${CONFIG.polygonProxyAddress}`);
});


