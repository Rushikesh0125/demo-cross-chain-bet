import dotenv from "dotenv";
dotenv.config();

export const CONFIG = {
  wsPort: Number(process.env.WS_PORT || 3001),
  baseRpcUrl: process.env.BASE_RPC_URL || "",
  baseWsUrl: process.env.BASE_WS_URL || "",
  polygonRpcUrl: process.env.POLYGON_RPC_URL || "",
  polygonWsUrl: process.env.POLYGON_WS_URL || "",
  backendPrivateKey: process.env.BACKEND_WALLET_PRIVATE_KEY || "",
  baseProxyAddress: (process.env.BASE_PROXY_ADDRESS || "").toLowerCase(),
  baseEventAddress: (process.env.BASE_EVENT_ADDRESS || "").toLowerCase(),
  polygonProxyAddress: (process.env.POLYGON_PROXY_ADDRESS || "").toLowerCase(),
  polygonDemoTokenAddress: (process.env.POLYGON_DEMO_TOKEN_ADDRESS || "").toLowerCase(),
};

export const ABIS = {
  // Minimal fragments needed by this service
  proxyBase: [
    // Support either event name, depending on deployed contract
    // event DepositedForBridge(address indexed user, uint256 amount)
    {
      type: "event",
      name: "DepositedForBridge",
      inputs: [
        { indexed: true, name: "user", type: "address" },
        { indexed: false, name: "amount", type: "uint256" },
      ],
    },
    // event DepositedForBet(address indexed user, uint256 amount)
    {
      type: "event",
      name: "DepositedForBet",
      inputs: [
        { indexed: true, name: "user", type: "address" },
        { indexed: false, name: "amount", type: "uint256" },
      ],
    },
    // Alternate spelling in some deployments: event DepositeForBet(address indexed user, uint256 amount)
    {
      type: "event",
      name: "DepositeForBet",
      inputs: [
        { indexed: true, name: "user", type: "address" },
        { indexed: false, name: "amount", type: "uint256" },
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


