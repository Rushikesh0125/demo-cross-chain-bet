// components/BetForComponent.tsx
import { useState } from 'react';
import { useBetFor } from '../hooks/useBetFor';
import { Address } from 'viem';
import { useUser } from '@account-kit/react';

// Add your contract addresses from environment variables
const DEMO_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_DEMO_TOKEN_ADDRESS as Address;
const EXTERNAL_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_EXTERNAL_CONTRACT_ADDRESS as Address;
const PROXY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PROXY_CONTRACT_ADDRESS as Address;

export function BetForComponent() {
  const user = useUser();
  const [betAmount, setBetAmount] = useState('');
  const [betOwner, setBetOwner] = useState('');

  const { executeBetFor, isLoading, error, txHash } = useBetFor({
    demoTokenAddress: DEMO_TOKEN_ADDRESS,
    externalContractAddress: EXTERNAL_CONTRACT_ADDRESS,
    proxyContractAddress: PROXY_CONTRACT_ADDRESS
  });

  // Auto-populate bet owner with current user's address
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!betAmount || !betOwner) {
      alert('Please fill in all fields');
      return;
    }

    try {
      await executeBetFor(betOwner as Address, betAmount);
    } catch (err) {
      console.error('Transaction failed:', err);
    }
  };

  // Set current user as bet owner by default
  const handleSetCurrentUser = () => {
    if (user?.address) {
      setBetOwner(user.address);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Place Bet (Batched Transaction)</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
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
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <button
              type="button"
              onClick={handleSetCurrentUser}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
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
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <p className="text-sm text-blue-800">
            <strong>This will batch 2 transactions:</strong>
          </p>
          <ol className="text-sm text-blue-700 mt-2 ml-4 list-decimal">
            <li>Approve External contract to spend {betAmount || '0'} DEMO tokens</li>
            <li>Call betFor function on Proxy contract</li>
          </ol>
        </div>

        <button
          type="submit"
          disabled={isLoading || !betAmount || !betOwner}
          className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Processing...' : 'Place Bet (Batched)'}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">
            <strong>Error:</strong> {error}
          </p>
        </div>
      )}

      {txHash && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800 mb-2">
            <strong>Success!</strong> Transaction confirmed
          </p>
          <a
            href={`https://sepolia.etherscan.io/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline break-all"
          >
            View on Etherscan: {txHash}
          </a>
        </div>
      )}

      <div className="mt-6 p-4 bg-gray-50 rounded-md">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Contract Addresses:</h3>
        <div className="space-y-1 text-xs text-gray-600">
          <p><strong>Demo Token:</strong> {DEMO_TOKEN_ADDRESS}</p>
          <p><strong>External:</strong> {EXTERNAL_CONTRACT_ADDRESS}</p>
          <p><strong>Proxy:</strong> {PROXY_CONTRACT_ADDRESS}</p>
        </div>
      </div>
    </div>
  );
}