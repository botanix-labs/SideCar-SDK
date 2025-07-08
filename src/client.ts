  // src/client.ts
  import { ethers } from 'ethers';
  import { BotanixSDKConfig } from './types';
  import { PeginService } from './core/pegin';
  import { BitcoinService } from './utils/bitcoin';

  export class BotanixSDK {
    private config: BotanixSDKConfig;
    private provider: ethers.providers.JsonRpcProvider;
    private bitcoinService: BitcoinService;

    pegin: PeginService;

    constructor(config: BotanixSDKConfig) {
      this.config = config;
      this.provider = new ethers.providers.JsonRpcProvider(config.botanixRpcUrl);
      this.bitcoinService = new BitcoinService(config);

      // Initialize services
      this.pegin = new PeginService(this.provider, this.bitcoinService, config);
    }

    /**
     * Get the Botanix provider
     * @returns ethers provider
     */
    getProvider(): ethers.providers.JsonRpcProvider {
      return this.provider;
    }

    /**
     * Get the Bitcoin service
     * @returns Bitcoin service
     */
    getBitcoinService(): BitcoinService {
      return this.bitcoinService;
    }
  }