import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { ABIS, CONFIG } from "./config.js";

export function createPolygonExecutor({ onLog } = {}) {
  const provider = new JsonRpcProvider(CONFIG.polygonRpcUrl);
  const wallet = new Wallet(CONFIG.backendPrivateKey, provider);

  const proxy = new Contract(CONFIG.polygonProxyAddress, ABIS.proxyPolygon, wallet);

  const ensure = (cond, msg) => {
    if (!cond) throw new Error(msg);
  };

  async function ensureApprovalIfNeeded(owner, spender, amount) {
    // Optional: If using backend wallet to execute on behalf of protocol only, approval may not be needed.
    // This function is provided for completeness if token transfers are part of betFor on Polygon.
    // You can extend this to support permit if required.
    return true;
  }

  async function executeBetFor({ user, amount }) {
    ensure(CONFIG.polygonProxyAddress, "Missing POLYGON_PROXY_ADDRESS");
    if (onLog) onLog(`Executing Polygon betFor for ${user}, amount ${amount}`);
    const tx = await proxy.betFor(user, amount);
    if (onLog) onLog(`Polygon tx submitted ${tx.hash}`);
    const receipt = await tx.wait();
    if (onLog) onLog(`Polygon tx confirmed in block ${receipt.blockNumber}`);
    return tx.hash;
  }

  return {
    executeBetFor,
    walletAddress: wallet.address,
  };
}


