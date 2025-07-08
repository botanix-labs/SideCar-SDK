import axios from 'axios'

interface GetMerkleProofResult {
    jsonrpc: string
    result?: string
    id: number
  }

interface GatewayAddressResult {
gateway_address: string
aggregate_public_key: string
eth_address: string
}
  
interface GetGatewayAddressResponse {
    jsonrpc: string
    result?: GatewayAddressResult
    id: number
  }
export async function getPeginAddress(
    ethereumAddress: string,
    RPC_URL: string,
  ): Promise<GatewayAddressResult> {
    try {
      const payload = {
        jsonrpc: '2.0',
        method: 'eth_getGatewayAddress',
        params: [ethereumAddress],
        id: 1,
      }
     
      const response = await axios.post<GetGatewayAddressResponse>(
        RPC_URL,
        payload,
        {
          headers: { 'Content-Type': 'application/json' },
        },
      )
    
      if (response.data.result == null) {
        throw new Error('Failed to get gateway address')
      }
    
      return response.data.result
    } catch (error) {
      throw error
    }
  
  }

  export async function getMerkleProof(
    txid: string,
    blockHash: string,
    RPC_URL: string,
  ): Promise<Buffer> {
    try {
      const payload = {
        jsonrpc: '2.0',
        method: 'eth_getMerkleProof',
        params: [txid, blockHash],
        id: 1,
      }
    
      const response = await axios.post<GetMerkleProofResult>(
        RPC_URL,
        payload,
        {
          headers: { 'Content-Type': 'application/json' },
        },
      )
      if (response.data.result == null) {
       
        throw new Error('Failed to get merkle proof')
      }
    
      return Buffer.from(response.data.result.slice(2), 'hex')
    } catch (error) {
      throw error
    }
 
  }

  