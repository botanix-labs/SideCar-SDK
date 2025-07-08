  // src/utils/proof.ts
  import { ProofComponents } from '../types';
import { createVarint } from './variant';


const PEGIN_VERISON_0 = Buffer.alloc(4)
PEGIN_VERISON_0.writeUint32LE(0x00)

const PEGIN_VERISON_1 = Buffer.alloc(4)
PEGIN_VERISON_1.writeUint32LE(1)


  /**
   * Generate a pegin proof for the Botanix contract
   * @param proof Proof components
   * @returns Serialized proof
   */

  export function generatePeginProof(args: ProofComponents): Buffer {
    const txId = Buffer.from(args.txId, 'hex').reverse()
    if (txId.length !== 32) {
      throw new Error('Invalid txId length')
    }
  
    const vout = Buffer.alloc(4)
    vout.writeUInt32LE(args.vout)
  
    const ethAddress = Buffer.from(args.ethAddress, 'hex')
    if (ethAddress.length !== 20) {
      throw new Error('Invalid eth public key length')
    }
  
    const aggregatePublicKey = Buffer.from(args.aggregatePublicKey, 'hex')
    if (aggregatePublicKey.length !== 33) {
      throw new Error('Invalid aggregate public key length')
    }
  
    const rawTx = Buffer.from(args.rawTx, 'hex')
  
    const numberOfHeaders = createVarint(args.blockHeaders.length)
    for (const blockHeader of args.blockHeaders) {
      if (blockHeader.length !== 80) {
        throw new Error('Invalid block hash length')
      }
    }
  
    // If no refrence L2 block hash, return a proof without it (v0)
    if (!args.refL2BlockHash) {
      return Buffer.concat([
        PEGIN_VERISON_0,
        txId,
        vout,
        ethAddress,
        aggregatePublicKey,
        numberOfHeaders,
        Buffer.concat([...args.blockHeaders]),
        args.merkleProof,
        rawTx,
      ])
    }
  
    const refL2BlockHash = Buffer.from(
      args.refL2BlockHash.startsWith('0x')
        ? args.refL2BlockHash.slice(2)
        : args.refL2BlockHash,
      'hex',
    )
    if (refL2BlockHash.length !== 32) {
      throw new Error('Invalid L2 block hash length')
    }
  
    return Buffer.concat([
      PEGIN_VERISON_1,
      txId,
      vout,
      ethAddress,
      aggregatePublicKey,
      numberOfHeaders,
      Buffer.concat([...args.blockHeaders]),
      args.merkleProof,
      rawTx,
      refL2BlockHash,
    ])
  }
  