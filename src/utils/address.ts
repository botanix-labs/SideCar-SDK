import { Network, address, crypto, initEccLib } from 'bitcoinjs-lib'
import { bitcoin, regtest, testnet } from 'bitcoinjs-lib/src/networks'
import { Network as ConfigNetwork } from '../types'
import * as ecc from 'tiny-secp256k1'

initEccLib(ecc)
export function getScriptHash(addr: string, network: Network): Buffer {
    const script = address.toOutputScript(addr, network)
  
    const hash = crypto.sha256(script)
  
    return hash.reverse()
  }
  
  export function stringNetworkToBitcoinjs(network: ConfigNetwork): Network {
    switch (network) {
      case 'mainnet':
        return bitcoin
      case 'testnet':
      // Signet has the same address prefix as testnet
      case 'signet':
        return testnet
      case 'regtest':
        return regtest
    }
  }
  