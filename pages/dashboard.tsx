import { useRouter } from "next/router";
import { useEffect } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import Head from "next/head";
import { SmartWalletDemo } from "../components/smart-wallet-demo";

export default function DashboardPage() {
  const router = useRouter();
  const { ready, authenticated, logout } = usePrivy();

  const { wallets } = useWallets();
  const embeddedWallet = wallets.find((x) => x.walletClientType === "privy");

  useEffect(() => {
    if (ready && !authenticated) {
      router.push("/");
    }
  }, [ready, authenticated, router]);

  return (
    <div>
      <Head>
        <title>Alchemy Smart Wallets + EIP-7702</title>
      </Head>

      <main className="min-h-screen px-4 sm:px-20 py-6 sm:py-10 bg-gradient-to-br from-blue-50 to-indigo-100">
        {ready && authenticated && (
          <div className="max-w-3xl mx-auto">
            <header className="flex flex-row justify-between items-center mb-8">
              <h1 className="text-3xl font-bold text-indigo-900">
                Alchemy Smart Wallets + EIP-7702
              </h1>
              <button
                onClick={logout}
                className="text-sm bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Logout
              </button>
            </header>

            <section className="bg-white rounded-xl shadow-lg p-6 mb-8">
              <p className="text-gray-700 mb-4">
                This demo showcases how to upgrade an existing embedded Privy
                EOA to a smart wallet using Alchemy's EIP-7702 support to send
                sponsored transactions from an EOA. Learn more about EIP-7702{" "}
                <a
                  href="https://www.alchemy.com/docs/wallets/transactions/using-eip-7702"
                  className="text-indigo-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  here
                </a>
                .
              </p>
              {embeddedWallet && (
                <SmartWalletDemo embeddedWallet={embeddedWallet} />
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
