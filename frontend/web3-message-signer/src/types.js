/**
 * @fileoverview Type definitions for Web3 Message Signer application
 * This file provides JSDoc type annotations for better code documentation and IDE support
 */

/**
 * @typedef {Object} AppConfig
 * @property {number} MAX_MESSAGE_LENGTH - Maximum allowed message length
 * @property {string[]} SUPPORTED_SIGNING_METHODS - Array of supported signing methods
 * @property {Object} STORAGE_KEYS - Local storage key constants
 * @property {string} STORAGE_KEYS.SIGN_HISTORY - Key for storing signing history
 * @property {string} STORAGE_KEYS.USER_PREFERENCES - Key for storing user preferences
 */

/**
 * @typedef {Object} SigningHistoryItem
 * @property {number} id - Unique identifier for the history item
 * @property {string} message - The message that was signed
 * @property {string} signature - The generated signature
 * @property {string} timestamp - ISO timestamp when the message was signed
 * @property {string} walletAddress - The wallet address used for signing
 */

/**
 * @typedef {Object} VerificationResult
 * @property {boolean} isValid - Whether the signature is valid
 * @property {string} [signer] - The recovered signer address (if valid)
 * @property {string} originalMessage - The original message that was signed
 * @property {string} [signature] - The signature being verified
 * @property {string} [verificationMethod] - Method used for verification
 * @property {string} [timestamp] - When the verification was performed
 * @property {string} [error] - Error message if verification failed
 * @property {string} [code] - Error code for failed verifications
 */

/**
 * @typedef {Object} SigningResult
 * @property {string} signature - The generated signature
 * @property {string} method - The signing method used
 */

/**
 * @typedef {Object} WalletInfo
 * @property {string} address - The wallet address
 * @property {Object} connector - The wallet connector object
 * @property {string} [connector.name] - Name of the connector
 * @property {Function} [connector.signMessage] - Direct signing method
 * @property {Function} [connector.getSigner] - Method to get ethers signer
 * @property {Function} [connector.getWalletClient] - Method to get wallet client
 */

/**
 * @typedef {Object} UserContext
 * @property {Object} user - User information from Dynamic
 * @property {string} user.email - User's email address
 * @property {Function} setShowAuthFlow - Function to show authentication flow
 * @property {WalletInfo} [primaryWallet] - The primary connected wallet
 * @property {Function} handleLogOut - Function to handle user logout
 */

/**
 * @typedef {Object} EmbeddedWalletHook
 * @property {Function} [signMessage] - Embedded wallet signing function
 */

/**
 * @typedef {Object} SigningHistoryHook
 * @property {SigningHistoryItem[]} history - Array of signing history items
 * @property {Function} addToHistory - Function to add new history item
 * @property {Function} clearHistory - Function to clear all history
 */

/**
 * @typedef {Object} SignatureVerificationHook
 * @property {VerificationResult} [verification] - Main verification result
 * @property {Object.<number, VerificationResult>} historyVerifications - Verification results for history items
 * @property {boolean} isVerifying - Whether verification is in progress
 * @property {Function} verifySignature - Function to verify a signature
 * @property {Function} clearVerification - Function to clear verification results
 */

/**
 * @typedef {Object} MessageSigningHook
 * @property {Function} signMessage - Function to sign a message
 * @property {boolean} isSigning - Whether signing is in progress
 */

/**
 * @typedef {Object} SigningFormats
 * @property {string} format - The format name (string, object, bytes, hex)
 * @property {any} param - The parameter to pass to the signing function
 */

/**
 * @typedef {Object} ErrorWithCode
 * @property {string} message - Error message
 * @property {string} [code] - Error code
 */

/**
 * @typedef {Object} BackendError
 * @property {boolean} isValid - Always false for errors
 * @property {string} error - Error message
 * @property {string} code - Error code
 * @property {string} [originalMessage] - Original message if available
 * @property {string} [signature] - Signature if available
 * @property {string} timestamp - When the error occurred
 */

/**
 * @typedef {Object} BackendSuccess
 * @property {boolean} isValid - Always true for successful verifications
 * @property {string} signer - The recovered signer address
 * @property {string} originalMessage - The original message
 * @property {string} signature - The verified signature
 * @property {string} verificationMethod - Method used for verification
 * @property {string} timestamp - When verification was performed
 */

/**
 * @typedef {Object} APIResponse
 * @property {string} name - API name
 * @property {string} version - API version
 * @property {Object} endpoints - Available API endpoints
 * @property {string[]} supportedFormats - Supported signature formats
 * @property {string} timestamp - When the API info was generated
 */

/**
 * @typedef {Object} HealthCheck
 * @property {string} status - Health status
 * @property {string} timestamp - When the health check was performed
 * @property {string} version - Application version
 */

export {}; 