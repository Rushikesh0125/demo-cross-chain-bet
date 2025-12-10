import dotenv from "dotenv";
dotenv.config();

export const CONFIG = {
  port: Number(process.env.API_PORT || 3002),
  baseRpcUrl: process.env.BASE_RPC_URL || "",
  polygonRpcUrl: process.env.POLYGON_RPC_URL || "",
  backendPrivateKey: process.env.BACKEND_WALLET_PRIVATE_KEY || "",
  baseProxyAddress: (process.env.BASE_PROXY_ADDRESS || "").toLowerCase(),
  polygonProxyAddress: (process.env.POLYGON_PROXY_ADDRESS || "").toLowerCase(),
  polygonDemoTokenAddress: (process.env.POLYGON_DEMO_TOKEN_ADDRESS || "").toLowerCase(),
};

export const ABIS = {
  proxyBase: [
    // functions/events used to verify deposits
    {
      type: "event",
      name: "DepositedForBridge",
      inputs: [
        { indexed: true, name: "user", type: "address" },
        { indexed: false, name: "amount", type: "uint256" },
      ],
    },
    // Variant where amount is indexed
    {
      type: "event",
      name: "DepositedForBridge",
      inputs: [
        { indexed: true, name: "user", type: "address" },
        { indexed: true, name: "amount", type: "uint256" },
      ],
    },
    // Support alternative event name if the deployed contract emits DepositedForBet
    {
      type: "event",
      name: "DepositedForBet",
      inputs: [
        { indexed: true, name: "user", type: "address" },
        { indexed: false, name: "amount", type: "uint256" },
      ],
    },
    // Variant where amount is indexed (DepositedForBet)
    {
      type: "event",
      name: "DepositedForBet",
      inputs: [
        { indexed: true, name: "user", type: "address" },
        { indexed: true, name: "amount", type: "uint256" },
      ],
    },
    // Support exact contract event spelling: DepositeForBet
    {
      type: "event",
      name: "DepositeForBet",
      inputs: [
        { indexed: true, name: "user", type: "address" },
        { indexed: false, name: "amount", type: "uint256" },
      ],
    },
    // Variant where amount is indexed (DepositeForBet)
    {
      type: "event",
      name: "DepositeForBet",
      inputs: [
        { indexed: true, name: "user", type: "address" },
        { indexed: true, name: "amount", type: "uint256" },
      ],
    },
  ],
  proxyPolygon: [
    {
      type: "function",
      name: "betFor",
      stateMutability: "nonpayable",
      inputs: [
        { name: "betOwner", type: "address" },
        { name: "amount", type: "uint256" },
      ],
      outputs: [],
    },
  ],
  erc20: [
    {
      type: "function",
      name: "approve",
      stateMutability: "nonpayable",
      inputs: [
        { name: "spender", type: "address" },
        { name: "amount", type: "uint256" },
      ],
      outputs: [{ name: "", type: "bool" }],
    },
    {
      type: "function",
      name: "allowance",
      stateMutability: "view",
      inputs: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
      ],
      outputs: [{ name: "", type: "uint256" }],
    },
  ],
};


