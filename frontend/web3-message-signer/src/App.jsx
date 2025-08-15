import { useDynamicContext, useEmbeddedWallet } from "@dynamic-labs/sdk-react-core";
import { useState, useEffect } from "react";
import { ethers } from "ethers";

// Helper function to try different signing formats
const trySignMessage = async (signer, message, methodName) => {
  try {
    // Try object format first
    const sig = await signer.signMessage({ message });
    console.log(`✅ ${methodName} successful with object format:`, sig);
    return sig;
  } catch (err1) {
    console.log(`${methodName} with object format failed, trying string format...`, err1);
    try {
      // Try string format
      const sig = await signer.signMessage(message);
      console.log(`✅ ${methodName} successful with string format:`, sig);
      return sig;
    } catch (err2) {
      console.log(`${methodName} with string format also failed:`, err2);
      throw err2;
    }
  }
};

export default function App() {
  const { user, setShowAuthFlow, primaryWallet, handleLogOut } = useDynamicContext();
  const { signMessage: embeddedSignMessage } = useEmbeddedWallet();

  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState("");
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem("signHistory") || "[]"));
  const [verification, setVerification] = useState(null);
  const [isSigning, setIsSigning] = useState(false);
  const [historyVerifications, setHistoryVerifications] = useState({});

  useEffect(() => {
    localStorage.setItem("signHistory", JSON.stringify(history));
  }, [history]);

  const handleSign = async () => {
    if (!primaryWallet) {
      alert("Please connect a wallet first.");
      return;
    }
    if (!message) {
      alert("Enter a message first.");
      return;
    }
  
    try {
      setIsSigning(true);
      setSignature("");
      setVerification(null);
      
      console.log("Attempting to sign message:", message);
      console.log("Wallet structure:", {
        address: primaryWallet.address,
        connector: primaryWallet.connector,
        connectorName: primaryWallet.connector?.name,
        hasSignMessage: !!primaryWallet.connector?.signMessage,
        hasGetSigner: !!primaryWallet.connector?.getSigner,
        hasEmbeddedSign: !!embeddedSignMessage
      });

      let sig;
      let methodUsed = "";

      // Method 1: Try embedded wallet signing first (most reliable for Dynamic Waas)
      console.log("Checking embedded wallet availability:", {
        embeddedSignMessage: !!embeddedSignMessage,
        type: typeof embeddedSignMessage,
        isFunction: typeof embeddedSignMessage === 'function'
      });
      
      if (embeddedSignMessage && typeof embeddedSignMessage === 'function') {
        try {
          console.log("Using Method 1: embedded wallet signMessage");
          methodUsed = "Method 1: Embedded Wallet";
          
          // Try different parameter formats for embedded signing
          const signingFormats = [
            { format: "string", param: message },
            { format: "object", param: { message } },
            { format: "bytes", param: new TextEncoder().encode(message) },
            { format: "hex", param: "0x" + Array.from(new TextEncoder().encode(message)).map(b => b.toString(16).padStart(2, '0')).join('') }
          ];
          
          for (const { format, param } of signingFormats) {
            try {
              console.log(`Trying embedded signing with ${format} format...`);
              sig = await embeddedSignMessage(param);
              console.log(`✅ Embedded wallet signing successful with ${format} format:`, sig);
              break;
            } catch (err) {
              console.log(`Embedded signing with ${format} format failed:`, err.message);
              continue;
            }
          }
          
          if (!sig) {
            throw new Error("All embedded signing formats failed");
          }
        } catch (err) {
          console.log("Embedded wallet signing failed, trying next method...", err);
        }
      } else {
        console.log("Embedded wallet signing not available, skipping Method 1");
        
        // If embedded wallet is not available, try to create one
        if (primaryWallet.connector?.name === 'Dynamic Waas') {
          console.log("Attempting to create embedded wallet...");
          try {
            if (typeof primaryWallet.connector.createWalletAccount === 'function') {
              const walletAccount = await primaryWallet.connector.createWalletAccount();
              console.log("✅ Created embedded wallet account:", walletAccount);
              
              // Store the embedded wallet address for later use
              window.embeddedWalletAddress = walletAccount.accountAddress;
              console.log("Stored embedded wallet address:", window.embeddedWalletAddress);
              
              // Now try to use the embedded wallet hook again
              if (embeddedSignMessage && typeof embeddedSignMessage === 'function') {
                console.log("Retrying embedded wallet signing after creation...");
                sig = await embeddedSignMessage(message);
                methodUsed = "Method 1a: Embedded Wallet (After Creation)";
                console.log("✅ Embedded wallet signing successful after creation:", sig);
              }
            }
          } catch (createErr) {
            console.log("Failed to create embedded wallet:", createErr);
          }
        }
      }

      // Method 2: Try to get a proper wallet client from Dynamic Waas (based on official docs)
      if (!sig && primaryWallet.connector?.getWalletClient) {
        try {
          console.log("Using Method 2: Dynamic Waas wallet client (official docs approach)");
          methodUsed = "Method 2: Dynamic Waas Wallet Client (Official)";
          
          // First, try to create an embedded wallet account if it doesn't exist
          if (primaryWallet.connector.name === 'Dynamic Waas') {
            console.log("Dynamic Waas detected, checking for embedded wallet...");
            
            // Try to get the wallet client with different account contexts
            const accountContexts = [
              { account: primaryWallet.address },
              { account: { address: primaryWallet.address, type: 'evm' } },
              { account: { address: primaryWallet.address, type: 'evm', chainId: 1 } }
            ];
            
            // If we have a newly created embedded wallet, try that first
            if (window.embeddedWalletAddress) {
              console.log("Using newly created embedded wallet address:", window.embeddedWalletAddress);
              accountContexts.unshift(
                { account: window.embeddedWalletAddress },
                { account: { address: window.embeddedWalletAddress, type: 'evm' } },
                { account: { address: window.embeddedWalletAddress, type: 'evm', chainId: 1 } }
              );
            }
            
            for (const context of accountContexts) {
              try {
                console.log(`Trying account context:`, context);
                const walletClient = await primaryWallet.connector.getWalletClient(context);
                
                console.log("Got wallet client:", walletClient);
                console.log("Wallet client type:", walletClient?.type);
                console.log("Wallet client methods:", Object.getOwnPropertyNames(walletClient));
                
                // Check if this is a signing-capable client (not publicClient)
                if (walletClient && walletClient.type !== 'publicClient' && walletClient.account) {
                  console.log("✅ Got signing-capable wallet client with account:", walletClient.account);
                  
                  if (typeof walletClient.signMessage === 'function') {
                    sig = await trySignMessage(walletClient, message, "Wallet client signMessage");
                    break;
                  } else if (walletClient.account && typeof walletClient.account.signMessage === 'function') {
                    sig = await trySignMessage(walletClient.account, message, "Wallet client account signMessage");
                    break;
                  }
                } else {
                  console.log("❌ Got public client or no account, trying next context...");
                }
              } catch (err) {
                console.log(`Account context ${JSON.stringify(context)} failed:`, err.message);
                continue;
              }
            }
            
            if (!sig) {
              // If no signing-capable client found, try to create an embedded wallet
              console.log("No signing-capable client found, trying to create embedded wallet...");
              
              if (typeof primaryWallet.connector.createWalletAccount === 'function') {
                try {
                  console.log("Creating embedded wallet account...");
                  const walletAccount = await primaryWallet.connector.createWalletAccount();
                  console.log("Created wallet account:", walletAccount);
                  
                  // Now try to get a wallet client for this account
                  const walletClient = await primaryWallet.connector.getWalletClientByAddress({
                    accountAddress: walletAccount.accountAddress
                  });
                  
                  if (walletClient && typeof walletClient.signMessage === 'function') {
                    sig = await trySignMessage(walletClient, message, "Newly created embedded wallet");
                  }
                } catch (createErr) {
                  console.log("Failed to create embedded wallet:", createErr);
                }
              }
            }
            
            // If still no signature, try using getWalletClientByAddress with the stored embedded wallet
            if (!sig && window.embeddedWalletAddress) {
              console.log("Trying getWalletClientByAddress with stored embedded wallet...");
              try {
                const walletClient = await primaryWallet.connector.getWalletClientByAddress({
                  accountAddress: window.embeddedWalletAddress
                });
                
                console.log("Got wallet client by address:", walletClient);
                console.log("Wallet client type:", walletClient?.type);
                console.log("Wallet client methods:", Object.getOwnPropertyNames(walletClient));
                
                if (walletClient && typeof walletClient.signMessage === 'function') {
                  sig = await trySignMessage(walletClient, message, "Wallet client by address");
                } else if (walletClient && walletClient.account && typeof walletClient.account.signMessage === 'function') {
                  sig = await trySignMessage(walletClient.account, message, "Wallet client account by address");
                }
              } catch (addrErr) {
                console.log("getWalletClientByAddress failed:", addrErr);
              }
            }
          } else {
            // For non-Dynamic Waas connectors, use the standard approach
            const walletClient = await primaryWallet.connector.getWalletClient({
              account: primaryWallet.address
            });
            
            if (walletClient && typeof walletClient.signMessage === 'function') {
              sig = await trySignMessage(walletClient, message, "Standard wallet client");
            }
          }
          
          if (!sig) {
            throw new Error("Could not get signing-capable wallet client from Dynamic Waas");
          }
        } catch (err) {
          console.log("Dynamic Waas wallet client method failed:", err);
        }
      }

      // Method 3: Try to access the internal wallet from the connector
      if (!sig && primaryWallet.connector) {
        try {
          console.log("Using Method 3: Connector internal wallet");
          methodUsed = "Method 3: Connector Internal Wallet";
          
          const connector = primaryWallet.connector;
          console.log("Connector properties:", Object.getOwnPropertyNames(connector));
          
          // Try to find the actual wallet instance
          let internalWallet = null;
          
          // Check for common internal wallet properties
          if (connector.wallet && typeof connector.wallet.signMessage === 'function') {
            internalWallet = connector.wallet;
            console.log("Found connector.wallet");
          } else if (connector.account && typeof connector.account.signMessage === 'function') {
            internalWallet = connector.account;
            console.log("Found connector.account");
          } else if (connector.ChainWallet && typeof connector.ChainWallet.signMessage === 'function') {
            internalWallet = connector.ChainWallet;
            console.log("Found connector.ChainWallet");
          } else if (connector.chainWallet && typeof connector.chainWallet.signMessage === 'function') {
            internalWallet = connector.chainWallet;
            console.log("Found connector.chainWallet");
          } else if (connector._wallet && typeof connector._wallet.signMessage === 'function') {
            internalWallet = connector._wallet;
            console.log("Found connector._wallet");
          }
          
          if (internalWallet) {
            sig = await trySignMessage(internalWallet, message, "Internal wallet");
          } else {
            throw new Error("No internal wallet found with signing capabilities");
          }
        } catch (err) {
          console.log("Connector internal wallet method failed:", err);
        }
      }

      // Method 4: Try to create a wallet client without account parameter
      if (!sig && primaryWallet.connector?.getWalletClient) {
        try {
          console.log("Using Method 4: Wallet client without account parameter");
          methodUsed = "Method 4: Wallet Client No Account";
          
          const walletClient = await primaryWallet.connector.getWalletClient();
          console.log("Got wallet client without account:", walletClient);
          
          if (walletClient && typeof walletClient.signMessage === 'function') {
            sig = await trySignMessage(walletClient, message, "Wallet client without account");
          } else {
            throw new Error("Wallet client without account doesn't support signing");
          }
        } catch (err) {
          console.log("Wallet client without account method failed:", err);
        }
      }

      // Method 5: Try to use the connector's provider to create a signer
      if (!sig && primaryWallet.connector?.provider) {
        try {
          console.log("Using Method 5: Provider-based signer");
          methodUsed = "Method 5: Provider Signer";
          
          const provider = primaryWallet.connector.provider;
          console.log("Provider type:", provider.constructor?.name);
          
          if (typeof provider.getSigner === 'function') {
            const signer = await provider.getSigner();
            if (typeof signer.signMessage === 'function') {
              sig = await trySignMessage(signer, message, "Provider signer");
            } else {
              throw new Error("Provider signer doesn't support signMessage");
            }
          } else {
            throw new Error("Provider doesn't support getSigner");
          }
        } catch (err) {
          console.log("Provider-based signer method failed:", err);
        }

      }

      if (!sig) {
        throw new Error('This wallet does not support message signing. Please try connecting a different wallet or creating an embedded wallet.');
      }

      console.log(`Successfully signed message using ${methodUsed}`);
      console.log("Signature received:", sig);
      setSignature(sig);
      setHistory((prev) => [...prev, { message, signature: sig }]);
      
    } catch (err) {
      console.error("Error signing message:", err);
      alert(`Failed to sign message: ${err.message}`);
    } finally {
      setIsSigning(false);
    }
  };
  
  const handleVerify = async (msg, sig, historyIndex = null) => {
    try {
      console.log("=== VERIFICATION DEBUG ===");
      console.log("Message to verify:", msg);
      console.log("Signature to verify:", sig);
      console.log("Signature type:", typeof sig);
      console.log("Signature length:", sig ? sig.length : "undefined");
      console.log("History index:", historyIndex);
      
      const requestBody = { message: msg, signature: sig };
      console.log("Request body:", requestBody);
      
      const res = await fetch("http://localhost:5000/verify-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      
      console.log("Response status:", res.status);
      console.log("Response headers:", res.headers);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Backend error response:", errorText);
        throw new Error(`Backend error: ${res.status} - ${errorText}`);
      }
      
      const data = await res.json();
      console.log("Verification response:", data);
      
      if (historyIndex !== null) {
        // Store verification for specific history item
        setHistoryVerifications(prev => ({
          ...prev,
          [historyIndex]: data
        }));
      } else {
        // Store verification for main signature
        setVerification(data);
      }
    } catch (err) {
      console.error("Verification failed:", err);
      const errorMessage = `Verification failed: ${err.message}`;
      
      if (historyIndex !== null) {
        // Store error for specific history item
        setHistoryVerifications(prev => ({
          ...prev,
          [historyIndex]: { error: errorMessage }
        }));
      } else {
        // Show alert for main verification
        alert(errorMessage);
      }
    }
  };

  const handleShowWalletOptions = () => {
    console.log("Showing wallet creation options...");
    try {
      // Show the Dynamic widget for wallet creation
      setShowAuthFlow(true);
      console.log("Auth flow opened for wallet creation");
    } catch (error) {
      console.error("Error showing wallet options:", error);
    }
  };

  // Debug logging
  useEffect(() => {
    console.log("Current state:", { user, primaryWallet });
    if (primaryWallet) {
      console.log("Primary wallet details:", {
        address: primaryWallet.address,
        connector: primaryWallet.connector,
        connectorName: primaryWallet.connector?.name,
        connectorMethods: primaryWallet.connector ? Object.getOwnPropertyNames(primaryWallet.connector) : [],
        hasSignMessage: primaryWallet.connector && typeof primaryWallet.connector.signMessage === 'function',
        hasSign: primaryWallet.connector && typeof primaryWallet.connector.sign === 'function',
        hasProvider: primaryWallet.connector && !!primaryWallet.connector.provider,
        providerMethods: primaryWallet.connector?.provider ? Object.getOwnPropertyNames(primaryWallet.connector.provider) : []
      });
    }
  }, [user, primaryWallet]);

  return (
    <>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <div style={{ 
        minHeight: "100vh", 
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "20px",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}>
        <div style={{
          maxWidth: "800px",
          margin: "0 auto",
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(10px)",
          borderRadius: "20px",
          padding: "40px",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.1)",
          border: "1px solid rgba(255, 255, 255, 0.2)"
        }}>
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <h1 style={{ 
              fontSize: "2.5rem", 
              fontWeight: "700", 
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              margin: "0 0 10px 0"
            }}>
              Web3 Message Signer
            </h1>
            <p style={{ 
              fontSize: "1.1rem", 
              color: "#6b7280", 
              margin: "0",
              fontWeight: "500"
            }}>
              Sign and verify messages with your Web3 wallet
            </p>
          </div>

          {!user ? (
            <div style={{ textAlign: "center" }}>
              <div style={{
                background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                padding: "30px",
                borderRadius: "16px",
                color: "white",
                marginBottom: "30px"
              }}>
                <h3 style={{ margin: "0 0 15px 0", fontSize: "1.5rem" }}>🔐 Get Started</h3>
                <p style={{ margin: "0 0 20px 0", opacity: "0.9" }}>
                  Connect your wallet to start signing and verifying messages
                </p>
                <button 
                  onClick={() => setShowAuthFlow(true)}
                  style={{ 
                    background: "rgba(255, 255, 255, 0.2)",
                    color: "white",
                    padding: "15px 30px",
                    border: "2px solid rgba(255, 255, 255, 0.3)",
                    borderRadius: "12px",
                    fontSize: "1.1rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    backdropFilter: "blur(10px)"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = "rgba(255, 255, 255, 0.3)";
                    e.target.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = "rgba(255, 255, 255, 0.2)";
                    e.target.style.transform = "translateY(0)";
                  }}
                >
                  🚀 Connect Wallet
                </button>
              </div>
            </div>
          ) : !primaryWallet ? (
            <>
              <div style={{
                background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                padding: "30px",
                borderRadius: "16px",
                color: "white",
                marginBottom: "30px",
                textAlign: "center"
              }}>
                <h3 style={{ margin: "0 0 15px 0", fontSize: "1.5rem" }}>🎉 Welcome!</h3>
                <p style={{ margin: "0 0 15px 0", opacity: "0.9" }}>
                  <strong>Email:</strong> {user.email}
                </p>
                <p style={{ margin: "0 0 20px 0", opacity: "0.9" }}>
                  Create an embedded wallet to start signing messages
                </p>
                
                <div style={{
                  background: "rgba(255, 255, 255, 0.15)",
                  padding: "20px",
                  borderRadius: "12px",
                  marginBottom: "20px"
                }}>
                  <h4 style={{ margin: "0 0 15px 0", fontSize: "1.2rem" }}>📱 Create Embedded Wallet</h4>
                  <p style={{ margin: "0 0 15px 0", opacity: "0.9" }}>
                    Click below to open the wallet creation interface
                  </p>
                  <button 
                    onClick={handleShowWalletOptions}
                    style={{ 
                      background: "rgba(255, 255, 255, 0.2)",
                      color: "white",
                      padding: "12px 24px",
                      border: "2px solid rgba(255, 255, 255, 0.3)",
                      borderRadius: "10px",
                      fontSize: "1rem",
                      fontWeight: "600",
                      cursor: "pointer",
                      transition: "all 0.3s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = "rgba(255, 255, 255, 0.3)";
                      e.target.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = "rgba(255, 255, 255, 0.2)";
                      e.target.style.transform = "translateY(0)";
                    }}
                  >
                    🔧 Open Wallet Creation
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{
                background: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
                padding: "25px",
                borderRadius: "16px",
                marginBottom: "30px",
                border: "1px solid rgba(168, 237, 234, 0.3)"
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "15px" }}>
                  <h3 style={{ margin: "0", fontSize: "1.4rem", color: "#374151" }}>✅ Wallet Connected</h3>
                  <div style={{
                    background: "rgba(34, 197, 94, 0.1)",
                    color: "#059669",
                    padding: "6px 12px",
                    borderRadius: "20px",
                    fontSize: "0.875rem",
                    fontWeight: "600"
                  }}>
                    Active
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                  <div>
                    <p style={{ margin: "0 0 5px 0", fontSize: "0.875rem", color: "#6b7280", fontWeight: "500" }}>Wallet Address</p>
                    <p style={{ margin: "0", fontSize: "0.9rem", fontFamily: "monospace", color: "#374151", fontWeight: "600" }}>
                      {primaryWallet.address}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: "0 0 5px 0", fontSize: "0.875rem", color: "#6b7280", fontWeight: "500" }}>Wallet Type</p>
                    <p style={{ margin: "0", fontSize: "0.9rem", color: "#374151", fontWeight: "600" }}>
                      {primaryWallet.connector?.name || "Unknown"}
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: "right", marginBottom: "20px" }}>
                <button 
                  onClick={handleLogOut}
                  style={{ 
                    background: "rgba(239, 68, 68, 0.1)",
                    color: "#dc2626",
                    padding: "8px 16px",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    borderRadius: "8px",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = "rgba(239, 68, 68, 0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = "rgba(239, 68, 68, 0.1)";
                  }}
                >
                  🚪 Logout
                </button>
              </div>

              <div style={{ marginBottom: "30px" }}>
                <h3 style={{ 
                  margin: "0 0 20px 0", 
                  fontSize: "1.5rem", 
                  color: "#374151",
                  fontWeight: "600"
                }}>
                  ✍️ Sign Message
                </h3>
                
                <div style={{ marginBottom: "20px" }}>
                  <label style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "0.875rem",
                    fontWeight: "600",
                    color: "#374151"
                  }}>
                    Message to Sign
                  </label>
                  <textarea
                    rows="4"
                    placeholder="Enter your message to sign..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    style={{ 
                      width: "100%", 
                      padding: "16px", 
                      border: "2px solid #e5e7eb",
                      borderRadius: "12px",
                      fontSize: "1rem",
                      fontFamily: "inherit",
                      resize: "vertical",
                      transition: "all 0.2s ease",
                      boxSizing: "border-box"
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#667eea";
                      e.target.style.boxShadow = "0 0 0 3px rgba(102, 126, 234, 0.1)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#e5e7eb";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                </div>
                
                <button 
                  onClick={handleSign}
                  disabled={isSigning}
                  style={{ 
                    background: isSigning 
                      ? "linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)"
                      : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "white",
                    padding: "16px 32px",
                    border: "none",
                    borderRadius: "12px",
                    fontSize: "1.1rem",
                    fontWeight: "600",
                    cursor: isSigning ? "not-allowed" : "pointer",
                    transition: "all 0.3s ease",
                    boxShadow: isSigning 
                      ? "0 4px 15px rgba(156, 163, 175, 0.3)"
                      : "0 4px 15px rgba(102, 126, 234, 0.3)",
                    opacity: isSigning ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!isSigning) {
                      e.target.style.transform = "translateY(-2px)";
                      e.target.style.boxShadow = "0 8px 25px rgba(102, 126, 234, 0.4)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSigning) {
                      e.target.style.transform = "translateY(0)";
                      e.target.style.boxShadow = "0 4px 15px rgba(102, 126, 234, 0.3)";
                    }
                  }}
                >
                  {isSigning ? (
                    <>
                      <span style={{ 
                        display: "inline-block", 
                        width: "16px", 
                        height: "16px", 
                        border: "2px solid transparent",
                        borderTop: "2px solid white",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                        marginRight: "8px"
                      }}></span>
                      Signing...
                    </>
                  ) : (
                    "🔐 Sign Message"
                  )}
                </button>
              </div>

              {signature && (
                <div style={{
                  background: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",
                  padding: "25px",
                  borderRadius: "16px",
                  marginBottom: "30px",
                  border: "1px solid rgba(59, 130, 246, 0.2)"
                }}>
                  <h4 style={{ margin: "0 0 15px 0", fontSize: "1.3rem", color: "#1e40af" }}>🔐 Signature Generated</h4>
                  <div style={{ marginBottom: "20px" }}>
                    <p style={{ margin: "0 0 8px 0", fontSize: "0.875rem", color: "#374151", fontWeight: "500" }}>Signature</p>
                    <div style={{
                      background: "rgba(59, 130, 246, 0.1)",
                      padding: "12px",
                      borderRadius: "8px",
                      border: "1px solid rgba(59, 130, 246, 0.2)"
                    }}>
                      <p style={{ 
                        margin: "0", 
                        fontSize: "0.875rem", 
                        fontFamily: "monospace", 
                        color: "#1e40af",
                        wordBreak: "break-all"
                      }}>
                        {signature}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleVerify(message, signature)}
                    style={{ 
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: "white",
                      padding: "12px 24px",
                      border: "none",
                      borderRadius: "10px",
                      fontSize: "1rem",
                      fontWeight: "600",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      boxShadow: "0 4px 15px rgba(16, 185, 129, 0.3)"
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = "translateY(-2px)";
                      e.target.style.boxShadow = "0 8px 25px rgba(16, 185, 129, 0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = "translateY(0)";
                      e.target.style.boxShadow = "0 4px 15px rgba(16, 185, 129, 0.3)";
                    }}
                  >
                    ✅ Verify Signature
                  </button>
                </div>
              )}

              {verification && (
                <div style={{
                  background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
                  padding: "25px",
                  borderRadius: "16px",
                  marginBottom: "30px",
                  border: "1px solid rgba(245, 158, 11, 0.2)"
                }}>
                  <h4 style={{ margin: "0 0 15px 0", fontSize: "1.3rem", color: "#92400e" }}>🔍 Verification Result</h4>
                  <div style={{
                    background: "rgba(245, 158, 11, 0.1)",
                    padding: "16px",
                    borderRadius: "8px",
                    border: "1px solid rgba(245, 158, 11, 0.2)"
                  }}>
                    <pre style={{ 
                      margin: "0", 
                      fontSize: "0.875rem", 
                      color: "#92400e",
                      fontFamily: "inherit",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word"
                    }}>
                      {JSON.stringify(verification, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              <div>
                <h3 style={{ 
                  margin: "0 0 20px 0", 
                  fontSize: "1.5rem", 
                  color: "#374151",
                  fontWeight: "600"
                }}>
                  📚 Signed Messages History
                </h3>
                
                {history.length === 0 ? (
                  <div style={{
                    textAlign: "center",
                    padding: "40px 20px",
                    color: "#9ca3af",
                    fontSize: "1rem"
                  }}>
                    <p style={{ margin: "0" }}>No signed messages yet</p>
                    <p style={{ margin: "10px 0 0 0", fontSize: "0.875rem" }}>Sign your first message above to get started!</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: "16px" }}>
                    {history.map((item, idx) => (
                      <div key={idx} style={{ 
                        background: "white",
                        padding: "20px", 
                        borderRadius: "12px",
                        border: "1px solid #e5e7eb",
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
                        transition: "all 0.2s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 8px 25px rgba(0, 0, 0, 0.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.05)";
                      }}>
                        <div style={{ marginBottom: "15px" }}>
                          <p style={{ margin: "0 0 8px 0", fontSize: "0.875rem", color: "#6b7280", fontWeight: "500" }}>Message</p>
                          <p style={{ margin: "0", fontSize: "1rem", color: "#374151" }}>{item.message}</p>
                        </div>
                        <div style={{ marginBottom: "15px" }}>
                          <p style={{ margin: "0 0 8px 0", fontSize: "0.875rem", color: "#6b7280", fontWeight: "500" }}>Signature</p>
                          <div style={{
                            background: "#f9fafb",
                            padding: "8px 12px",
                            borderRadius: "6px",
                            border: "1px solid #e5e7eb"
                          }}>
                            <p style={{ 
                              margin: "0", 
                              fontSize: "0.75rem", 
                              fontFamily: "monospace", 
                              color: "#6b7280",
                              wordBreak: "break-all"
                            }}>
                              {item.signature}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleVerify(item.message, item.signature, idx)}
                          style={{ 
                            background: "rgba(59, 130, 246, 0.1)",
                            color: "#2563eb",
                            padding: "8px 16px",
                            border: "1px solid rgba(59, 130, 246, 0.2)",
                            borderRadius: "8px",
                            fontSize: "0.875rem",
                            fontWeight: "500",
                            cursor: "pointer",
                            transition: "all 0.2s ease"
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = "rgba(59, 130, 246, 0.15)";
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = "rgba(59, 130, 246, 0.1)";
                          }}
                        >
                          🔍 Verify Again
                        </button>
                        
                        {/* Verification Result Display */}
                        {historyVerifications[idx] && (
                          <div style={{
                            marginTop: "15px",
                            padding: "15px",
                            borderRadius: "8px",
                            background: historyVerifications[idx].error 
                              ? "rgba(239, 68, 68, 0.1)"
                              : "rgba(16, 185, 129, 0.1)",
                            border: `1px solid ${
                              historyVerifications[idx].error 
                                ? "rgba(239, 68, 68, 0.2)"
                                : "rgba(16, 185, 129, 0.2)"
                            }`
                          }}>
                            <h5 style={{ 
                              margin: "0 0 10px 0", 
                              fontSize: "1rem", 
                              color: historyVerifications[idx].error ? "#dc2626" : "#059669",
                              fontWeight: "600"
                            }}>
                              {historyVerifications[idx].error ? "❌ Verification Failed" : "✅ Verification Result"}
                            </h5>
                            
                            {historyVerifications[idx].error ? (
                              <p style={{ 
                                margin: "0", 
                                fontSize: "0.875rem", 
                                color: "#dc2626" 
                              }}>
                                {historyVerifications[idx].error}
                              </p>
                            ) : (
                              <div style={{
                                background: "rgba(16, 185, 129, 0.05)",
                                padding: "10px",
                                borderRadius: "6px",
                                border: "1px solid rgba(16, 185, 129, 0.1)"
                              }}>
                                <pre style={{ 
                                  margin: "0", 
                                  fontSize: "0.75rem", 
                                  color: "#059669",
                                  fontFamily: "inherit",
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word"
                                }}>
                                  {JSON.stringify(historyVerifications[idx], null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}



