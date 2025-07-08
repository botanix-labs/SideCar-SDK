  // src/core/pegin.ts
  import { BigNumber, ethers } from 'ethers';
  import { BotanixSDKConfig
    , ProofComponents, 
        PeginVersion, 
        UTXOWithAddress,
        UTXOWithCheckpoints,
        UTXO} from '../types';
  import { BitcoinService } from '../utils/bitcoin';
  import { generatePeginProof } from '../utils/proof';
import { getScriptHash, stringNetworkToBitcoinjs } from '../utils/address';
import { getMerkleProof, getPeginAddress } from '../utils/merkle';

  export class PeginService {
    private provider: ethers.providers.JsonRpcProvider;
    private bitcoinService: BitcoinService;
    private config: BotanixSDKConfig;

    constructor(
      provider: ethers.providers.JsonRpcProvider, 
      bitcoinService: BitcoinService,
      config: BotanixSDKConfig
    ) {
      this.provider = provider;
      this.bitcoinService = bitcoinService;
      this.config = config;
    }

    /**
     * Generate a gateway address for a given Ethereum address
     * @param ethereumAddress Ethereum address (with or without 0x prefix)
     * @returns Bitcoin gateway address and aggregate public key
     */
    async generateGatewayAddress(ethereumAddress: string): Promise<{gatewayAddress: string, aggregatePublicKey: string}> {
     try {
         // Normalize the Ethereum address
         const normalizedAddress = ethereumAddress.startsWith('0x')
         ? ethereumAddress.slice(2)
         : ethereumAddress;
      
         
       // Call the RPC method to get the gateway address
       const result = await getPeginAddress(normalizedAddress, this.config.botanixRpcUrl);
 
       return {
         gatewayAddress: result.gateway_address,
         aggregatePublicKey: result.aggregate_public_key
       };
     } catch (error) {
      throw error
     }
   
    }


    /**
     * Get confirmation depth required for pegin
     * @param isCoinbase Whether the transaction is a coinbase transaction
     * @returns Required confirmation depth
     */
    getConfirmationDepth(isCoinbase: boolean): number {
      
      return isCoinbase ? 100 : this.config.bitcoinNetwork === 'mainnet' ? 19 : 1;
    }

        /**
     * Get UTXOs for a given gateway address
     * @param gatewayAddress Bitcoin gateway address to check for UTXOs
     * @returns Array of UTXOs
     */
        async getGatewayUTXOs(gatewayAddress: string): Promise<UTXO[]> {
          try {
            // Get script hash for the gateway address
            const scriptHash = getScriptHash(
              gatewayAddress,
              stringNetworkToBitcoinjs(this.config.bitcoinNetwork)
            );
    
            // Get the UTXOs
            const utxos: UTXO[] = await this.bitcoinService.getUnspentOutputs([scriptHash]);
            
            return utxos;
          } catch (error) {
            console.error('Error fetching gateway UTXOs:', error);
            throw new Error(`Failed to get UTXOs for address ${gatewayAddress}: ${(error as Error).message}`);
          }
        }


    /**
     * Processes the UTXOs and calculates the proofs and aggregate value for a given bitcoin address
     * This function will also update the proof db.
     * @param utxos The UTXOs to process, all belonging to the same address and confirmed in the same bitcoin block
     * @param gatewayTransactions The gateway transactions containing the ETH address and aggregate public key.
     * @param address The address associated with the UTXOs.
     * @param tip The tip value.
     * @returns A promise that resolves to an array containing the proofs and aggregate value.
     */
    async processUtxos (
        utxos: UTXOWithCheckpoints[],
        ethAddress: string,
        aggregatePublicKey: string,
        tip: number, 
    ): Promise<[proofs: ProofComponents[], aggregateValue: number]> {
        const proofs: ProofComponents[] = []
        let aggregateValue = 0

        for (const utxo of utxos) {
            if (utxo === null) continue
            // Check if utxo is confirmed
            if (utxo.height <= 0) continue
        
            const proof = await this.getPeginComponents(
              utxo,
              ethAddress,
              aggregatePublicKey,
              tip,
            )
        
            proofs.push(proof)
            aggregateValue += utxo.value
          
          }
        
          return [proofs, aggregateValue]
    }

    /**
     * Get pegin proof components
     * @param utxo The UTXO to create proof for
     * @param ethAddress Ethereum address to receive funds
     * @param aggregatePublicKey Aggregate public key from gateway address
     * @param currentTip Current Bitcoin blockchain tip
     * @returns Proof components
     */
    async getPeginComponents(
      utxo: UTXOWithCheckpoints,
      ethAddress: string,
      aggregatePublicKey: string,
      currentTip: number
    ): Promise<ProofComponents> {

        const txId = utxo.hash
        const vout = utxo.index
        const confirmationHeight = utxo.height
      // Get raw transaction
      const rawTx = await this.bitcoinService.getTransaction(txId);

      // Get block hash for the block containing the transaction
      const confirmationHash = await this.bitcoinService.getBlockHash(utxo.height);

      const merkleProof = await getMerkleProof(txId, confirmationHash, this.config.botanixRpcUrl)

       // Get block headers for all blocks from confirmation height to tip
       const blockHeaders: [height: number, header: Buffer][] = []

       const endHeight = utxo.bitcoinCheckpoint ? utxo.bitcoinCheckpoint.utxoHeight : currentTip
 
       const getBlockHeaderPromises = []
       for (let height = confirmationHeight; height <= endHeight; height++) {
         getBlockHeaderPromises.push(
           (async () => {
             const blockHash = await this.bitcoinService.getBlockHash(height)
             const blockHeader = Buffer.from(
               await this.bitcoinService.getBlockHeaderFromHash(blockHash),
               'hex',
             )
             blockHeaders.push([height, blockHeader])
           })(),
         )
       }
     
       await Promise.all(getBlockHeaderPromises)
     
       // Sort by height ascending order
       const sortedBlockHeaderTuples = blockHeaders.sort((a, b) => a[0] - b[0])
       // Get only the block headers
       const sortedBlockHeaders = sortedBlockHeaderTuples.map((tuple) => tuple[1])
 

       if (utxo.bitcoinCheckpoint) {
        //get reference l2BblockHash (pegin v1)
        const refL2BlockHash = utxo.bitcoinCheckpoint.l2BlockHash
    
        return {
          txId,
          vout,
          merkleProof,
          blockHeaders: sortedBlockHeaders,
          ethAddress,
          aggregatePublicKey,
          rawTx,
          refL2BlockHash,
          version: PeginVersion.V1,
        } as ProofComponents
      } else {
        //fallback to pegin V0 approach
        return {
          txId,
          vout,
          merkleProof,
          blockHeaders: sortedBlockHeaders,
          ethAddress,
          aggregatePublicKey,
          rawTx,
          version: PeginVersion.V0,
        } as ProofComponents
      }
    }



    /**
     * Perform a pegin by calling the mint contract directly
     * @param ethereumAddress Ethereum Address (wallet)
     * @param bitcoinTxid Bitcoin transaction ID
     * @param bitcoinVout Bitcoin transaction output index
     * @param bitcoinAmount Amount in satoshis
     * @returns serialized proof, UTXO height and aggregate pegin value 
     */
    async generatePeginData(
      ethereumAddress: string,
      bitcoinTxid: string,
      uxtosWithCheckpoint: UTXOWithCheckpoints[]
    ): Promise<{proof:Buffer[], utxoHeight:number, value: number}> {

        try {
                  // Get the sender's Ethereum address
      const ethAddress = ethereumAddress.startsWith('0x')
      ? ethereumAddress.slice(2)
      : ethereumAddress;

      // Generate a gateway address
      const { gatewayAddress, aggregatePublicKey } = await this.generateGatewayAddress(ethereumAddress);

        if(!gatewayAddress) {
            throw new Error('Failed to generate gateway address');
        }
    
        
      // Get the UTXO information
      const utxos: UTXO[] = await this.getGatewayUTXOs(gatewayAddress);
      const utxo = utxos.find(u => u.hash === bitcoinTxid)

      if (!utxo) {
        throw new Error(`UTXO ${bitcoinTxid} not found for address ${gatewayAddress}`);
      }

      // Check confirmations
      const tip = await this.bitcoinService.getTip();
      const isCoinbase = await this.bitcoinService.isCoinbaseTx(bitcoinTxid);
      const requiredConfirmations = this.getConfirmationDepth(isCoinbase);
      const currentConfirmations = tip - utxo.height + 1;

        if (currentConfirmations < requiredConfirmations) {
            throw new Error(`Not enough confirmations: ${currentConfirmations}/${requiredConfirmations}`);
        }

        // find all utxo related to the address and have the same blockheight
        const sameBlockHeightUtxos = uxtosWithCheckpoint.filter(
            (existingUtxo) => existingUtxo.height === utxo.height,
        )

        const [proofs, aggregateValue] = await this.processUtxos(
            sameBlockHeightUtxos,
            ethAddress,
            aggregatePublicKey,
            tip,
            )
  

      // Generate the serialized proof
        const serializedProofs = proofs.map((proof) => generatePeginProof(proof))

      

         return {proof: serializedProofs,utxoHeight:utxo.height, value: aggregateValue} 

        } catch (error) {
            console.error('Error creating pegin proof:', error);
            throw error;
            
        }


    }
  }


  