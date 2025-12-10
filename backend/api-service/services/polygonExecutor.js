import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { ABIS, CONFIG } from "../config.js";

export function createPolygonExecutor({ onLog } = {}) {
  const provider = new JsonRpcProvider(CONFIG.polygonRpcUrl);
  const wallet = new Wallet(CONFIG.backendPrivateKey, provider);

  const proxy = new Contract(CONFIG.polygonProxyAddress, ABIS.proxyPolygon, wallet);
  const token = new Contract(CONFIG.polygonDemoTokenAddress, ABIS.erc20, wallet);

  const ensure = (cond, msg) => {
    if (!cond) throw new Error(msg);
  };

  async function hasSufficientAllowance(owner, spender, amount) {
    const allowance = await token.allowance(owner, spender);
    return allowance >= amount;
  }

  async function ensureApprovalIfNeeded({ owner, spender, amount }) {
    // If owner is the backend wallet itself, check allowance
    const approved = await hasSufficientAllowance(owner, spender, amount);
    if (!approved) {
      const tx = await token.approve(spender, amount);
      if (onLog) onLog(`Approval tx sent: ${tx.hash}`);
      await tx.wait();
    }
  }

  async function executeBetFor({ user, amount }) {
    ensure(CONFIG.polygonProxyAddress, "Missing POLYGON_PROXY_ADDRESS");
    if (onLog) onLog(`Executing Polygon betFor for ${user}, amount ${amount}`);
    // If your proxy pulls tokens from msg.sender, ensure adequate approval:
    // await ensureApprovalIfNeeded({ owner: wallet.address, spender: CONFIG.polygonProxyAddress, amount });
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


