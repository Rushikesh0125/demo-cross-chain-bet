import { Router } from "express";
import { createTxParser } from "../services/txParser.js";
import { createPolygonExecutor } from "../services/polygonExecutor.js";

export function createVerifyDepositRouter() {
  const router = Router();
  const parser = createTxParser();
  const polygon = createPolygonExecutor({
    onLog: (m) => console.log(`[polygon] ${m}`),
  });

  router.get("/check-approval", async (req, res) => {
    // Placeholder endpoint; implement fully as needed
    return res.json({ hasApproval: true, currentAllowance: "0" });
  });

  router.post("/verify-deposit", async (req, res) => {
    try {
      const { txHash, userAddress } = req.body || {};
      console.log(`[api] /verify-deposit body`, req.body);
      if (!txHash || !userAddress) {
        console.log(`[api] /verify-deposit invalid body`);
        return res.status(400).json({ success: false, error: "txHash and userAddress are required" });
      }
      console.log(`[api] verifying deposit tx=${txHash} user=${userAddress}`);
      const verification = await parser.verifyDepositByTxHash({ txHash, userAddress });
      console.log(`[api] verification result`, verification);
      if (!verification.success) {
        return res.status(400).json({ success: false, error: verification.reason || "Verification failed" });
      }
      const amount = verification.amount;
      console.log(`[api] executing betFor on Polygon amount=${amount.toString()} user=${userAddress}`);
      const polygonTxHash = await polygon.executeBetFor({ user: userAddress, amount });
      console.log(`[api] polygon tx ${polygonTxHash}`);
      return res.json({ success: true, amount: amount.toString(), polygonTxHash });
    } catch (err) {
      console.error(`[api] verify-deposit error`, err);
      return res.status(500).json({ success: false, error: err?.message || "Internal Server Error" });
    }
  });

  return router;
}


