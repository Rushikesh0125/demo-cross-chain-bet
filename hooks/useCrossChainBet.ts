import { useCallback, useMemo, useState } from "react";
import type { Address } from "viem";
import { encodeFunctionData, parseEther, createWalletClient, createPublicClient, custom } from "viem";
import { polygonAmoy } from "viem/chains";
import { polygonAmoy as polygonAmoyAk } from "@account-kit/infra";
import { useSign7702Authorization } from "@privy-io/react-auth";
import { createSmartWalletClient, SmartWalletClient } from "@account-kit/wallet-client";
import { WalletClientSigner } from "@aa-sdk/core";
import { alchemy } from "@account-kit/infra";
import { useSmartEmbeddedWallet } from "./use-smart-embedded-wallet";
import type { ConnectedWallet as PrivyWallet } from "@privy-io/react-auth";

type Mode = "websocket" | "api";
type Flow = "oneClick" | "twoClick";

export type TxPhase =
  | "idle"
  | "approving-base"
  | "depositing-base"
  | "verifying"
  | "executing-polygon"
  | "awaiting-user"
  | "success"
  | "error";

export interface CrossChainStatus {
  phase: TxPhase;
  message?: string;
  baseTxHash?: string;
  polygonTxHash?: string;
  amount?: string;
}

export interface CrossChainLogItem { t: number; m: string }

