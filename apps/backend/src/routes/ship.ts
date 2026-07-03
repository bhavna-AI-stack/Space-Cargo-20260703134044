import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

router.post('/upgrade', async (req, res) => {
  const { userId, upgradeType, stat } = req.body;
  const requestedUpgrade = upgradeType ?? (stat === 'shield' ? 'shieldLevel' : stat === 'fuel' ? 'fuelLevel' : undefined);

  if (requestedUpgrade !== 'shieldLevel' && requestedUpgrade !== 'fuelLevel') {
    return res.status(400).json({ success: false, message: "Invalid or unsupported upgrade type" });
  }

  try {
    const updatedUser = await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.findUnique({ where: { id: userId }, include: { ship: true } });
      if (!user || !user.ship) throw new Error("User not found");

      let currentLevel = 0;
      let cost = 0;

      if (requestedUpgrade === 'shieldLevel') {
        currentLevel = user.ship.shieldLevel;
        cost = currentLevel * 150;
      } else if (requestedUpgrade === 'fuelLevel') {
        currentLevel = user.ship.fuelLevel;
        cost = currentLevel * 125;
      }

      if (user.coins < cost) {
        throw new Error("Not enough coins");
      }

      return await tx.user.update({
        where: { id: userId },
        data: {
          coins: { decrement: cost },
          ship: {
            update: {
              [requestedUpgrade]: { increment: 1 }
            }
          }
        },
        include: { ship: true }
      });
    });

    res.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error("Upgrade error:", error);
    res.status(500).json({ success: false, message: error.message || "Upgrade failed" });
  }
});

export default router;
