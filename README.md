# Using Alchemy Smart Wallets with EIP-7702 to upgrade a Privy Embedded EOA

This is an example repository using Alchemy's Smart Wallet EIP-7702 support to upgrade an existing Privy embedded EOA. This enables features like gas sponsorship, batching, and more. This guide assumes you have already integrated with Privy and have existing embedded EOAs that you'd like to upgrade.

If you are looking for end-to-end embedded smart wallets for social login, gas sponsorship, batching and more, check out [Smart Wallets](https://www.alchemy.com/docs/wallets/).

Check out our [full guide](https://www.alchemy.com/docs/wallets/smart-contracts/modular-account-v2/using-7702) on using EIP-7702 to upgrade existing embedded EOAs with Alchemy Smart Wallets.

## Setup

1. Clone this repository and open it in your terminal. 
```sh
git clone https://github.com/avarobinson/alchemy-wallets-7702-thirdparty-example.git
```

2. Install the necessary dependencies with `npm`.
```sh
npm i 
```

3. Initialize your environment variables by copying the `.env.example` file to an `.env.local` file. Then, in `.env.local` paste
   - your [Alchemy API Key](https://dashboard.alchemy.com/apps)
   - you Alchemy [gas sponsorship policy ID](https://dashboard.alchemy.com/services/gas-manager/overview) (this is where you will define how you want to sponsor gas for your users)
   - your Privy App ID
```sh
# In your terminal, create .env.local from .env.example
cp .env.example .env.local
```

## Building locally

In your project directory, run `npm run dev`. You can now visit http://localhost:3000 to see your app. 

Login with socials, delegate your embedded EOA to a smart account, and send a sponsored transaction from your EOA!

**Check out [our docs](https://accountkit.alchemy.com/react/using-7702) for more guidance around using EIP-7702 with smart wallets!**

## Cross-Chain Betting (Base Sepolia → Polygon) Setup

This repo includes a backend WebSocket listener and an API service to enable cross-chain flows:

- WebSocket Listener: detects `DepositedForBridge` events on Base and triggers Polygon execution
- API Service: verifies a Base tx hash and executes on Polygon

### Frontend environment (.env.local)

Add the following variables:

```
# Existing
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key
NEXT_PUBLIC_ALCHEMY_POLICY_ID=your_policy_id
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id

# Polygon (existing in app)
NEXT_PUBLIC_DEMO_TOKEN_ADDRESS_POLYGON=0xPolygonDemoToken
NEXT_PUBLIC_EXTERNAL_CONTRACT_ADDRESS_POLYGON=0xPolygonExternal
NEXT_PUBLIC_PROXY_CONTRACT_ADDRESS_POLYGON=0xPolygonProxy

# Base Sepolia (new)
NEXT_PUBLIC_PROXY_CONTRACT_ADDRESS_BASE=0xBaseProxy
NEXT_PUBLIC_DEMO_TOKEN_ADDRESS_BASE=0xBaseDemoToken

# Backend URLs
NEXT_PUBLIC_BACKEND_WEBSOCKET_URL=ws://localhost:3001
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3002
```

Note: legacy single-chain envs used elsewhere in the app:
`NEXT_PUBLIC_DEMO_TOKEN_ADDRESS`, `NEXT_PUBLIC_EXTERNAL_CONTRACT_ADDRESS`, `NEXT_PUBLIC_PROXY_CONTRACT_ADDRESS`.

### Backend setup

Install and run both backend services:

```
# WebSocket listener
cd backend/websocket-listener
npm i
WS_PORT=3001 \
BASE_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY \
POLYGON_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY \
BACKEND_WALLET_PRIVATE_KEY=0xYOUR_PK \
BASE_PROXY_ADDRESS=0xBaseProxy \
POLYGON_PROXY_ADDRESS=0xPolygonProxy \
POLYGON_DEMO_TOKEN_ADDRESS=0xPolygonDemoToken \
npm run dev

# API service
cd ../api-service
npm i
API_PORT=3002 \
BASE_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY \
POLYGON_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY \
BACKEND_WALLET_PRIVATE_KEY=0xYOUR_PK \
BASE_PROXY_ADDRESS=0xBaseProxy \
POLYGON_PROXY_ADDRESS=0xPolygonProxy \
POLYGON_DEMO_TOKEN_ADDRESS=0xPolygonDemoToken \
npm run dev
```

Required contracts:
- Base Proxy: emits `DepositedForBridge(address user, uint256 amount)` and has `depositForBet(uint256 amount)`
- Polygon Proxy: has `betFor(address betOwner, uint256 amount)`
- ERC20 DEMO token on both chains

### Using the UI

Open the app and find section:
- “4. Cross-Chain Betting (Base → Polygon)”
  - Choose mode: WebSocket (auto by backend) or API (verify tx hash)
  - Click “Approve + Deposit on Base”
  - In WebSocket mode, backend will execute on Polygon and UI will update in real-time
  - In API mode, UI will POST `txHash` to backend which verifies and executes

### Security Notes

- Backend wallet only sends Polygon transactions
- Protect `BACKEND_WALLET_PRIVATE_KEY`; use env files or secret stores
- Consider adding signature authorization, rate limiting, and nonce management for production