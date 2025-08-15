import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { DynamicWidget } from "@dynamic-labs/sdk-react-core";

export default function DynamicProvider({ children }) {
  return (
    <DynamicContextProvider
      settings={{
        environmentId: "67e2afd1-e964-468e-8202-268c18647b34",
        walletConnectors: [
          EthereumWalletConnectors,
        ],
        eventsCallbacks: {
          onEmbeddedWalletCreated: (args) => {
            console.log("Embedded wallet created:", args);
          },
          onWalletAdded: (args) => {
            console.log("Wallet added:", args);
          },
          onAuthSuccess: (args) => {
            console.log("Auth success:", args);
          },
          onConnect: (args) => {
            console.log("Wallet connected:", args);
          }
        }
      }}
    >
      {children}
      <DynamicWidget />
    </DynamicContextProvider>
  );
}
