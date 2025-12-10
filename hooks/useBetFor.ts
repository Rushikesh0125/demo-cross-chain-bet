// hooks/useBetFor.ts
import { useState } from 'react';
import { encodeFunctionData, parseEther, Address } from 'viem';
import { useSmartAccountClient } from '@account-kit/react';

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
  }
] as const;

// ABI for Proxy betFor function
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
  }
] as const;

interface UseBetForProps {
  demoTokenAddress: Address;
  externalContractAddress: Address;
  proxyContractAddress: Address;
}

export function useBetFor({
  demoTokenAddress,
  externalContractAddress,
  proxyContractAddress
}: UseBetForProps) {
  const { client } = useSmartAccountClient({ type: 'MultiOwnerModularAccount' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const executeBetFor = async (betOwner: Address, amountInEth: string) => {
    if (!client) {
      setError('Smart account client not initialized');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setTxHash(null);

      const amount = parseEther(amountInEth);

      // Encode the approve call data
      const approveCallData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [externalContractAddress, amount]
      });

      // Encode the betFor call data
      const betForCallData = encodeFunctionData({
        abi: PROXY_ABI,
        functionName: 'betFor',
        args: [betOwner, amount]
      });

      // Batch both transactions together
      const userOpHash = await client.sendUserOperation({
        uo: [
          {
            target: demoTokenAddress,
            data: approveCallData,
            value: 0n
          },
          {
            target: proxyContractAddress,
            data: betForCallData,
            value: 0n
          }
        ]
      });

      console.log('UserOperation hash:', userOpHash);

      // Wait for the transaction to be mined
      const txHashResult = await client.waitForUserOperationTransaction({
        hash: userOpHash.hash
      });

      setTxHash(txHashResult);
      console.log('Transaction hash:', txHashResult);

      return txHashResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error executing betFor:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    executeBetFor,
    isLoading,
    error,
    txHash
  };
}