declare module 'electrum-client' {
    interface ServerOptions {
      host: string
      port: number
      protocol: 'tcp' | 'tls'
    }
  
    interface ElectrumClientOptions {
      timeout?: number
      reconnect?: boolean
      autoConnect?: boolean
      version?: string
      server?: ServerOptions
    }
  
    interface UnspentOutput {
      // big endian hex encoded string
      hash: string
      // output index
      index: number
    }
  
    export interface UnspentOutputFromScriptHash {
      tx_hash: string
      tx_pos: number
      height: number
      value: number
    }
  
    export interface UnspentHistory {
      height: number
      tx_hash: string
    }
  
    export interface Balance {
      confirmed: number
      unconfirmed: number
    }
  
    export interface MerkelPath {
      block_height: number
      merkle: string[]
      pos: number
    }
  
    interface ElectrumClient {
      connect: () => Promise<void>
      close: () => void
      server_version(
        client_name: string,
        protocol_version: string,
      ): Promise<unknown>
      server_banner(): Promise<unknown>
      serverDonation_address(): Promise<unknown>
      serverPeers_subscribe(): Promise<unknown>
      blockchainAddress_getBalance(address: string): Promise<unknown>
      blockchainAddress_getHistory(address: string): Promise<UnspentHistory[]>
      blockchainAddress_getMempool(address: string): Promise<unknown>
      blockchainAddress_getProof(address: string): Promise<unknown>
      blockchainAddress_listunspent(address: string): Promise<UnspentOutput>
      blockchainAddress_subscribe(address: string): Promise<unknown>
      blockchainScripthash_getBalance(scripthash: string): Promise<Balance>
      blockchainScripthash_getHistory(
        scripthash: string,
      ): Promise<UnspentHistory[]>
      blockchainScripthash_getMempool(scripthash: string): Promise<unknown>
      blockchainScripthash_listunspent(
        scripthash: string,
      ): Promise<UnspentOutputFromScriptHash[]>
      blockchainScripthash_subscribe(scripthash: string): Promise<unknown>
      blockchainBlock_getHeader(height: number): Promise<string>
      blockchainBlock_getChunk(index: number): Promise<unknown>
      blockchainEstimatefee(number: number): Promise<number>
      blockchainHeaders_subscribe(): Promise<unknown>
      blockchainNumblocks_subscribe(): Promise<unknown>
      blockchain_relayfee(): Promise<unknown>
      blockchainTransaction_broadcast(rawtx: string): Promise<string>
      blockchainTransaction_get(tx_hash: string, height?: number): Promise<string>
      blockchainTransaction_getMerkle(
        tx_hash: string,
        height?: number,
      ): Promise<MerkelPath>
      blockchainUtxo_getAddress(tx_hash: string, index: number): Promise<unknown>
    }
  
    interface ElectrumClientConstructor {
      new (
        port: number,
        host: string,
        protocl: string,
        options?: ElectrumClientOptions,
      ): ElectrumClient
    }
  
    const ElectrumClient: ElectrumClientConstructor
  
    export default ElectrumClient
  }
  