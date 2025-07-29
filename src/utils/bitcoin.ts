 // src/utils/bitcoin.ts
 import * as bitcoin from 'bitcoinjs-lib';
 import * as ecc from 'tiny-secp256k1';
 import ElectrumClient from 'electrum-client';
 import { createHash } from 'crypto';
 import { BotanixSDKConfig, UnspentOutputFromScriptHash, UTXO } from '../types';

 // eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
 import RPCClient from 'bitcoin-core'
 // Initialize the Bitcoin library with the secp256k1 implementation
 bitcoin.initEccLib(ecc);

 /**
  * Get the Bitcoin network based on network name
  * @param networkName Network name
  * @returns Bitcoin network
  */
 export function getBitcoinNetwork(networkName: string): bitcoin.networks.Network {
   switch (networkName.toLowerCase()) {
     case 'mainnet':
       return bitcoin.networks.bitcoin;
     case 'testnet':
       return bitcoin.networks.testnet;
     case 'regtest':
       return bitcoin.networks.regtest;
     case 'signet':
       return bitcoin.networks.testnet; // signet uses testnet settings
     default:
       throw new Error(`Unsupported Bitcoin network: ${networkName}`);
   }
 }

 export class BitcoinService {
   private config: BotanixSDKConfig;
   private network: bitcoin.networks.Network;

   constructor(config: BotanixSDKConfig) {
     this.config = config;
     this.network = getBitcoinNetwork(config.bitcoinNetwork);
   }

   async executeWithElectrum<T>(fn: (ecl: ElectrumClient) => Promise<T>): Promise<T> {
     if (!this.config.electrumServer) {
       throw new Error('Electrum server configuration is required');
     }

     const { host, port, protocol } = this.config.electrumServer;
     const ecl = new ElectrumClient(port, host, protocol);

     try {
       await ecl.connect();
       const result = await fn(ecl);
       return result;
     } catch (error) {
       console.error(`Failed to call Electrum with error ${(error as Error).message}`);
       throw new Error('Failed to call electrum');
     } finally {
       ecl.close();
     }
   }


   async executeWithBitcoind<T>(fn: (ecl: RPCClient) => Promise<T>): Promise<T> {
    if (!this.config.bitcoindConfig) {
      throw new Error(' Bitcoind RPC configuration is required');
    }

    const { host, port, username, password } = this.config.bitcoindConfig;
    const client = new RPCClient({
        host: host,
        port: port,
        username: username,
        password: password
        })

    try {
        const result = await fn(client)
        return result
    } catch (error) {
        console.error(
            `Failed to call Bitcoind RPC with error ${(error as Error).message}`,
        )
        throw new Error('Failed to call bitcoind')
    }
  }


   /**
    * Get a transaction from the Bitcoin blockchain
    * @param txid Transaction ID
    * @returns Raw transaction hex
    */
   async getTransaction(txid: string): Promise<string> {
     return this.executeWithElectrum(async (ecl: ElectrumClient) => {
       const tx = await ecl.blockchainTransaction_get(txid);
       return tx;
     });
   }

   /**
     * Get block header from a block hash
     * @param blockHash Block hash
     * @returns Block header
     */
   async getBlockHeaderFromHash(blockHash: string): Promise<string> {
    const header = this.executeWithBitcoind<string>(async (rpc) => {
        const blockheader = await rpc.command('getblockheader', blockHash, false)
        return blockheader
      })
    
          return header
      }

  

   /**
    * Get block hash from height
    * @param height Block height
    * @returns Block hash
    */
   async getBlockHash(height: number): Promise<string> {
    const header = this.executeWithBitcoind<string>(async (rpc) => {
        const hash = await rpc.command('getblockhash', height)
        return hash
      })
    return header
      }

   /**
    * Get current blockchain tip height
    * @returns Current height
    */
   async  getTip(): Promise<number> {
    const tip = this.executeWithBitcoind<number>(async (rpc) => {
      const info = await rpc.command('getblockchaininfo')
      return info.blocks
    })
  
        return tip
    }
  
   /**
    * Get UTXOs for an address
    * @param address Bitcoin address
    * @returns List of UTXOs
    */
   async getUnspentOutputs(outputScripts: Buffer[]): Promise<UTXO[]> {
    const utxos = this.executeWithElectrum<UTXO[]>(
      async (ecl: ElectrumClient) => {
        const promises = []
        for (const outputScript of outputScripts) {
          promises.push(
            ecl.blockchainScripthash_listunspent(outputScript.toString('hex')),
          )
        }
        const result: UnspentOutputFromScriptHash[][] =
          await Promise.all(promises)
        const zippedArray = result.reduce((acc, curr) => acc.concat(curr), [])
        return zippedArray.map((utxo) => {
          // Were checking this object has these members, this eslint disable is ok
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (utxo.tx_hash == null || utxo.tx_pos == null) {
            throw new Error(
              'Error getting UTXOs. Unexpected object returned from Electrum',
            )
          }
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          return {
            hash: utxo.tx_hash,
            index: utxo.tx_pos,
            height: utxo.height,
            value: utxo.value,
          } as unknown as UTXO
        })
      },
    )
    return utxos
  }

   /**
    * Check if a bitcoin transaction is a coinbase transaction
    * @param txid Transaction ID
    * @returns True if coinbase transaction
    */
   async isCoinbaseTx(txid: string): Promise<boolean> {
     const tx = await this.executeWithBitcoind(async (rpc) => {
       return await rpc.command('getrawtransaction', txid, false)
     });

     // A coinbase transaction has exactly one input with a prevout hash of 0
     return tx.vin &&
            tx.vin.length === 1 &&
            tx.vin[0].txid === '0000000000000000000000000000000000000000000000000000000000000000';
   }
 }