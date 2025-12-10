import { ConnectedWallet as PrivyWallet } from "@privy-io/react-auth";
import { useSmartEmbeddedWallet } from "../hooks/use-smart-embedded-wallet";
import { useCallback, useEffect, useState } from "react";
import type { Address, Hex } from "viem";
import { encodeFunctionData, parseEther, createWalletClient, custom, createPublicClient, http } from "viem";
import { CrossChainBetting } from "./CrossChainBetting";
import { useToast } from "./ToastProvider";
import { polygonAmoy as polygonAmoyAk, alchemy } from "@account-kit/infra";
import {
  createSmartWalletClient,
  SmartWalletClient,
} from "@account-kit/wallet-client";
import { WalletClientSigner } from "@aa-sdk/core";
import { useSign7702Authorization } from "@privy-io/react-auth";
import type { AuthorizationRequest, Authorization } from "@aa-sdk/core";

// Contract addresses from environment variables
const DEMO_TOKEN_ADDRESS =
  (process.env.NEXT_PUBLIC_DEMO_TOKEN_ADDRESS ||
    process.env.NEXT_PUBLIC_DEMO_TOKEN_ADDRESS_POLYGON ||
    process.env.NEXT_PUBLIC_DEMO_TOKEN_ADDRESS_BASE) as Address | undefined;
const EXTERNAL_CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_EXTERNAL_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_EXTERNAL_CONTRACT_ADDRESS_POLYGON ||
    process.env.NEXT_PUBLIC_EXTERNAL_CONTRACT_ADDRESS_BASE) as Address | undefined;
const PROXY_CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_PROXY_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_PROXY_CONTRACT_ADDRESS_POLYGON ||
    process.env.NEXT_PUBLIC_PROXY_CONTRACT_ADDRESS_BASE) as Address | undefined;

// ABI for ERC20 approve function
const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' }
    ],
    outputs: [{ name: 'balance', type: 'uint256' }]
  }
] as const;

// ABI for Proxy contract functions
const PROXY_ABI = [
  {
    name: 'betFor',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'betOwner', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: []
  },
  {
    name: 'withdrawPayout',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' }
    ],
    outputs: []
  },
  {
    name: 'depositeForBridge',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' }
    ],
    outputs: []
  }
] as const;

