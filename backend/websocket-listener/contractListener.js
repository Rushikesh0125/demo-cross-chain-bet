import { Contract, JsonRpcProvider, WebSocketProvider, Interface, AbiCoder, keccak256, toUtf8Bytes } from "ethers";
import { ABIS, CONFIG } from "./config.js";

export function createBaseListener({ onDeposited, onLog } = {}) {
  if (!CONFIG.baseProxyAddress) {
    throw new Error("BASE_PROXY_ADDRESS not configured");
  }

  let provider;
  let eventContract;
  let keepAliveTimer;
  const iface = new Interface(ABIS.proxyBase);
  const processed = new Set();
  const eventAddress = (CONFIG.baseEventAddress || CONFIG.baseProxyAddress).toLowerCase();

  function buildProvider() {
    if (CONFIG.baseWsUrl) {
      if (onLog) onLog(`Using WebSocket provider for Base: ${CONFIG.baseWsUrl}`);
      return new WebSocketProvider(CONFIG.baseWsUrl);
    }
    if (!CONFIG.baseRpcUrl) {
      throw new Error("BASE_RPC_URL not configured");
    }
    const http = new JsonRpcProvider(CONFIG.baseRpcUrl);
    http.pollingInterval = 10_000;
    if (onLog) onLog(`Using HTTP provider for Base with polling every ${http.pollingInterval}ms`);
    return http;
  }

  function attach() {
    provider = buildProvider();
    eventContract = new Contract(eventAddress, ABIS.proxyBase, provider);
    if (onLog) onLog(`Subscribing on ${eventAddress} to: DepositedForBridge, DepositedForBet, DepositeForBet`);

    // Precompute topics for known deposit events (indexing does not change the topic hash)
    const topicDepositedForBridge = keccak256(toUtf8Bytes("DepositedForBridge(address,uint256)"));
    const topicDepositedForBet = keccak256(toUtf8Bytes("DepositedForBet(address,uint256)"));
    const topicDepositeForBet = keccak256(toUtf8Bytes("DepositeForBet(address,uint256)"));

    const handle = async (user, amount, event) => {
      try {
        const tx = event.log.transactionHash;
        const blk = event.log.blockNumber;
        const key = `${tx}:${blk}`;
        if (processed.has(key)) return;
        processed.add(key);
        if (onLog) onLog(`Event user=${user} amount=${amount.toString()} tx=${tx}`);
        if (onDeposited) {
          await onDeposited({
            user: user.toLowerCase(),
            amount: amount,
            txHash: tx,
            blockNumber: blk,
          });
        }
      } catch (err) {
        if (onLog) onLog(`Error in onDeposited handler: ${(err && err.message) || String(err)}`);
      }
    };
    eventContract.on("DepositedForBridge", handle);
    eventContract.on("DepositedForBet", handle);
    eventContract.on("DepositeForBet", handle);

    // Fallback: listen to any event logs for this address and try to parse
    provider.on({ address: eventAddress }, async (rawLog) => {
      try {
        if (onLog) onLog(`Fallback raw log addr=${rawLog.address} topic0=${rawLog.topics?.[0]}`);
        const t0 = rawLog.topics?.[0];
        const isDepositTopic =
          t0 === topicDepositedForBridge || t0 === topicDepositedForBet || t0 === topicDepositeForBet;
        if (!isDepositTopic) {
          return; // not a deposit event
        }

        // Decode user and amount depending on indexing layout
        const topics = rawLog.topics || [];
        let user;
        let amount;
        if (topics.length >= 3 && topics[1] && topics[2]) {
          // Both indexed
          const topicUser = topics[1];
          const topicAmount = topics[2];
          user = `0x${topicUser.slice(26)}`.toLowerCase();
          amount = BigInt(topicAmount);
        } else if (topics.length === 2 && topics[1]) {
          // Exactly one indexed (unknown which). Try decoding data as address first.
          const coder = AbiCoder.defaultAbiCoder();
          const data = rawLog.data || "0x";
          let decodedAddressOk = false;
          try {
            const [addr] = coder.decode(["address"], data);
            if (addr) {
              user = String(addr).toLowerCase();
              amount = BigInt(topics[1]);
              decodedAddressOk = true;
            }
          } catch {}
          if (!decodedAddressOk) {
            // Fallback: assume user indexed and amount in data
            const topicUser = topics[1];
            user = `0x${topicUser.slice(26)}`.toLowerCase();
            const [amt] = AbiCoder.defaultAbiCoder().decode(["uint256"], data);
            amount = amt;
          }
        } else {
          // No indexed params; both in data
          const data = rawLog.data || "0x";
          const [addr, amt] = AbiCoder.defaultAbiCoder().decode(["address", "uint256"], data);
          user = String(addr).toLowerCase();
          amount = amt;
        }

        if (onLog) onLog(`Fallback candidate deposit user=${user} amount=${amount?.toString?.() || amount}`);
        await handle(user, amount, {
          log: { transactionHash: rawLog.transactionHash, blockNumber: rawLog.blockNumber },
        });
      } catch (e) {
        // Not our event or parse failed; emit a debug once in a while if needed
        if (onLog) onLog(`Fallback parse failed: ${(e && e.message) || String(e)}`);
      }
    });

    clearInterval(keepAliveTimer);
    keepAliveTimer = setInterval(async () => {
      try {
        await provider.getBlockNumber();
      } catch (err) {
        if (onLog) onLog(`Provider ping failed, reconnecting: ${(err && err.message) || String(err)}`);
        reconnect();
      }
    }, 15000);

    // Catch up recent events in case listener was started after a tx
    (async () => {
      try {
        const current = await provider.getBlockNumber();
        const fromBlock = Math.max(0, current - 9); // free tier: <= 10 block range
        const toBlock = current; // avoid using "latest" which may be rejected on free tier
        const logsBridge = await eventContract.queryFilter(eventContract.filters.DepositedForBridge(), fromBlock, toBlock);
        const logsBet = await eventContract.queryFilter(eventContract.filters.DepositedForBet(), fromBlock, toBlock);
        const logsBetAlt = await eventContract.queryFilter(eventContract.filters.DepositeForBet(), fromBlock, toBlock);
        const merged = [...logsBridge, ...logsBet, ...logsBetAlt].sort((a, b) => {
          if (a.blockNumber === b.blockNumber) {
            return (a.index ?? 0) - (b.index ?? 0);
          }
          return a.blockNumber - b.blockNumber;
        });
        if (onLog) onLog(`Replayed ${merged.length} recent deposit logs from blocks ${fromBlock}..${current}`);
        for (const ev of merged) {
          try {
            const user = ev.args?.user;
            const amount = ev.args?.amount;
            if (!user || amount == null) continue;
            if (onLog) onLog(`Replaying deposit log user=${user} amount=${amount?.toString?.() || amount} tx=${ev.transactionHash}`);
            await handle(user, amount, {
              log: { transactionHash: ev.transactionHash, blockNumber: ev.blockNumber },
            });
          } catch {}
        }
      } catch (err) {
        if (onLog) onLog(`Error during replay: ${(err && err.message) || String(err)}`);
      }
    })();
  }

  function reconnect() {
    try {
      eventContract?.removeAllListeners?.("DepositedForBridge");
    } catch {}
    try {
      eventContract?.removeAllListeners?.("DepositedForBet");
    } catch {}
    try {
      eventContract?.removeAllListeners?.("DepositeForBet");
    } catch {}
    try {
      if (provider && "destroy" in provider && typeof provider.destroy === "function") {
        provider.destroy();
      }
    } catch {}
    attach();
  }

  function start() {
    if (onLog) onLog(`Starting Base Sepolia proxy event listener (eventAddress=${eventAddress})...`);
    attach();
  }

  function stop() {
    try {
      eventContract?.removeAllListeners?.("DepositedForBridge");
    } catch {}
    try {
      eventContract?.removeAllListeners?.("DepositedForBet");
    } catch {}
    try {
      eventContract?.removeAllListeners?.("DepositeForBet");
    } catch {}
    clearInterval(keepAliveTimer);
  }

  return { start, stop };
}


