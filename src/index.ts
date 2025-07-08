// src/index.ts
export * from './client';
export * from './types';
export * from './core/pegin';
export * from './utils/bitcoin';
export * from './utils/merkle';
export * from './utils/proof';

// Default export for CommonJS compatibility
import { BotanixSDK } from './client';
export default BotanixSDK;