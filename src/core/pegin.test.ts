import { PeginService } from './pegin';
import { BitcoinService } from '../utils/bitcoin';
import { BotanixSDKConfig, UTXO, UTXOWithCheckpoints, PeginVersion, ProofComponents } from '../types';
import { ethers } from 'ethers';
import * as merkleUtils from '../utils/merkle';
import * as proofUtils from '../utils/proof';
import * as addressUtils from '../utils/address';

// Mock dependencies
jest.mock('../utils/bitcoin');
jest.mock('../utils/merkle');
jest.mock('../utils/proof');
jest.mock('../utils/address');

const mockBitcoinService = BitcoinService as jest.MockedClass<typeof BitcoinService>;
const mockGetPeginAddress = merkleUtils.getPeginAddress as jest.MockedFunction<typeof merkleUtils.getPeginAddress>;
const mockGetMerkleProof = merkleUtils.getMerkleProof as jest.MockedFunction<typeof merkleUtils.getMerkleProof>;
const mockGeneratePeginProof = proofUtils.generatePeginProof as jest.MockedFunction<typeof proofUtils.generatePeginProof>;
const mockGetScriptHash = addressUtils.getScriptHash as jest.MockedFunction<typeof addressUtils.getScriptHash>;
const mockStringNetworkToBitcoinjs = addressUtils.stringNetworkToBitcoinjs as jest.MockedFunction<typeof addressUtils.stringNetworkToBitcoinjs>;

