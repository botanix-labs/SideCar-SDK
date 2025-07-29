
  // src/types/index.ts
  export interface BotanixSDKConfig {
    botanixRpcUrl: string;
    mintContractAddress: string;
    bitcoinNetwork: 'mainnet' | 'testnet' | 'regtest' | 'signet';
    electrumServer: {
      host: string;
      port: number;
      protocol: string;
    };
    bitcoindConfig: {
      host: string;
      port: number;
      username: string;
      password: string;
    };
  }

  export interface UTXO {
    index: number
    hash: string;
    value: number;
    height: number;
  }

 

  export enum PeginVersion {
    V0 ,
    V1 
  }

  export interface BlockHeader {
    hash: string;
    height: number;
    version: number;
    previousblockhash: string;
    merkleroot: string;
    time: number;
    bits: string;
    nonce: number;
  }

  export interface PeginResult {
    txHash: string;
    success: boolean;
    receipt?: any;
  }

  export interface PegoutResult {
    txHash: string;
    success: boolean;
    receipt?: any;
  }

  export interface UnspentOutputFromScriptHash {
    tx_hash: string
    tx_pos: number
    height: number
    value: number
  }
  export type UTXOWithAddress = UTXO & { address: string }

 

export type Network = 'mainnet' | 'testnet' | 'signet' | 'regtest'

export interface ProofComponents {
    merkleProof: Buffer
    vout: number
    txId: string
   
    ethAddress: string
    aggregatePublicKey: string
    blockHeaders: Buffer[]
    rawTx: string
    refL2BlockHash?: string
  
    version: PeginVersion
  }


  export interface BitcoinCheckpoint {
    l2BlockHash: string
    l1CheckpointHash: string
    utxoHeight: number
  }
  export type UTXOWithCheckpoints = UTXO & { bitcoinCheckpoint?: BitcoinCheckpoint }