// Minimal ABIs for viem encoding
const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// Align to deployed contract method name used elsewhere in repo
const PROXY_ABI_BASE = [
  {
    name: "depositeForBet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
] as const;

export function useCrossChainBet(embeddedWallet: PrivyWallet | null) {
  const { client } = useSmartEmbeddedWallet({ embeddedWallet: embeddedWallet as any });
  const { signAuthorization } = useSign7702Authorization();

  const [mode, setMode] = useState<Mode>("websocket");
  const [flow, setFlow] = useState<Flow>("oneClick");
  const [status, setStatus] = useState<CrossChainStatus>({ phase: "idle" });
  const [logs, setLogs] = useState<CrossChainLogItem[]>([]);
  const addLog = (m: string) => setLogs((prev) => [...prev, { t: Date.now(), m }]);

  const env = useMemo(() => {
    return {
      base: {
        token: process.env.NEXT_PUBLIC_DEMO_TOKEN_ADDRESS_BASE as Address | undefined,
        proxy: process.env.NEXT_PUBLIC_PROXY_CONTRACT_ADDRESS_BASE as Address | undefined,
        external: process.env.NEXT_PUBLIC_EXTERNAL_CONTRACT_ADDRESS_BASE as Address | undefined,
        approvalSpender: process.env.NEXT_PUBLIC_APPROVAL_SPENDER_BASE as Address | undefined,
      },
      polygon: {
        proxy: process.env.NEXT_PUBLIC_PROXY_CONTRACT_ADDRESS_POLYGON as Address | undefined,
        token: process.env.NEXT_PUBLIC_DEMO_TOKEN_ADDRESS_POLYGON as Address | undefined,
        external: process.env.NEXT_PUBLIC_EXTERNAL_CONTRACT_ADDRESS_POLYGON as Address | undefined,
      },
      backend: {
        apiUrl: process.env.NEXT_PUBLIC_BACKEND_API_URL || "",
      },
    };
  }, []);

  async function buildPolygonSmartClient(): Promise<SmartWalletClient> {
    const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "";
    if (!apiKey) throw new Error("Missing NEXT_PUBLIC_ALCHEMY_API_KEY");
    if (!embeddedWallet) throw new Error("Wallet not ready");

    const provider = await (embeddedWallet as any).getEthereumProvider();

    const baseSigner = new WalletClientSigner(
      createWalletClient({
        account: embeddedWallet.address as Address,
        chain: polygonAmoyAk,
        transport: custom(provider),
      }),
      "privy"
    );

    const signer = {
      ...baseSigner,
      signAuthorization: async (unsignedAuth: any) => {
        const signature = await signAuthorization({
          ...unsignedAuth,
          contractAddress: unsignedAuth.address ?? unsignedAuth.contractAddress,
        });
        return { ...unsignedAuth, ...signature };
      },
    } as any;

    const polyClient = createSmartWalletClient({
      chain: polygonAmoyAk,
      transport: alchemy({ apiKey }),
      signer,
      policyId: process.env.NEXT_PUBLIC_ALCHEMY_POLICY_ID,
    });

    return polyClient;
  }

  async function ensurePolygonApprovalIfNeeded(owner: Address, spender: Address, token: Address, requiredAmount: bigint) {
    try {
      const provider = await (embeddedWallet as any)?.getEthereumProvider?.();
      if (!provider) {
        addLog(`Polygon approval: missing wallet provider`);
        return;
      }
      // Switch to Polygon Amoy (chainId 80002 / 0x13882) if needed
      try {
        await provider.request?.({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x13882" }],
        });
      } catch (e: any) {
        // If not added, attempt to add chain (best-effort)
        try {
          await provider.request?.({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0x13882",
              chainName: "Polygon Amoy",
              nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
              rpcUrls: [process.env.NEXT_PUBLIC_POLYGON_RPC_URL || ""].filter(Boolean),
              blockExplorerUrls: ["https://www.oklink.com/amoy"],
            }],
          });
        } catch {}
      }

      const publicClient = createPublicClient({
        chain: polygonAmoy,
        transport: custom(provider),
      });

      // Read allowance(owner, spender)
      const currentAllowance = await publicClient.readContract({
        address: token,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [owner, spender],
      });
      addLog(`Polygon allowance(owner=${owner}, spender=${spender}) = ${currentAllowance.toString()}`);

      if (currentAllowance >= requiredAmount) {
        addLog(`Polygon approval sufficient; no action needed`);
        return;
      }

      // Prepare approve(spender, requiredAmount)
      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [spender, requiredAmount],
      });

      // Send approval via Smart Wallet (gasless)
      const polyClient = await buildPolygonSmartClient();
      addLog(`Requesting gasless Polygon approval for amount=${requiredAmount.toString()} to spender=${spender}`);
      const { preparedCallIds } = await polyClient.sendCalls({
        capabilities: { eip7702Auth: true },
        from: owner,
        calls: [{ to: token, data: approveData }],
      });
      const callId = preparedCallIds?.[0];
      if (!callId) throw new Error("Polygon approval: missing call id");
      const { receipts } = await polyClient.waitForCallsStatus({ id: callId });
      const rcpt = receipts?.[0];
      addLog(`Polygon approval completed with status=${rcpt?.status || "unknown"}`);
    } catch (e: any) {
      const code = (e && (e.code ?? e.error?.code)) as any;
      const message = (e && (e.message || e.error?.message)) || String(e);
      if (code === 4001 || /user rejected|denied|rejected/i.test(message)) {
        const msg = "User rejected Polygon approval";
        addLog(msg);
        throw new Error(msg);
      }
      const msg = `Polygon approval error: ${message}`;
      addLog(msg);
      throw new Error(msg);
    }
  }

  const executeBaseDeposit = useCallback(
    async (amountStr: string) => {
      if (!client || !embeddedWallet) {
        setStatus({ phase: "error", message: "Wallet not ready" });
        return;
      }
      if (!env.base.token || !env.base.proxy) {
        setStatus({ phase: "error", message: "Base contract addresses not configured" });
        return;
      }
      try {
        addLog(`Mode=${mode}; API_URL=${env.backend.apiUrl || "(unset)"}`);
        setStatus({ phase: "approving-base", message: "Checking Polygon approval, then approving Base Proxy to spend DEMO" });
        addLog(`Preparing flow; target amount=${amountStr}`);
        const amount = parseEther(amountStr);
        const spender = (env.base.approvalSpender || env.base.proxy) as Address;

        // 1) Ensure Polygon approval first
        try {
          if (env.polygon?.token && env.polygon?.external) {
            await ensurePolygonApprovalIfNeeded(
              embeddedWallet.address as Address,
              env.polygon.external as Address,
              env.polygon.token as Address,
              amount
            );
          } else {
            addLog(`Polygon approval skipped: token or external contract not configured`);
          }
        } catch (e: any) {
          // error logged inside ensurePolygonApprovalIfNeeded; abort flow with specific reason
          const msg = e?.message || String(e);
          throw new Error(msg.startsWith("Polygon approval") || msg.startsWith("User rejected") ? msg : `Polygon approval failed: ${msg}`);
        }
        // Best-effort switch back to Base Sepolia (0x14A34) for UX clarity
        try {
          const provider = await (embeddedWallet as any)?.getEthereumProvider?.();
          await provider?.request?.({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x14A34" }],
          });
        } catch {}

        addLog(`Polygon approval ready; proceeding to Base approve + deposit`);

        // Some ERC-20s require setting allowance to 0 before changing to a new non-zero
        const approveZeroData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "approve",
          args: [spender, BigInt(0)],
        });
        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "approve",
          args: [spender, amount],
        });
        const depositData = encodeFunctionData({
          abi: PROXY_ABI_BASE,
          functionName: "depositeForBet",
          args: [amount],
        });
        const { preparedCallIds: [callId] } = await client.sendCalls({
          capabilities: { eip7702Auth: true },
          from: embeddedWallet.address as Address,
          calls: [
            { to: env.base.token, data: approveZeroData },
            { to: env.base.token, data: approveData },
            { to: env.base.proxy, data: depositData },
          ],
        });
        if (!callId) throw new Error("Missing call id");
        setStatus({ phase: "depositing-base", message: "Sending Base deposit..." });
        addLog(`Submitted batched calls, waiting for receipts...`);
        const { receipts } = await client.waitForCallsStatus({ id: callId });
        const receipt = receipts?.[0];
        if (!receipt || receipt.status !== "success") throw new Error("Deposit failed");
        const baseTxHash = receipt.transactionHash as string;
        addLog(`Base deposit confirmed: ${baseTxHash}`);

        if (mode === "api") {
          setStatus({ phase: "verifying", message: "Verifying on API...", baseTxHash });
          if (!env.backend.apiUrl) {
            addLog(`API mode selected but NEXT_PUBLIC_BACKEND_API_URL is not set`);
            throw new Error("Backend API URL not configured");
          }
          addLog(`API verification request -> ${env.backend.apiUrl}/api/verify-deposit tx=${baseTxHash}`);
          const res = await fetch(`${env.backend.apiUrl}/api/verify-deposit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              txHash: baseTxHash,
              userAddress: embeddedWallet.address,
            }),
          });
          addLog(`API response status: ${res.status}`);
          const text = await res.text();
          addLog(`API raw response: ${text}`);
          let json: any;
          try {
            json = JSON.parse(text);
          } catch {
            throw new Error(`Invalid JSON from API: ${text}`);
          }
          if (!json.success) {
            throw new Error(json.error || "Backend verification failed");
          }
          addLog(`API verification success; polygonTx=${json.polygonTxHash}`);
          setStatus({
            phase: "success",
            message: "Cross-chain execution completed",
            baseTxHash,
            polygonTxHash: json.polygonTxHash,
            amount: json.amount,
          });
        } else {
          // websocket mode: listener will push updates
          setStatus({
            phase: "executing-polygon",
            message: "Waiting for backend to detect deposit and execute on Polygon",
            baseTxHash,
          });
          addLog(`WS confirmation in progress; awaiting backend execution...`);
        }
        return baseTxHash;
      } catch (err: any) {
        setStatus({ phase: "error", message: err?.message || "Unknown error" });
        addLog(`Error: ${err?.message || String(err)}`);
        throw err;
      }
    },
    [client, embeddedWallet, env, mode]
  );

  return {
    mode,
    setMode,
    flow,
    setFlow,
    status,
    setStatus,
    executeBaseDeposit,
    env,
    logs,
    addLog,
  };
}