describe('PeginService', () => {
  let peginService: PeginService;
  let mockProvider: jest.Mocked<ethers.providers.JsonRpcProvider>;
  let mockBitcoinServiceInstance: jest.Mocked<BitcoinService>;
  let mockConfig: BotanixSDKConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock provider
    mockProvider = {
      getNetwork: jest.fn(),
      getBlockNumber: jest.fn(),
    } as any;

    // Mock Bitcoin service instance
    mockBitcoinServiceInstance = {
      getTip: jest.fn(),
      getTransaction: jest.fn(),
      getBlockHash: jest.fn(),
      getBlockHeaderFromHash: jest.fn(),
      isCoinbaseTx: jest.fn(),
      getUnspentOutputs: jest.fn(),
    } as any;

    // Mock config
    mockConfig = {
      botanixRpcUrl: 'https://test-rpc.botanix.com',
      mintContractAddress: '0x1234567890123456789012345678901234567890',
      bitcoinNetwork: 'testnet',
      electrumServer: {
        host: 'test.electrum.com',
        port: 50002,
        protocol: 'ssl'
      },
      bitcoindConfig: {
        host: 'test.bitcoin.com',
        port: 8332,
        username: 'testuser',
        password: 'testpass'
      }
    };

    peginService = new PeginService(mockProvider, mockBitcoinServiceInstance, mockConfig);
  });

  describe('generateGatewayAddress', () => {
    it('should generate gateway address for Ethereum address with 0x prefix', async () => {
      const ethereumAddress = '0x1234567890123456789012345678901234567890';
      const expectedResult = {
        gateway_address: 'tb1qtest123456789',
        aggregate_public_key: '02abcdef1234567890',
        eth_address: '1234567890123456789012345678901234567890'
      };

      mockGetPeginAddress.mockResolvedValue(expectedResult);

      const result = await peginService.generateGatewayAddress(ethereumAddress);

      expect(mockGetPeginAddress).toHaveBeenCalledWith(
        '1234567890123456789012345678901234567890',
        mockConfig.botanixRpcUrl
      );
      expect(result).toEqual({
        gatewayAddress: expectedResult.gateway_address,
        aggregatePublicKey: expectedResult.aggregate_public_key
      });
    });

    it('should generate gateway address for Ethereum address without 0x prefix', async () => {
      const ethereumAddress = '1234567890123456789012345678901234567890';
      const expectedResult = {
        gateway_address: 'tb1qtest123456789',
        aggregate_public_key: '02abcdef1234567890',
        eth_address: ethereumAddress
      };

      mockGetPeginAddress.mockResolvedValue(expectedResult);

      const result = await peginService.generateGatewayAddress(ethereumAddress);

      expect(mockGetPeginAddress).toHaveBeenCalledWith(
        ethereumAddress,
        mockConfig.botanixRpcUrl
      );
      expect(result).toEqual({
        gatewayAddress: expectedResult.gateway_address,
        aggregatePublicKey: expectedResult.aggregate_public_key
      });
    });

    it('should throw error when getPeginAddress fails', async () => {
      const ethereumAddress = '0x1234567890123456789012345678901234567890';
      const error = new Error('RPC call failed');

      mockGetPeginAddress.mockRejectedValue(error);

      await expect(peginService.generateGatewayAddress(ethereumAddress)).rejects.toThrow(error);
    });
  });

  describe('getConfirmationDepth', () => {
    it('should return 100 for coinbase transactions', () => {
      const result = peginService.getConfirmationDepth(true);
      expect(result).toBe(100);
    });

    it('should return 19 for non-coinbase transactions on mainnet', () => {
      const mainnetConfig = { ...mockConfig, bitcoinNetwork: 'mainnet' as const };
      const mainnetPeginService = new PeginService(mockProvider, mockBitcoinServiceInstance, mainnetConfig);
      
      const result = mainnetPeginService.getConfirmationDepth(false);
      expect(result).toBe(19);
    });

    it('should return 1 for non-coinbase transactions on testnet', () => {
      const result = peginService.getConfirmationDepth(false);
      expect(result).toBe(1);
    });
  });

  describe('getGatewayUTXOs', () => {
    it('should return UTXOs for valid gateway address', async () => {
      const gatewayAddress = 'tb1qtest123456789';
      const scriptHash = Buffer.from('abcdef123456789', 'hex');
      const mockUtxos: UTXO[] = [
        { index: 0, hash: 'tx1', value: 100000, height: 100 },
        { index: 1, hash: 'tx2', value: 200000, height: 101 }
      ];

      mockGetScriptHash.mockReturnValue(scriptHash);
      mockStringNetworkToBitcoinjs.mockReturnValue({} as any);
      mockBitcoinServiceInstance.getUnspentOutputs.mockResolvedValue(mockUtxos);

      const result = await peginService.getGatewayUTXOs(gatewayAddress);

      expect(mockGetScriptHash).toHaveBeenCalledWith(gatewayAddress, {});
      expect(mockBitcoinServiceInstance.getUnspentOutputs).toHaveBeenCalledWith([scriptHash]);
      expect(result).toEqual(mockUtxos);
    });

    it('should throw error when getUnspentOutputs fails', async () => {
      const gatewayAddress = 'tb1qtest123456789';
      const error = new Error('Bitcoin service error');

      mockGetScriptHash.mockReturnValue(Buffer.from('scriptHash', 'hex'));
      mockStringNetworkToBitcoinjs.mockReturnValue({} as any);
      mockBitcoinServiceInstance.getUnspentOutputs.mockRejectedValue(error);

      await expect(peginService.getGatewayUTXOs(gatewayAddress)).rejects.toThrow(
        `Failed to get UTXOs for address ${gatewayAddress}: ${error.message}`
      );
    });
  });

  describe('processUtxos', () => {
    it('should process valid UTXOs and return proofs and aggregate value', async () => {
      const utxos: UTXOWithCheckpoints[] = [
        { index: 0, hash: 'tx1', value: 100000, height: 100 },
        { index: 1, hash: 'tx2', value: 200000, height: 100 }
      ];
      const ethAddress = '1234567890123456789012345678901234567890';
      const aggregatePublicKey = '02abcdef1234567890';
      const tip = 120;

      const mockProofComponents: ProofComponents = {
        txId: 'tx1',
        vout: 0,
        merkleProof: Buffer.from('proof'),
        blockHeaders: [Buffer.from('header')],
        ethAddress,
        aggregatePublicKey,
        rawTx: 'rawtx',
        version: PeginVersion.V0
      };

      jest.spyOn(peginService, 'getPeginComponents').mockResolvedValue(mockProofComponents);

      const [proofs, aggregateValue] = await peginService.processUtxos(
        utxos,
        ethAddress,
        aggregatePublicKey,
        tip
      );

      expect(proofs).toHaveLength(2);
      expect(aggregateValue).toBe(300000);
    });

    it('should skip UTXOs with height <= 0', async () => {
      const utxos: UTXOWithCheckpoints[] = [
        { index: 0, hash: 'tx1', value: 100000, height: 0 },
        { index: 1, hash: 'tx2', value: 200000, height: 100 }
      ];
      const ethAddress = '1234567890123456789012345678901234567890';
      const aggregatePublicKey = '02abcdef1234567890';
      const tip = 120;

      const mockProofComponents: ProofComponents = {
        txId: 'tx2',
        vout: 1,
        merkleProof: Buffer.from('proof'),
        blockHeaders: [Buffer.from('header')],
        ethAddress,
        aggregatePublicKey,
        rawTx: 'rawtx',
        version: PeginVersion.V0
      };

      jest.spyOn(peginService, 'getPeginComponents').mockResolvedValue(mockProofComponents);

      const [proofs, aggregateValue] = await peginService.processUtxos(
        utxos,
        ethAddress,
        aggregatePublicKey,
        tip
      );

      expect(proofs).toHaveLength(1);
      expect(aggregateValue).toBe(200000);
    });
  });

  describe('getPeginComponents', () => {
    it('should return V1 proof components for UTXO with checkpoint', async () => {
      const utxo: UTXOWithCheckpoints = {
        index: 0,
        hash: 'tx1',
        value: 100000,
        height: 100,
        bitcoinCheckpoint: {
          l2BlockHash: '0xabc123',
          l1CheckpointHash: '0xdef456',
          utxoHeight: 105
        }
      };
      const ethAddress = '1234567890123456789012345678901234567890';
      const aggregatePublicKey = '02abcdef1234567890';
      const currentTip = 120;

      mockBitcoinServiceInstance.getTransaction.mockResolvedValue('rawtx');
      mockBitcoinServiceInstance.getBlockHash.mockResolvedValue('blockhash');
      mockBitcoinServiceInstance.getBlockHeaderFromHash.mockResolvedValue('deadbeef');
      mockGetMerkleProof.mockResolvedValue(Buffer.from('merkleproof'));

      const result = await peginService.getPeginComponents(
        utxo,
        ethAddress,
        aggregatePublicKey,
        currentTip
      );

      expect(result.version).toBe(PeginVersion.V1);
      expect(result.refL2BlockHash).toBe('0xabc123');
      expect(result.txId).toBe('tx1');
      expect(result.vout).toBe(0);
      expect(result.ethAddress).toBe(ethAddress);
      expect(result.aggregatePublicKey).toBe(aggregatePublicKey);
    });

    it('should return V0 proof components for UTXO without checkpoint', async () => {
      const utxo: UTXOWithCheckpoints = {
        index: 1,
        hash: 'tx2',
        value: 200000,
        height: 100
      };
      const ethAddress = '1234567890123456789012345678901234567890';
      const aggregatePublicKey = '02abcdef1234567890';
      const currentTip = 120;

      mockBitcoinServiceInstance.getTransaction.mockResolvedValue('rawtx');
      mockBitcoinServiceInstance.getBlockHash.mockResolvedValue('blockhash');
      mockBitcoinServiceInstance.getBlockHeaderFromHash.mockResolvedValue('deadbeef');
      mockGetMerkleProof.mockResolvedValue(Buffer.from('merkleproof'));

      const result = await peginService.getPeginComponents(
        utxo,
        ethAddress,
        aggregatePublicKey,
        currentTip
      );

      expect(result.version).toBe(PeginVersion.V0);
      expect(result.refL2BlockHash).toBeUndefined();
      expect(result.txId).toBe('tx2');
      expect(result.vout).toBe(1);
    });
  });

  describe('generatePeginData', () => {
    it('should generate pegin data successfully', async () => {
      const ethereumAddress = '0x1234567890123456789012345678901234567890';
      const bitcoinTxid = 'tx1';
      const utxosWithCheckpoint: UTXOWithCheckpoints[] = [
        { index: 0, hash: 'tx1', value: 100000, height: 100 }
      ];

      // Mock gateway address generation
      jest.spyOn(peginService, 'generateGatewayAddress').mockResolvedValue({
        gatewayAddress: 'tb1qtest123456789',
        aggregatePublicKey: '02abcdef1234567890'
      });

      // Mock UTXO fetching
      jest.spyOn(peginService, 'getGatewayUTXOs').mockResolvedValue([
        { index: 0, hash: 'tx1', value: 100000, height: 100 }
      ]);

      // Mock Bitcoin service calls
      mockBitcoinServiceInstance.getTip.mockResolvedValue(120);
      mockBitcoinServiceInstance.isCoinbaseTx.mockResolvedValue(false);

      // Mock processUtxos
      const mockProofComponents: ProofComponents = {
        txId: 'tx1',
        vout: 0,
        merkleProof: Buffer.from('proof'),
        blockHeaders: [Buffer.from('header')],
        ethAddress: '1234567890123456789012345678901234567890',
        aggregatePublicKey: '02abcdef1234567890',
        rawTx: 'rawtx',
        version: PeginVersion.V0
      };

      jest.spyOn(peginService, 'processUtxos').mockResolvedValue([
        [mockProofComponents],
        100000
      ]);

      mockGeneratePeginProof.mockReturnValue(Buffer.from('serializedproof'));

      const result = await peginService.generatePeginData(
        ethereumAddress,
        bitcoinTxid,
        utxosWithCheckpoint
      );

      expect(result.proof).toHaveLength(1);
      expect(result.utxoHeight).toBe(100);
      expect(result.value).toBe(100000);
    });

    it('should throw error when UTXO not found', async () => {
      const ethereumAddress = '0x1234567890123456789012345678901234567890';
      const bitcoinTxid = 'nonexistent';
      const utxosWithCheckpoint: UTXOWithCheckpoints[] = [];

      jest.spyOn(peginService, 'generateGatewayAddress').mockResolvedValue({
        gatewayAddress: 'tb1qtest123456789',
        aggregatePublicKey: '02abcdef1234567890'
      });

      jest.spyOn(peginService, 'getGatewayUTXOs').mockResolvedValue([]);

      await expect(
        peginService.generatePeginData(ethereumAddress, bitcoinTxid, utxosWithCheckpoint)
      ).rejects.toThrow('UTXO nonexistent not found for address tb1qtest123456789');
    });

    it('should throw error when not enough confirmations', async () => {
      const ethereumAddress = '0x1234567890123456789012345678901234567890';
      const bitcoinTxid = 'tx1';
      const utxosWithCheckpoint: UTXOWithCheckpoints[] = [];

      jest.spyOn(peginService, 'generateGatewayAddress').mockResolvedValue({
        gatewayAddress: 'tb1qtest123456789',
        aggregatePublicKey: '02abcdef1234567890'
      });

      jest.spyOn(peginService, 'getGatewayUTXOs').mockResolvedValue([
        { index: 0, hash: 'tx1', value: 100000, height: 100 }
      ]);

      mockBitcoinServiceInstance.getTip.mockResolvedValue(99); // Less than UTXO height
      mockBitcoinServiceInstance.isCoinbaseTx.mockResolvedValue(false);

      await expect(
        peginService.generatePeginData(ethereumAddress, bitcoinTxid, utxosWithCheckpoint)
      ).rejects.toThrow('Not enough confirmations: 0/1');
    });

    it('should throw error when gateway address generation fails', async () => {
      const ethereumAddress = '0x1234567890123456789012345678901234567890';
      const bitcoinTxid = 'tx1';
      const utxosWithCheckpoint: UTXOWithCheckpoints[] = [];

      jest.spyOn(peginService, 'generateGatewayAddress').mockResolvedValue({
        gatewayAddress: '',
        aggregatePublicKey: '02abcdef1234567890'
      });

      await expect(
        peginService.generatePeginData(ethereumAddress, bitcoinTxid, utxosWithCheckpoint)
      ).rejects.toThrow('Failed to generate gateway address');
    });
  });
});