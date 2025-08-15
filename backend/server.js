import express from "express";
import cors from "cors";
import { ethers } from "ethers";

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Input validation middleware
const validateSignatureRequest = (req, res, next) => {
  const { message, signature } = req.body;
  
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ 
      isValid: false, 
      error: "Message is required and must be a string",
      code: "INVALID_MESSAGE"
    });
  }
  
  if (!signature || typeof signature !== 'string') {
    return res.status(400).json({ 
      isValid: false, 
      error: "Signature is required and must be a string",
      code: "INVALID_SIGNATURE"
    });
  }
  
  if (message.length > 10000) {
    return res.status(400).json({ 
      isValid: false, 
      error: "Message too long (max 10,000 characters)",
      code: "MESSAGE_TOO_LONG"
    });
  }
  
  next();
};

// Signature verification logic (modular and extensible)
const verifyEthereumSignature = (message, signature) => {
  try {
    const signer = ethers.verifyMessage(message, signature);
    return {
      isValid: true,
      signer,
      originalMessage: message,
      signature,
      verificationMethod: "ethereum_verifyMessage",
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      isValid: false,
      error: error.message,
      code: "VERIFICATION_FAILED",
      originalMessage: message,
      signature,
      timestamp: new Date().toISOString()
    };
  }
};

// Routes
app.post("/verify-signature", validateSignatureRequest, async (req, res) => {
  try {
    const { message, signature } = req.body;
    
    // Verify the signature
    const result = verifyEthereumSignature(message, signature);
    
    if (result.isValid) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error("Signature verification error:", error);
    return res.status(500).json({ 
      isValid: false, 
      error: "Internal server error during verification",
      code: "INTERNAL_ERROR",
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
});

// API info endpoint
app.get("/api", (req, res) => {
  res.json({
    name: "Web3 Message Signer API",
    version: "1.0.0",
    endpoints: {
      "POST /verify-signature": "Verify Ethereum message signatures",
      "GET /health": "Health check endpoint",
      "GET /api": "API information"
    },
    supportedFormats: ["ethereum_personal_sign"],
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    isValid: false,
    error: "Internal server error",
    code: "UNHANDLED_ERROR",
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    isValid: false,
    error: "Endpoint not found",
    code: "NOT_FOUND",
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`✅ Web3 Message Signer Backend running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

export default app;
