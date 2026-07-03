import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';

const router = Router();
const prisma = new PrismaClient();

// EIP-712 domain and types for signing reward claims
const EIP712_DOMAIN = {
  name: 'SpaceCargoToken',
  version: '1',
  chainId: parseInt(process.env.CHAIN_ID || '34'),
  verifyingContract: process.env.TOKEN_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000',
};

const EIP712_TYPES = {
  Reward: [
    { name: 'player', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
};

// Minimum coins required to claim (matches contract's 100 token minimum)
const MIN_CLAIM_AMOUNT = 100;

/**
 * POST /api/rewards/sign
 * Body: { userId: string, amount: number }
 * 
 * Validates the user has enough coins, deducts from DB,
 * signs an EIP-712 message, and returns the signature for on-chain claim.
 */
router.post('/sign', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, amount } = req.body;

    if (!userId || !amount || typeof amount !== 'number') {
      res.status(400).json({ error: 'Missing or invalid userId/amount' });
      return;
    }

    if (amount < MIN_CLAIM_AMOUNT) {
      res.status(400).json({ error: `Minimum claim amount is ${MIN_CLAIM_AMOUNT} coins` });
      return;
    }

    const serverPrivateKey = process.env.GAME_SERVER_PRIVATE_KEY;
    if (!serverPrivateKey) {
      console.error('GAME_SERVER_PRIVATE_KEY not configured');
      res.status(500).json({ error: 'Server signing not configured' });
      return;
    }

    // Fetch user and validate
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (!user.walletAddress) {
      res.status(400).json({ error: 'No wallet connected. Connect a wallet first.' });
      return;
    }

    if (user.coins < amount) {
      res.status(400).json({ error: 'Insufficient coins', available: user.coins });
      return;
    }

    // Read current nonce from the smart contract
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'https://mainnet-rpc.scai.network');
    const contractAddress = process.env.TOKEN_CONTRACT_ADDRESS;
    if (!contractAddress) {
      res.status(500).json({ error: 'Token contract address not configured' });
      return;
    }

    // Minimal ABI just for reading nonces
    const nonceAbi = ['function nonces(address) view returns (uint256)'];
    const contract = new ethers.Contract(contractAddress, nonceAbi, provider);
    const nonce = await contract.nonces(user.walletAddress);

    // Convert coins to token amount (18 decimals)
    const tokenAmount = ethers.parseEther(amount.toString());

    // Atomically deduct coins and create claim record
    const [updatedUser, claim] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { coins: { decrement: amount } },
      }),
      prisma.rewardClaim.create({
        data: {
          userId,
          walletAddress: user.walletAddress,
          amount,
          nonce: Number(nonce),
          signature: '', // Will be filled below
          claimed: false,
        },
      }),
    ]);

    // Sign the EIP-712 message
    const signer = new ethers.Wallet(serverPrivateKey);
    const signature = await signer.signTypedData(EIP712_DOMAIN, EIP712_TYPES, {
      player: user.walletAddress,
      amount: tokenAmount,
      nonce: nonce,
    });

    // Update claim record with signature
    await prisma.rewardClaim.update({
      where: { id: claim.id },
      data: { signature },
    });

    res.json({
      success: true,
      amount: amount,
      tokenAmount: tokenAmount.toString(),
      nonce: Number(nonce),
      signature,
      walletAddress: user.walletAddress,
      remainingCoins: updatedUser.coins,
    });
  } catch (error: any) {
    console.error('Error signing reward:', error);
    res.status(500).json({ error: 'Failed to sign reward claim' });
  }
});

/**
 * GET /api/rewards/nonce/:walletAddress
 * Returns the current on-chain nonce for a wallet address.
 */
router.get('/nonce/:walletAddress', async (req: Request, res: Response): Promise<void> => {
  try {
    const walletAddress = req.params.walletAddress as string;

    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      res.status(400).json({ error: 'Invalid wallet address' });
      return;
    }

    const contractAddress = process.env.TOKEN_CONTRACT_ADDRESS;
    if (!contractAddress) {
      res.status(500).json({ error: 'Token contract address not configured' });
      return;
    }

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'https://mainnet-rpc.scai.network');
    const nonceAbi = ['function nonces(address) view returns (uint256)'];
    const contract = new ethers.Contract(contractAddress, nonceAbi, provider);
    const nonce = await contract.nonces(walletAddress);

    res.json({ walletAddress, nonce: Number(nonce) });
  } catch (error: any) {
    console.error('Error fetching nonce:', error);
    res.status(500).json({ error: 'Failed to fetch nonce' });
  }
});

/**
 * GET /api/rewards/history/:userId
 * Returns the claim history for a user.
 */
router.get('/history/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.params.userId as string;
    const claims = await prisma.rewardClaim.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json({ claims });
  } catch (error: any) {
    console.error('Error fetching claim history:', error);
    res.status(500).json({ error: 'Failed to fetch claim history' });
  }
});

export default router;
