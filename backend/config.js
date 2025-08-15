// Backend Configuration Example
// Copy this file to config.js and fill in your values

export const config = {
  // Server Configuration
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Frontend URL for CORS
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  
  // Optional: Rate Limiting
  rateLimit: {
    windowMs: process.env.RATE_LIMIT_WINDOW_MS || 900000, // 15 minutes
    maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS || 100
  },
  
  // Optional: Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json'
  },
  
  // Optional: Security
  security: {
    helmetEnabled: process.env.HELMET_ENABLED !== 'false',
    corsCredentials: process.env.CORS_CREDENTIALS !== 'false'
  },
  
  // Optional: Monitoring
  monitoring: {
    healthCheckInterval: process.env.HEALTH_CHECK_INTERVAL || 30000
  }
};

export default config; 