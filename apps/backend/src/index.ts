import "dotenv/config";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import shipRoutes from "./routes/ship";
import rewardsRouter from './routes/rewards';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Auth & Profile Endpoint
app.post("/api/auth", async (req, res) => {
  const { userId, telegramId, username, isGuest } = req.body;

  try {
    let user;

    if (isGuest) {
      if (userId) {
        user = await prisma.user.findUnique({
          where: { id: userId },
          include: { ship: true }
        });
      } else if (username && username.startsWith('guest_')) {
        user = await prisma.user.findFirst({
          where: { username },
          include: { ship: true }
        });
      }
      
      if (!user) {
        // Create new guest user
        const guestId = `guest_${Date.now()}`;
        user = await prisma.user.create({
          data: {
            username: guestId,
            usernameLowercase: guestId.toLowerCase(),
            ship: {
              create: {}
            }
          },
          include: { ship: true }
        });
      }
    } else {
      // Telegram User
      user = await prisma.user.findUnique({
        where: { telegramId },
        include: { ship: true }
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            telegramId,
            username,
            usernameLowercase: username.toLowerCase(),
            ship: {
              create: {}
            }
          },
          include: { ship: true }
        });
      }
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error("Auth error:", error);
    res.status(500).json({ success: false, message: "Authentication failed" });
  }
});

// Shop / Upgrade Endpoint (Mounted)
app.use("/api/ship", shipRoutes);
app.use('/api/rewards', rewardsRouter);

// Wallet Bind Endpoint
app.post("/api/wallet/bind", async (req, res) => {
  const { userId, walletAddress } = req.body;

  if (!userId || !walletAddress) {
    return res.status(400).json({ success: false, message: "Missing userId or walletAddress" });
  }

  try {
    const existingWalletUser = await prisma.user.findUnique({
      where: { walletAddress },
      include: { ship: true }
    });

    if (existingWalletUser) {
      return res.json({ success: true, user: existingWalletUser });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { walletAddress },
      include: { ship: true }
    });

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Wallet bind error:", error);
    res.status(500).json({ success: false, message: "Failed to bind wallet" });
  }
});

// Leaderboard Endpoint
app.get("/api/leaderboard", async (req, res) => {
  try {
    const topUsers = await prisma.user.findMany({
      orderBy: { highScore: 'desc' },
      take: 10,
      select: { id: true, username: true, highScore: true, xp: true }
    });
    res.json({ success: true, leaderboard: topUsers });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch leaderboard" });
  }
});

// Sync Run Results Endpoint
app.post("/api/user/sync", async (req, res) => {
  const { userId, distance, coins, xp, cargoCollected } = req.body;
  
  if (
    typeof distance !== 'number' || distance < 0 || distance > 250000 ||
    typeof coins !== 'number' || coins < 0 || coins > 5000 ||
    typeof xp !== 'number' || xp < 0 || xp > 25000 ||
    typeof cargoCollected !== 'number' || cargoCollected < 0 || cargoCollected > 1000
  ) {
    return res.status(400).json({ success: false, message: "Payload validation failed. Invalid run parameters." });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          coins: { increment: coins },
          xp: { increment: xp },
          highScore: distance > user.highScore ? distance : user.highScore
        },
        include: { ship: true }
      });
      
      await prisma.gameSession.create({
        data: {
          userId,
          distance,
          coinsEarned: coins,
          xpEarned: xp,
          cargoCollected: cargoCollected
        }
      });
      res.json({ success: true, user: updatedUser });
    } else {
      res.status(404).json({ success: false, message: "User not found" });
    }
  } catch (error) {
    console.error("Sync error:", error);
    res.status(500).json({ success: false, message: "Sync failed" });
  }
});

app.post("/api/user/rename", async (req, res) => {
  const { userId, newName } = req.body;
  if (!userId || !newName || typeof newName !== 'string' || newName.length < 3 || newName.length > 20) {
    return res.status(400).json({ success: false, message: "Invalid name (3-20 chars)" });
  }
  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { 
        username: newName,
        usernameLowercase: newName.toLowerCase()
      },
      include: { ship: true }
    });
    res.json({ success: true, user: updatedUser });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: "Name already taken" });
    }
    console.error("Rename error:", error);
    res.status(500).json({ success: false, message: "Failed to rename" });
  }
});

app.get("/api/leaderboard", async (req, res) => {
  try {
    const topUsers = await prisma.user.findMany({
      orderBy: { highScore: "desc" },
      take: 10,
      select: { id: true, username: true, highScore: true }
    });
    res.json({ success: true, leaderboard: topUsers });
  } catch (error) {
    console.error("Leaderboard error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch leaderboard" });
  }
});

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
  
  socket.on("submitScore", async (data) => {
    const { userId, distance, coins, xp, cargoCollected } = data;
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            coins: { increment: coins },
            xp: { increment: xp },
            highScore: distance > user.highScore ? distance : user.highScore
          }
        });
        
        await prisma.gameSession.create({
          data: {
            userId,
            distance,
            coinsEarned: coins,
            xpEarned: xp,
            cargoCollected: cargoCollected || 0
          }
        });

        const updatedUser = await prisma.user.findUnique({ where: { id: userId }, include: { ship: true } });
        io.emit("scoreUpdated", updatedUser);
      }
    } catch (e) {
      console.error(e);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
