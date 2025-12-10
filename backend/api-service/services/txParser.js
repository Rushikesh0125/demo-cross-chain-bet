import { Contract, JsonRpcProvider } from "ethers";
import { ABIS, CONFIG } from "../config.js";

export function createTxParser() {
  const baseProvider = new JsonRpcProvider(CONFIG.baseRpcUrl);

  const proxy = new Contract(CONFIG.baseProxyAddress, ABIS.proxyBase, baseProvider);

  async function verifyDepositByTxHash({ txHash, userAddress }) {
    if (!txHash) throw new Error("Missing txHash");
    if (!userAddress) throw new Error("Missing userAddress");

    console.log(`[api][parser] verifyDepositByTxHash tx=${txHash} user=${userAddress}`);
    const receipt = await baseProvider.getTransactionReceipt(txHash);
    if (!receipt) throw new Error("Transaction receipt not found");
    if (receipt.status !== 1) throw new Error("Transaction failed on Base");

    const logs = receipt.logs || [];
    console.log(`[api][parser] receipt status=${receipt.status} logs=${logs.length}`);
    const iface = proxy.interface;
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      try {
        console.log(`[api][parser] trying log idx=${i} addr=${log.address} topics0=${(log.topics && log.topics[0]) || ""}`);
        const parsed = iface.parseLog(log);
        if (parsed) {
          console.log(`[api][parser] parsed event ${parsed.name}`);
        }
        if (parsed && (parsed.name === "DepositedForBridge" || parsed.name === "DepositedForBet" || parsed.name === "DepositeForBet")) {
          const { user, amount } = parsed.args;
          console.log(`[api][parser] candidate deposit user=${user} amount=${amount?.toString?.() || amount}`);
          if (user.toLowerCase() !== userAddress.toLowerCase()) {
            console.log(`[api][parser] user mismatch parsed=${user} expected=${userAddress}`);
            continue;
          }
          return {
            success: true,
            amount: amount,
          };
        }
      } catch (e) {
        // not our event or parse failed
        console.log(`[api][parser] parseLog failed on idx, skipping (${(e && e.message) || String(e)})`);
      }
    }

    console.log(`[api][parser] no matching deposit event found for tx=${txHash}`);
    return { success: false, reason: "Deposit event not found or user mismatch" };
  }

  return {
    verifyDepositByTxHash,
  };
}


