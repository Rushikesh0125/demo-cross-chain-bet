import { Address, Authorization, createWalletClient, custom } from "viem";
import { useSign7702Authorization } from "@privy-io/react-auth";
import { AuthorizationRequest, WalletClientSigner } from "@aa-sdk/core";
import { baseSepolia, alchemy } from "@account-kit/infra";
import { useEffect, useState } from "react";
import {
  createSmartWalletClient,
  SmartWalletClient,
} from "@account-kit/wallet-client";
import { ConnectedWallet as PrivyWallet } from "@privy-io/react-auth";

/** Creates an Alchemy Smart Wallet client for an embedded Privy wallet using EIP-7702. */
export const useSmartEmbeddedWallet = ({
  embeddedWallet,
}: {
  embeddedWallet: PrivyWallet;
}) => {
  const { signAuthorization } = useSign7702Authorization();
  const [client, setClient] = useState<SmartWalletClient>();

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
    if (!apiKey) {
      throw new Error("Missing NEXT_PUBLIC_ALCHEMY_API_KEY");
    }
    (async () => {
      const provider = await embeddedWallet.getEthereumProvider();

      const baseSigner = new WalletClientSigner(
        createWalletClient({
          account: embeddedWallet.address as Address,
          chain: baseSepolia,
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
            contractAddress:
              unsignedAuth.address ?? unsignedAuth.contractAddress,
          });

          return {
            ...unsignedAuth,
            ...signature,
          };
        },
      };

      const client = createSmartWalletClient({
        chain: baseSepolia,
        transport: alchemy({
          apiKey,
        }),
        signer,
        policyId: process.env.NEXT_PUBLIC_ALCHEMY_POLICY_ID,
      });

      setClient(client);
    })();
  }, [embeddedWallet, signAuthorization]);

  return { client };
};