export const SmartWalletDemo = ({
  embeddedWallet,
}: {
  embeddedWallet: PrivyWallet;
}) => {
  const { client } = useSmartEmbeddedWallet({ embeddedWallet });
  const toast = useToast();
  const { signAuthorization } = useSign7702Authorization();

  const [status, setStatus] = useState<
    | { status: "idle" | "error" | "sending" }
    | { status: "success"; txHash: Hex }
  >({ status: "idle" });

  // BetFor specific state
  const [betAmount, setBetAmount] = useState("");
  const [betOwner, setBetOwner] = useState("");

  // Withdraw & Bridge specific state
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [bridgeAmount, setBridgeAmount] = useState("");

  const delegateAndSend = useCallback(async () => {
    if (!client) {
      return;
    }

    setStatus({ status: "sending" });
    try {
      const {
        preparedCallIds: [callId],
      } = await client.sendCalls({
        capabilities: {
          eip7702Auth: true,
        },
        from: embeddedWallet.address as Address,
        calls: [
          {
            to: "0x0000000000000000000000000000000000000000",
            data: "0x",
          },
        ],
      });
      if (!callId) {
        throw new Error("Missing call id");
      }

      const { receipts } = await client.waitForCallsStatus({ id: callId });
      if (!receipts?.length) {
        throw new Error("Missing transaction receipts");
      }
      const [receipt] = receipts;
      if (receipt?.status !== "success") {
        throw new Error("Transaction failed");
      }
      setStatus({ status: "success", txHash: receipt.transactionHash });
    } catch (err) {
      console.error("Transaction failed:", err);
      setStatus({ status: "error" });
    }
  }, [client, embeddedWallet]);

  // BetFor batched transaction
  const executeBetFor = useCallback(async () => {
    if (!client || !betAmount || !betOwner) {
      alert("Please fill in all fields");
      return;
    }

    if (!DEMO_TOKEN_ADDRESS || !EXTERNAL_CONTRACT_ADDRESS || !PROXY_CONTRACT_ADDRESS) {
      toast.error("Contract addresses are not configured. Check your .env.local.");
      return;
    }

    setStatus({ status: "sending" });
    try {
      const amount = parseEther(betAmount);

      // Encode the approve call data
      const approveCallData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [EXTERNAL_CONTRACT_ADDRESS, amount]
      });

      // Encode the betFor call data
      const betForCallData = encodeFunctionData({
        abi: PROXY_ABI,
        functionName: 'betFor',
        args: [betOwner as Address, amount]
      });

      // Send batched calls with EIP-7702
      const {
        preparedCallIds: [callId],
      } = await client.sendCalls({
        capabilities: {
          eip7702Auth: true,
        },
        from: embeddedWallet.address as Address,
        calls: [
          {
            to: DEMO_TOKEN_ADDRESS as Address,
            data: approveCallData,
          },
          {
            to: PROXY_CONTRACT_ADDRESS as Address,
            data: betForCallData,
          },
        ],
      });

      if (!callId) {
        throw new Error("Missing call id");
      }

      const { receipts } = await client.waitForCallsStatus({ id: callId });
      if (!receipts?.length) {
        throw new Error("Missing transaction receipts");
      }
      const [receipt] = receipts;
      if (receipt?.status !== "success") {
        throw new Error("Transaction failed");
      }
      setStatus({ status: "success", txHash: receipt.transactionHash });
    } catch (err) {
      console.error("BetFor transaction failed:", err);
      setStatus({ status: "error" });
    }
  }, [client, embeddedWallet, betAmount, betOwner]);

  // New: Withdraw & Bridge batched transaction
  const executeWithdrawAndBridge = useCallback(async () => {
    if (!withdrawAddress || !bridgeAmount) {
      alert("Please fill in all fields");
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "";
    if (!apiKey) {
      toast.error("Missing NEXT_PUBLIC_ALCHEMY_API_KEY");
      return;
    }

    const POLY_TOKEN = process.env.NEXT_PUBLIC_DEMO_TOKEN_ADDRESS_POLYGON as Address | undefined;
    const POLY_PROXY = process.env.NEXT_PUBLIC_PROXY_CONTRACT_ADDRESS_POLYGON as Address | undefined;
    if (!POLY_TOKEN || !POLY_PROXY) {
      toast.error("Polygon addresses not configured. Set *_POLYGON env vars.");
      return;
    }

    setStatus({ status: "sending" });
    try {
      // Ensure provider present and attempt to switch for clarity (not required for gasless)
      const provider = await (embeddedWallet as any)?.getEthereumProvider?.();
      try {
        await provider?.request?.({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x13882" }], // Polygon Amoy
        });
      } catch {}

      // Build Polygon Amoy smart wallet client
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
        signAuthorization: async (
          unsignedAuth: AuthorizationRequest<number>
        ): Promise<Authorization<number, true>> => {
          const signature = await signAuthorization({
            ...unsignedAuth,
            contractAddress: unsignedAuth.address ?? unsignedAuth.contractAddress,
          });
          return {
            ...unsignedAuth,
            ...signature,
          };
        },
      } as any;
      const polygonClient: SmartWalletClient = createSmartWalletClient({
        chain: polygonAmoyAk,
        transport: alchemy({ apiKey }),
        signer,
        policyId: process.env.NEXT_PUBLIC_ALCHEMY_POLICY_ID,
      });

      const amount = parseEther(bridgeAmount);

      // 1) withdrawPayout(to)
      const withdrawCallData = encodeFunctionData({
        abi: PROXY_ABI,
        functionName: 'withdrawPayout',
        args: [withdrawAddress as Address],
      });

      // 2) approve(PROXY, amount)
      const approveCallData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [POLY_PROXY as Address, amount],
      });

      // 3) depositeForBridge(amount)
      const bridgeCallData = encodeFunctionData({
        abi: PROXY_ABI,
        functionName: 'depositeForBridge',
        args: [amount],
      });

      // Preflight: simulate withdraw and check token balance (if withdraw not possible)
      let skipWithdraw = false;
      try {
        const publicClient = createPublicClient({
          chain: polygonAmoyAk,
          transport: http(`https://polygon-amoy.g.alchemy.com/v2/${apiKey}`),
        });
        // Try a static call of withdraw to detect immediate reverts
        await publicClient.call({
          to: POLY_PROXY as Address,
          data: withdrawCallData,
          account: embeddedWallet.address as Address,
        });
      } catch {
        skipWithdraw = true;
      }
      if (skipWithdraw) {
        try {
          const publicClient = createPublicClient({
            chain: polygonAmoyAk,
            transport: http(`https://polygon-amoy.g.alchemy.com/v2/${apiKey}`),
          });
          const balance = (await publicClient.readContract({
            address: POLY_TOKEN as Address,
            abi: ERC20_ABI as any,
            functionName: 'balanceOf',
            args: [embeddedWallet.address as Address],
          })) as bigint;
          if (balance < amount) {
            toast.error("No payout available and insufficient token balance to bridge this amount.");
            setStatus({ status: "idle" });
            return;
          }
        } catch {
          // Continue; the batch may still provide an error if something is wrong
        }
      }

      // Send batched calls with EIP-7702
      const {
        preparedCallIds: [callId],
      } = await polygonClient.sendCalls({
        capabilities: {
          eip7702Auth: true,
        },
        from: embeddedWallet.address as Address,
        calls: [
          ...(skipWithdraw
            ? []
            : [
                {
                  to: POLY_PROXY as Address,
                  data: withdrawCallData,
                },
              ]),
          {
            to: POLY_TOKEN as Address,
            data: approveCallData,
          },
          {
            to: POLY_PROXY as Address,
            data: bridgeCallData,
          },
        ],
      });

      if (!callId) {
        throw new Error("Missing call id");
      }

      const { receipts } = await polygonClient.waitForCallsStatus({ id: callId });
      if (!receipts?.length) {
        throw new Error("Missing transaction receipts");
      }
      const [receipt] = receipts;
      if (receipt?.status !== "success") {
        throw new Error("Transaction failed");
      }
      setStatus({ status: "success", txHash: receipt.transactionHash });
    } catch (err) {
      console.error("Withdraw & Bridge transaction failed:", err);
      setStatus({ status: "error" });
    }
  }, [client, embeddedWallet, withdrawAddress, bridgeAmount]);

  const handleSetCurrentUserBet = () => {
    setBetOwner(embeddedWallet.address);
  };

  const handleSetCurrentUserWithdraw = () => {
    setWithdrawAddress(embeddedWallet.address);
  };

  useEffect(() => {
    if (status.status === "success") {
      toast.success("Transaction confirmed!");
    } else if (status.status === "error") {
      toast.error("Transaction failed. Please try again.");
    }
    // Only react to status changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.status]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Embedded EOA Address
        </h2>
        <p className="text-gray-600 font-mono break-all">
          {embeddedWallet.address}
        </p>
      </div>

      {/* Original Demo Button */}
      <div className="border-b pb-6">
        <h3 className="text-md font-semibold text-gray-800 mb-3">
          1. Test Basic Sponsored Transaction
        </h3>
        <button
          onClick={delegateAndSend}
          disabled={!client || status.status === "sending"}
          className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
            status.status === "sending"
              ? "bg-indigo-400 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {status.status === "sending"
            ? "Sending..."
            : "Upgrade & Send Sponsored Transaction"}
        </button>
      </div>

      {/* BetFor Section */}
      <div className="border-b pb-6">
        <h3 className="text-md font-semibold text-gray-800 mb-3">
          2. Place Bet (Batched Transaction)
        </h3>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="betOwner" className="block text-sm font-medium text-gray-700 mb-2">
              Bet Owner Address
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="betOwner"
                value={betOwner}
                onChange={(e) => setBetOwner(e.target.value)}
                placeholder="0x..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
              />
              <button
                type="button"
                onClick={handleSetCurrentUserBet}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors whitespace-nowrap text-sm"
              >
                Use My Address
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="betAmount" className="block text-sm font-medium text-gray-700 mb-2">
              Bet Amount (in DEMO tokens)
            </label>
            <input
              type="text"
              id="betAmount"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              placeholder="1.0"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <p className="text-sm text-blue-800 font-semibold mb-2">
              This will batch 2 transactions:
            </p>
            <ol className="text-sm text-blue-700 ml-4 list-decimal space-y-1">
              <li>Approve External contract to spend {betAmount || '0'} DEMO tokens</li>
              <li>Call betFor function on Proxy contract</li>
            </ol>
          </div>

          <button
            onClick={executeBetFor}
            disabled={!client || status.status === "sending" || !betAmount || !betOwner}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
              status.status === "sending" || !betAmount || !betOwner
                ? "bg-indigo-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {status.status === "sending"
              ? "Processing..."
              : "Place Bet (Sponsored & Batched)"}
          </button>
        </div>
      </div>

      {/* NEW: Withdraw & Bridge Section */}
      <div className="border-b pb-6">
        <h3 className="text-md font-semibold text-gray-800 mb-3">
          3. Withdraw & Bridge (Batched Transaction)
        </h3>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="withdrawAddress" className="block text-sm font-medium text-gray-700 mb-2">
              Withdraw To Address
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="withdrawAddress"
                value={withdrawAddress}
                onChange={(e) => setWithdrawAddress(e.target.value)}
                placeholder="0x..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
              />
              <button
                type="button"
                onClick={handleSetCurrentUserWithdraw}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors whitespace-nowrap text-sm"
              >
                Use My Address
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="bridgeAmount" className="block text-sm font-medium text-gray-700 mb-2">
              Bridge Amount (in DEMO tokens)
            </label>
            <input
              type="text"
              id="bridgeAmount"
              value={bridgeAmount}
              onChange={(e) => setBridgeAmount(e.target.value)}
              placeholder="1.0"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
            />
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-md p-4">
            <p className="text-sm text-purple-800 font-semibold mb-2">
              This will batch 3 transactions:
            </p>
            <ol className="text-sm text-purple-700 ml-4 list-decimal space-y-1">
              <li>Withdraw payout from External to {withdrawAddress || 'address'}</li>
              <li>Approve Proxy contract to spend {bridgeAmount || '0'} DEMO tokens</li>
              <li>Deposit {bridgeAmount || '0'} tokens to Proxy for bridge</li>
            </ol>
          </div>

          <button
            onClick={executeWithdrawAndBridge}
            disabled={!client || status.status === "sending" || !withdrawAddress || !bridgeAmount}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
              status.status === "sending" || !withdrawAddress || !bridgeAmount
                ? "bg-purple-400 cursor-not-allowed"
                : "bg-purple-600 hover:bg-purple-700"
            }`}
          >
            {status.status === "sending"
              ? "Processing..."
              : "Withdraw & Bridge (Sponsored & Batched)"}
          </button>
        </div>
      </div>

      {/* Cross-Chain Betting Section */}
      <div className="border-b pb-6">
        <h3 className="text-md font-semibold text-gray-800 mb-3">
          4. Cross-Chain Betting (Base → Polygon)
        </h3>
        <CrossChainBetting embeddedWallet={embeddedWallet} />
      </div>

      {/* Contract Addresses Info */}
      <div className="p-4 bg-gray-50 rounded-md">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Contract Addresses:</h4>
        <div className="space-y-1 text-xs text-gray-600 break-all">
          <p><strong>Demo Token:</strong> {DEMO_TOKEN_ADDRESS || 'Not set in .env'}</p>
          <p><strong>External:</strong> {EXTERNAL_CONTRACT_ADDRESS || 'Not set in .env'}</p>
          <p><strong>Proxy:</strong> {PROXY_CONTRACT_ADDRESS || 'Not set in .env'}</p>
        </div>
      </div>

      {/* Success Message */}
      {status.status === "success" && (
        <section className="bg-green-50 rounded-xl shadow-lg p-6 border border-green-200">
          <h2 className="text-lg font-semibold text-green-900 mb-4">
            Congrats! Sponsored transaction successful!
          </h2>
          <p className="text-green-700 mb-4">
            You've successfully executed a sponsored transaction with your upgraded EOA.{" "}
            <a
              href="https://www.alchemy.com/docs/wallets/react/using-7702"
              className="text-indigo-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Keep building
            </a>
            .
          </p>
          <p className="text-green-700 mb-2">
            <strong>Transaction Hash:</strong>
          </p>
          <a
            href={`https://sepolia.etherscan.io/tx/${status.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-sm break-all text-indigo-600 hover:underline"
          >
            {status.txHash}
          </a>
        </section>
      )}

      {/* Error Message */}
      {status.status === "error" && (
        <section className="bg-red-50 rounded-xl shadow-lg p-6 border border-red-200">
          <h2 className="text-lg font-semibold text-red-900 mb-4">
            Transaction Failed
          </h2>
          <p className="text-red-700">
            There was an error sending your sponsored transaction. Please try again.
          </p>
        </section>
      )}
    </div>
  );
};