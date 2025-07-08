# Botanix Sidecar SDK

A SDK for seamless integration with Botanix protocol, enabling Bitcoin deposits (pegins) to the Botanix network.

[![NPM version](https://img.shields.io/npm/v/botanix-sidecar-sdk.svg)](https://www.npmjs.com/package/botanix-sidecar-sdk)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Features

- **Pegin Operations**
- **Multi-format Support** - Works with both CommonJS (require) and ESM (import) syntax
- **Bitcoin Network Compatibility** - Support for mainnet, and mutinynet

## Prerequisites

Before using the Botanix Sidecar SDK, ensure you have the following infrastructure components:

### Required Components

1. **Bitcoin Node (bitcoind)**

   - Running Bitcoin Core node with RPC access enabled
   - Required for UTXO verification and transaction data
   - Must be synced to the network you're using (mainnet/mutinynet)

2. **Botanix RPC URL**

   - Access to a Botanix network RPC endpoint
   - Required for generating gateway addresses and interacting with L2
   - Example: `https://rpc.botanixlabs.com`

3. **Electrum Server**
   - Provides UTXO data and transaction verification

### Optional Components (Based on Pegin Requirements)

4. **Checkpoint Mappings** ⚠️
   - **Only required for pegins with more than 200 block confirmations**
   - Must implement continuous checkpoint storage system
   - Maps Bitcoin UTXO heights to corresponding L2 block states
   - Essential for Pegin Version 1 (V1)
   - **Not needed for pegins with less than 200 confirmations** (Pegin V0)
   - **[See how to store checkpoints](#how-to-store-checkpoints)**

## Installation

```bash
# Using npm
npm install botanix-sidecar-sdk

# Using yarn
yarn add botanix-sidecar-sdk

```

## Quick Start

```typescript
import { BotanixSDK } from "botanix-sidecar-sdk";
// Or using CommonJS: const { BotanixSDK } = require("botanix-sidecar-sdk");

// Initialize the SDK
const sdk = new BotanixSDK({
	botanixRpcUrl: "https://rpc.botanixlabs.io",
	mintContractAddress: "0x123...", // Your mint contract address
	bitcoinNetwork: "testnet", // "mainnet" or "signet"
	// You must provide either electrumServer and bitcoindConfig
	electrumServer: {
		host: "electrum.example.com",
		port: 50002,
		protocol: "ssl", // "ssl" or "tcp"
	},
	bitcoindConfig: {
		host: "000.0.0.0",
		port: 0000,
		username: "rpcuser",
		password: "rpcpassword",
	},
});
```

## Deposit (Pegin)

### Step 1: Generate a Gateway Address

First, generate a Bitcoin gateway address linked to your Ethereum address:

```typescript
// Generate a gateway address for deposits
const { gatewayAddress, aggregatePublicKey } =
	await sdk.pegin.generateGatewayAddress("0xYourEthereumAddress");
console.log("Bitcoin gateway address for deposits:", gatewayAddress);
```

### Step 2: Send Bitcoin to the Gateway Address

Send Bitcoin to the generated gateway address using any Bitcoin wallet. For a successful deposit:

- **Confirmation Requirements**:
  - Mainnet: Transaction must have at least 19 confirmations
  - mutinynet: Transaction requires only 1 confirmation
  - Coinbase transactions (newly mined coins) require 100 confirmations regardless of network

Once the transaction has the required confirmations, you can generate the proof needed for depositing your funds on Botanix.

### Step 3: Check for UTXOs

After sending Bitcoin, check for Unspent Transaction Outputs (UTXOs) at the gateway address:

```typescript
// Get UTXOs for the gateway address
const utxos = await sdk.pegin.getGatewayUTXOs(gatewayAddress);

// Log all UTXOs
console.log("Available UTXOs:", utxos);

// Example UTXO output:
// [
//   {
//     hash: "abc123...", // Transaction ID
//     index: 0,          // Output index
//     value: 1000000,    // Amount in satoshis
//     height: 789101     // Block height where confirmed
//   },
//   ...
// ]

// Find the specific UTXO by transaction ID
const bitcoinTxid = "abc123..."; // Your Bitcoin transaction ID
const utxo = utxos.find((u) => u.hash === bitcoinTxid);

if (utxo) {
	console.log("Found UTXO:", utxo);
	console.log("Amount (satoshis):", utxo.value);
	console.log(
		"Confirmations:",
		(await sdk.getBitcoinService().getTip()) - utxo.height + 1
	);
}
```

### Step 4: Get Bitcoin Checkpoint Data

The Bitcoin checkpoint data is **compulsory** for creating a valid pegin proof for deposits higher than 200 block confirmations. This data links your Bitcoin transaction to the corresponding Botanix L2 block and ensures your pegin can be validated against the correct blockchain state.

**Critical Requirement**: The `utxowithcheckpoint` must use the **pegin checkpoint** - not just any checkpoint. The pegin checkpoint is specifically calculated to correspond to a Bitcoin UTXO height where the the corresponding `l1CheckpointHash(bitcoin_block_hash)` hash has changed exactly `confirmationDepth + 1` times.

#### Understanding Pegin Checkpoints

Your service should maintain a mapping between Bitcoin UTXO heights and their corresponding L2 block states. **For successful pegin operations, checkpoints must be stored continuously** - this is optional for pegin V0 but a critical requirement of the pegin V1.

**Continuous Checkpoint Storage Requirements:**

- Your service must store checkpoints periodically and continuously
- Each checkpoint maps a Bitcoin UTXO height to its corresponding L2 block state
- Without continuous storage, the correct checkpoint for a pegin cannot be retrieved

#### How to Store Checkpoints

Here's how to properly store checkpoints for pegin operations:

**Checkpoint Data Structure:**

```typescript
// The checkpoint data should include:
// - l2BlockHash: The L2 block hash at the checkpoint
// - l1CheckpointHash: The Bitcoin checkpoint hash(L1 block hash)
// - utxoHeight: UTXO height of the corresponding checkpoint

interface Checkpoint {
	l2BlockHash: string; // Layer 2 block hash
	l1CheckpointHash: string; // Layer 1 Bitcoin checkpoint hash
}

interface PeginCheckpoint {
	utxoHeight: number; // Unique UTXO height (primary key)
	checkpoint: Checkpoint; // The checkpoint data
	createdAt: Date; // Timestamp of creation
}
```

**Storage Function:**

```typescript
// Store a checkpoint mapping for a specific UTXO height
async function storePeginCheckpointMapping(
	utxoHeight: number, // Unique UTXO height
	l2BlockHash: string, // Layer 2 block hash (hex string)
	l1CheckpointHash: string // Layer 1 Bitcoin checkpoint hash (hex string)
): Promise<void> {
	// Implementation should:
	// 1. Check if checkpoint already exists for this utxoHeight
	// 2. If exists, return (no duplicates)
	// 3. If not exists, create new checkpoint record
	// 4. Store with current timestamp
}
```

**Example Usage:**

```typescript
// Store a checkpoint for UTXO height 789101
await storePeginCheckpointMapping(
	789101,
	"0x9b5d47fdbe9b2a3927783f97e9e478da3e346536d22b10e5b8036a32d88b3844",
	"0x1234567890abcdef1234567890abcdef12345678"
);
```

#### Get latest block from Botanix node

To obtain the proper pegin checkpoint for the latest UTXO:

```typescript
// First, get your UTXO height from the Bitcoin transaction
const utxoHeight = 789101; // Block height where your transaction was confirmed

// Call the Botanix RPC endpoint to get checkpoint data
const response = await fetch(sdk.config.botanixRpcUrl, {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({
		jsonrpc: "2.0",
		method: "eth_getBlockByNumber",
		// The third parameter must be true to include extraDataHeader
		params: ["latest", false, true],
		id: 1,
	}),
});

const data = await response.json();
```

**Automatic Checkpoint Storage:**
For continuous operation, implement periodic checkpoint storage:

```typescript
// Start automatic checkpoint storage
function startPeriodicCheckpointStorage() {
	setInterval(async () => {
		try {
			// Get latest block from Botanix node
			const block = await getBlockByNumber("latest", true);

			// Extract Bitcoin block hash from extraDataHeader
			const bitcoinBlockHash = block.extraDataHeader.bitcoin_block_hash;

			// Get current Bitcoin tip height
			const tipHeight = await sdk.getBitcoinService().getTip();

			// Store the checkpoint mapping
			await storePeginCheckpointMapping(tipHeight, block.hash, bitcoinBlockHash);
		} catch (error) {
			console.error("Failed to store checkpoint:", error);
		}
	}, CONFIG.CHECKPOINT_STORAGE_INTERVAL_MS);
}
```

**Important Storage Guidelines:**

1. **Uniqueness**: Each `utxoHeight` can only have one checkpoint mapping
2. **Error Handling**: Implement proper try-catch blocks as storage can fail
3. **Continuous Operation**: Use periodic storage for real-time pegin support
4. **Database**: Use persistent storage with proper indexing on `utxoHeight`

This checkpoint system ensures:

1. **Bitcoin transactions are validated against confirmed L2 states**
2. **Confirmation depth requirements are met**
3. **Pegin proofs can be validated against the correct L2 block state**

#### Pegin Versions and Checkpoint Requirements

There are two versions of pegin processing with different checkpoint requirements:

**Pegin Version 0 (V0):**

- Does not require a checkpoint for standard operations
- Used when no matching checkpoint is found in the system
- Can only be used when a pegin transaction has less than 200 block confirmations

**Pegin Version 1 (V1):**

- **Checkpoint is required when UTXOs have more than 200 confirmations**
- Uses the `l2BlockHash` from the checkpoint data
- Provides enhanced security and validation for high-confirmation transactions
- Recommended approach for newer pegin operations

#### Verification Requirements

**Before using a V1, verify:**

1. **Confirmation Depth**: The checkpoint must represent the state after the required confirmation depth has been reached
1. **L1 Block Hash Changes**: The checkpoint must be calculated from the point where the L1 block hash has changed the required number of times

**Warning**: Using an incorrect checkpoint (not the pegin checkpoint) will result in:

- Invalid pegin proofs
- Transaction rejection by the mint contract

### Step 5: Check for UTXOs

After sending Bitcoin and retrieving the checkpoint data, check for Unspent Transaction Outputs (UTXOs) at the gateway address:

```typescript
// Get UTXOs for the gateway address
const utxos = await sdk.pegin.getGatewayUTXOs(gatewayAddress);

// Log all UTXOs
console.log("Available UTXOs:", utxos);

// Example UTXO output:
// [
//   {
//     hash: "abc123...", // Transaction ID
//     index: 0,          // Output index
//     value: 1000000,    // Amount in satoshis
//     height: 789101     // Block height where confirmed
//   },
//   ...
// ]

// Find the specific UTXO by transaction ID
const bitcoinTxid = "abc123..."; // Your Bitcoin transaction ID
const utxo = utxos.find((u) => u.hash === bitcoinTxid);

if (utxo) {
	console.log("Found UTXO:", utxo);
	console.log("Amount (satoshis):", utxo.value);
	console.log(
		"Confirmations:",
		(await sdk.getBitcoinService().getTip()) - utxo.height
	);
}
```

### Step 6: Generate Pegin Proof

After identifying your UTXO, use the checkpoint data you retrieved earlier to construct the UTXO with checkpoint and generate the pegin proof:

```typescript
// IMPORTANT: You must find the UTXO height where the L1 block hash
// has changed exactly confirmationDepth + 1 times from your UTXO height.
// This ensures you're using the pegin checkpoint, not just any checkpoint.

// Define the Bitcoin transaction ID from your deposit
const bitcoinTxid = "abc123..."; // Your Bitcoin transaction ID

// Define UTXOs with checkpoint data
const utxosWithCheckpoint = [
	{
		hash: bitcoinTxid, // Transaction ID from your deposit
		index: 0, // Output index (usually 0 for simple transactions)
		value: 1000000, // Amount in satoshis
		height: 789101, // Block height where the transaction was confirmed

		// checkpoint data for Version 1 pegins
		bitcoinCheckpoint: {
			l2BlockHash: "0x...", // L2 block hash from Botanix node
			l1CheckpointHash: "0x...", // L1 checkpoint hash from Botanix node
			utxoHeight: 789101, // utxo height of corresponding checkpoint
		},
	},
];

// Generate pegin proof data
const {
	proof: peginProofs,
	utxoHeight,
	value,
} = await sdk.pegin.generatePeginData(
	"0xYourEthereumAddress",
	bitcoinTxid,
	utxosWithCheckpoint
);

console.log("Proof:", proof);
console.log("UTXO Height:", utxoHeight);
console.log("Total Value:", value);
```

### Step 7: Call the Mint Contract

Use the generated proof to claim your funds on the Botanix network by calling the mint contract:

```typescript
// Set up your Ethereum signer
const provider = new ethers.providers.JsonRpcProvider(
	"https://your-botanix-rpc.io"
);
const wallet = new ethers.Wallet("YOUR_PRIVATE_KEY", provider);

// Create a contract instance
const mintContract = new ethers.Contract(
	sdk.config.mintContractAddress,
	mintABI, // Import your contract ABI
	wallet
);

// flatten the whole array of pegin proofs
const peginProof = Buffer.concat(peginProofs);

// convert sats to wei
const amountBN = convertAmountToWei(amount);

// Specify a refund address to receive any remaining funds
// This address pays for the transaction and is refunded when the transaction is successful
const refundAddress = "0x123..."; // Your refund address

// Call the mint function with your proof
const tx = await mintContract.mint(
	"0xYourEthereumAddress",
	amountBN,
	utxoHeight,
	peginProof,
	refundAddress
);
const receipt = await tx.wait();

console.log("Pegin completed! Transaction hash:", receipt.transactionHash);
```

## Development

### Building the SDK

```bash
# Install dependencies
yarn install

# Build both CommonJS and ESM versions
yarn build

# Development mode with watch
yarn dev
```

### Local Testing

To test the SDK locally without publishing to npm:

```bash
# In the SDK directory
yarn build

# In your application directory
yarn add file:/path/to/botanix-sidecar-sdk
```

### Error Troubleshooting

#### Failed to get gateway address

This error occurs when the SDK cannot connect to the Botanix RPC endpoint or the endpoint doesn't support the required RPC methods:

- Check that your `botanixRpcUrl` is correct

#### Failed to call Bitcoind RPC

This error occurs when the SDK cannot connect to your Bitcoin node:

- Verify that your Bitcoin node is running and accessible
- Check that the `bitcoindConfig` credentials are correct
- Ensure that the node's RPC server is enabled and accepting connections

## Examples

For more examples, check the [examples](./examples) directory in this repository.

## Flow Diagram

The pegin process follows this flow:

1. **Generate Gateway Address** - Create a Bitcoin address linked to your Ethereum address
2. **Send Bitcoin** - Deposit BTC to the gateway address
3. **Wait for Confirmations** - 18 confirmations on mainnet, 1 on signet
4. **Get Bitcoin Checkpoint Data** - Retrieve and store checkpoint data for V1 pegins (required for UTXOs with >200 confirmations)
5. **Check UTXOs** - Verify your transaction is confirmed and available as a UTXO
6. **Generate Pegin Proof** - Create the cryptographic proof using UTXOs with checkpoint data
7. **Call the Mint Contract** - Submit the proof to the mint contract with a refund address to claim your funds on Botanix

## License

[MIT](LICENSE)

## Support

For issues, feature requests, or questions, please create an issue on our [GitHub repository](https://github.com/botanixlabs/botanix-sidecar-sdk/issues).
