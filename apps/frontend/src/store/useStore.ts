import { create } from 'zustand';
import { socket } from '../lib/socket';
import type { UserProfile, ShipState, PlayerStats } from 'shared';

type GameScreen = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'SHOP' | 'LEADERBOARD' | 'HOW_TO_PLAY' | 'ACHIEVEMENTS' | 'HANGAR';
type PowerUpKind = 'Shield' | 'Magnet' | 'Double Score' | 'Slow Motion';

interface RunStats {
  finalScore: number;
  bestScore: number;
  distance: number;
  coins: number;
  cargo: number;
  timeSurvived: number;
  achievementNames: string[];
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
}

interface Mission {
  id: string;
  label: string;
  progress: number;
  target: number;
  reward: string;
  completed: boolean;
}

interface ShipSkin {
  id: string;
  name: string;
  color: string;
  unlock: string;
  unlocked: boolean;
}

interface UsernameUpdateResult {
  success: boolean;
  message?: string;
}

interface RewardSignatureResult {
  success: boolean;
  tokenAmount?: string;
  nonce?: number;
  signature?: string;
  remainingCoins?: number;
  error?: string;
}

type WithdrawStatus = 'idle' | 'signing' | 'confirming' | 'success' | 'error';

interface GameState {
  user: UserProfile | null;
  liveFeed: UserProfile[];
  topRunners: UserProfile[] | null;
  isBackendWakingUp: boolean;
  leaderboardError: boolean;
  ship: ShipState | null;
  gameState: GameScreen;
  distance: number;
  coinsCollected: number;
  cargoCollected: number;
  timeSurvived: number;
  bestScore: number;
  runStartedAt: number | null;
  lastRunStats: RunStats | null;
  activePowerUp: { type: PowerUpKind; remainingMs: number } | null;
  soundEnabled: boolean;
  musicEnabled: boolean;
  selectedSkinId: string;
  achievements: Achievement[];
  missions: Mission[];
  shipSkins: ShipSkin[];
  
  // Ship Health & Upgrades
  health: number;
  maxHealth: number;
  shieldLevel: number;
  
  fuel: number;
  maxFuel: number;
  fuelLevel: number;
  
  setUser: (user: UserProfile) => void;
  setShip: (ship: ShipState) => void;
  setGameState: (state: GameScreen) => void;
  setDistance: (dist: number) => void;
  setTimeSurvived: (seconds: number) => void;
  setActivePowerUp: (powerUp: { type: PowerUpKind; remainingMs: number } | null) => void;
  toggleSound: () => void;
  toggleMusic: () => void;
  selectSkin: (skinId: string) => void;
  addCoins: (coins: number) => void;
  incrementCargo: () => void;
  resetRun: () => void;
  pushToLiveFeed: (user: UserProfile) => void;
  fetchLeaderboard: () => Promise<void>;
  fetchLiveFeed: () => Promise<void>;
  updateUsername: (newName: string) => Promise<UsernameUpdateResult | undefined>;
  
  getPilotLevel: () => number;
  getXpProgress: () => number;

  // New Actions
  syncPlayerStats: (stats: PlayerStats) => void;
  damageShip: (amount: number) => void;
  upgradeShield: () => Promise<boolean>;
  drainFuel: (amount: number) => void;
  replenishFuel: (amount: number) => void;
  upgradeFuel: () => Promise<boolean>;
  syncRunResults: (distance: number, coins: number) => Promise<void>;
  
  hasGuestProgress: () => boolean;

  // On-Chain Rewards
  withdrawStatus: WithdrawStatus;
  withdrawError: string | null;
  setWithdrawStatus: (status: WithdrawStatus, error?: string) => void;
  requestRewardSignature: (amount: number) => Promise<RewardSignatureResult>;
}

export const useStore = create<GameState>((set, get) => ({
  user: null,
  liveFeed: [],
  topRunners: null,
  isBackendWakingUp: false,
  leaderboardError: false,
  ship: null,
  gameState: 'MENU',
  distance: 0,
  coinsCollected: 0,
  cargoCollected: 0,
  timeSurvived: 0,
  bestScore: Number(localStorage.getItem('bestScore') || 0),
  runStartedAt: null,
  lastRunStats: null,
  activePowerUp: null,
  soundEnabled: localStorage.getItem('soundEnabled') !== 'false',
  musicEnabled: localStorage.getItem('musicEnabled') !== 'false',
  selectedSkinId: localStorage.getItem('selectedSkinId') || 'standard',
  achievements: [
    { id: 'first-haul', name: 'First Haul', description: 'Secure your first cargo crate.', unlocked: localStorage.getItem('achievement:first-haul') === 'true' },
    { id: 'five-hundred', name: 'Void Sprinter', description: 'Travel 500 meters in a run.', unlocked: localStorage.getItem('achievement:five-hundred') === 'true' },
    { id: 'cargo-chain', name: 'Cargo Chain', description: 'Collect 10 cargo items in one run.', unlocked: localStorage.getItem('achievement:cargo-chain') === 'true' },
    { id: 'survivor', name: 'Cold Nerves', description: 'Survive for 60 seconds.', unlocked: localStorage.getItem('achievement:survivor') === 'true' }
  ],
  missions: [
    { id: 'mission-distance', label: 'Run 750m', progress: 0, target: 750, reward: '+75 XP', completed: false },
    { id: 'mission-cargo', label: 'Secure 12 cargo', progress: 0, target: 12, reward: '+120 credits', completed: false },
    { id: 'mission-survive', label: 'Survive 90s', progress: 0, target: 90, reward: 'Ace skin access', completed: false }
  ],
  shipSkins: [
    { id: 'standard', name: 'Standard Courier', color: '#00ffcc', unlock: 'Unlocked', unlocked: true },
    { id: 'magenta', name: 'Pulse Runner', color: '#ff00ff', unlock: 'Reach 500m', unlocked: localStorage.getItem('skin:magenta') === 'true' || Number(localStorage.getItem('bestScore') || 0) >= 500 },
    { id: 'gold', name: 'Aureate Hauler', color: '#ffd166', unlock: 'Collect 10 cargo in one run', unlocked: localStorage.getItem('skin:gold') === 'true' }
  ],
  
  health: 100,
  maxHealth: 100,
  shieldLevel: 1,
  
  fuel: 100,
  maxFuel: 100,
  fuelLevel: 1,

  withdrawStatus: 'idle' as WithdrawStatus,
  withdrawError: null,

  setUser: (user) => set({ user }),
  setShip: (ship) => set({ ship }),
  setGameState: (gameState) => set({ gameState }),
  setDistance: (distance) => set({ distance }),
  setTimeSurvived: (timeSurvived) => set({ timeSurvived }),
  setActivePowerUp: (activePowerUp) => set({ activePowerUp }),
  toggleSound: () => set((state) => {
    const soundEnabled = !state.soundEnabled;
    localStorage.setItem('soundEnabled', String(soundEnabled));
    return { soundEnabled };
  }),
  toggleMusic: () => set((state) => {
    const musicEnabled = !state.musicEnabled;
    localStorage.setItem('musicEnabled', String(musicEnabled));
    return { musicEnabled };
  }),
  selectSkin: (skinId) => {
    const skin = get().shipSkins.find((item) => item.id === skinId);
    if (!skin?.unlocked) return;
    localStorage.setItem('selectedSkinId', skinId);
    set({ selectedSkinId: skinId });
  },
  addCoins: (coins) => set((state) => ({ coinsCollected: state.coinsCollected + coins })),
  incrementCargo: () => set((state) => ({ cargoCollected: state.cargoCollected + 1 })),
  
  resetRun: () => set((state) => ({ 
    distance: 0, 
    coinsCollected: 0,
    cargoCollected: 0,
    timeSurvived: 0,
    runStartedAt: Date.now(),
    lastRunStats: null,
    activePowerUp: null,
    health: state.maxHealth,
    fuel: state.maxFuel
  })),

  pushToLiveFeed: (feedUser) => set((state) => ({
    liveFeed: [feedUser, ...state.liveFeed].slice(0, 5)
  })),

  getPilotLevel: () => {
    const xp = get().user?.xp || 0;
    return Math.floor(Math.sqrt(xp / 100)) + 1;
  },

  getXpProgress: () => {
    const xp = get().user?.xp || 0;
    const currentLevel = Math.floor(Math.sqrt(xp / 100)) + 1;
    const currentLevelBaseXp = 100 * Math.pow(currentLevel - 1, 2);
    const nextLevelBaseXp = 100 * Math.pow(currentLevel, 2);
    const xpIntoCurrentLevel = xp - currentLevelBaseXp;
    const xpRequiredForNextLevel = nextLevelBaseXp - currentLevelBaseXp;
    return (xpIntoCurrentLevel / xpRequiredForNextLevel) * 100;
  },

  hasGuestProgress: () => {
    const state = get();
    return (
      state.distance > 0 || 
      state.coinsCollected > 0 || 
      state.shieldLevel > 1 || 
      state.fuelLevel > 1 || 
      (state.user?.coins ?? 0) > 0
    );
  },

  syncPlayerStats: (stats: PlayerStats) => {
    const maxHealth = stats.ship.shieldLevel * 100;
    const maxFuel = stats.ship.fuelLevel * 100;
    set({
      shieldLevel: stats.ship.shieldLevel,
      maxHealth,
      health: maxHealth,
      fuelLevel: stats.ship.fuelLevel,
      maxFuel,
      fuel: maxFuel,
      user: { ...get().user, coins: stats.coins } as UserProfile
    });
  },

  damageShip: (amount: number) => {
    const state = get();
    if (state.gameState !== 'PLAYING') return;

    const newHealth = Math.max(0, state.health - amount);
    set({ health: newHealth });
    
    if (newHealth === 0) {
      set({ gameState: 'GAME_OVER' });
    }
  },

  drainFuel: (amount: number) => {
    const state = get();
    if (state.gameState !== 'PLAYING') return;

    const newFuel = Math.max(0, state.fuel - amount);
    set({ fuel: newFuel });

    if (newFuel === 0) {
      set({ gameState: 'GAME_OVER' });
    }
  },

  replenishFuel: (amount: number) => {
    const state = get();
    if (state.gameState !== 'PLAYING') return;

    const newFuel = Math.min(state.maxFuel, state.fuel + amount);
    set({ fuel: newFuel });
  },

  upgradeShield: async () => {
    const state = get();
    if (!state.user) return false;

    const cost = state.shieldLevel * 150;
    if (state.user.coins < cost) return false;

    set({
      user: { ...state.user, coins: state.user.coins - cost },
      shieldLevel: state.shieldLevel + 1,
      maxHealth: (state.shieldLevel + 1) * 100,
      health: (state.shieldLevel + 1) * 100
    });

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const res = await fetch(`${backendUrl}/api/ship/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: state.user.id, stat: 'shield' })
      });
      const data = await res.json();
      
      if (data.success && data.user) {
        const maxHealth = data.user.ship.shieldLevel * 100;
        set({
          user: { ...state.user, coins: data.user.coins },
          shieldLevel: data.user.ship.shieldLevel,
          maxHealth,
          health: maxHealth
        });
        return true;
      } else {
        throw new Error(data.message);
      }
    } catch (e) {
      console.error("Upgrade failed:", e);
      set({
        user: { ...state.user, coins: state.user.coins + cost },
        shieldLevel: state.shieldLevel,
        maxHealth: state.shieldLevel * 100,
        health: state.shieldLevel * 100
      });
      return false;
    }
  },

  upgradeFuel: async () => {
    const state = get();
    if (!state.user) return false;

    const cost = state.fuelLevel * 125;
    if (state.user.coins < cost) return false;

    set({
      user: { ...state.user, coins: state.user.coins - cost },
      fuelLevel: state.fuelLevel + 1,
      maxFuel: (state.fuelLevel + 1) * 100,
      fuel: (state.fuelLevel + 1) * 100
    });

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const res = await fetch(`${backendUrl}/api/ship/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: state.user.id, stat: 'fuel' })
      });
      const data = await res.json();
      
      if (data.success && data.user) {
        const maxFuel = data.user.ship.fuelLevel * 100;
        set({
          user: { ...state.user, coins: data.user.coins },
          fuelLevel: data.user.ship.fuelLevel,
          maxFuel,
          fuel: maxFuel
        });
        return true;
      } else {
        throw new Error(data.message);
      }
    } catch (e) {
      console.error("Upgrade failed:", e);
      set({
        user: { ...state.user, coins: state.user.coins + cost },
        fuelLevel: state.fuelLevel,
        maxFuel: state.fuelLevel * 100,
        fuel: state.fuelLevel * 100
      });
      return false;
    }
  },

  syncRunResults: async (distance: number, coins: number) => {
    const state = get();
    const timeSurvived = state.runStartedAt ? Math.floor((Date.now() - state.runStartedAt) / 1000) : state.timeSurvived;
    const finalScore = distance + coins * 10 + state.cargoCollected * 25 + timeSurvived;
    const bestScore = Math.max(state.bestScore, finalScore, state.user?.highScore || 0);
    const achievementNames: string[] = [];
    const updatedAchievements = state.achievements.map((achievement) => {
      const unlocked =
        achievement.unlocked ||
        (achievement.id === 'first-haul' && state.cargoCollected >= 1) ||
        (achievement.id === 'five-hundred' && distance >= 500) ||
        (achievement.id === 'cargo-chain' && state.cargoCollected >= 10) ||
        (achievement.id === 'survivor' && timeSurvived >= 60);

      if (unlocked && !achievement.unlocked) {
        localStorage.setItem(`achievement:${achievement.id}`, 'true');
        achievementNames.push(achievement.name);
      }

      return { ...achievement, unlocked };
    });

    if (distance >= 500) localStorage.setItem('skin:magenta', 'true');
    if (state.cargoCollected >= 10) localStorage.setItem('skin:gold', 'true');
    localStorage.setItem('bestScore', String(bestScore));

    set({
      bestScore,
      timeSurvived,
      achievements: updatedAchievements,
      missions: state.missions.map((mission) => {
        const progress =
          mission.id === 'mission-distance' ? distance :
          mission.id === 'mission-cargo' ? state.cargoCollected :
          timeSurvived;

        return { ...mission, progress, completed: progress >= mission.target };
      }),
      shipSkins: state.shipSkins.map((skin) => ({
        ...skin,
        unlocked:
          skin.unlocked ||
          (skin.id === 'magenta' && distance >= 500) ||
          (skin.id === 'gold' && state.cargoCollected >= 10)
      })),
      lastRunStats: {
        finalScore,
        bestScore,
        distance,
        coins,
        cargo: state.cargoCollected,
        timeSurvived,
        achievementNames
      }
    });

    if (!state.user) return;
    try {
      const payload = { 
        userId: state.user.id, 
        distance: finalScore, 
        coins, 
        xp: Math.floor(finalScore / 10),
        cargoCollected: state.cargoCollected
      };
      socket.emit('submitScore', payload);
      
      // Auto refresh leaderboard if we just submitted
      get().fetchLeaderboard();
    } catch (e) {
      console.error(e);
    }
  },

  fetchLeaderboard: async () => {
    let timeoutId: any;
    try {
      set({ leaderboardError: false, topRunners: null });
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      
      timeoutId = setTimeout(() => set({ isBackendWakingUp: true }), 3000);
      
      const res = await fetch(`${backendUrl}/api/leaderboard`);
      clearTimeout(timeoutId);
      set({ isBackendWakingUp: false });
      
      const data = await res.json();
      if (data.success && data.leaderboard) {
        set({ topRunners: data.leaderboard });
      } else {
        throw new Error('Leaderboard fetch failed');
      }
    } catch (e) {
      clearTimeout(timeoutId);
      set({ isBackendWakingUp: false, leaderboardError: true, topRunners: [] });
      console.warn('Failed to fetch leaderboard:', e);
    }
  },

  fetchLiveFeed: async () => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const res = await fetch(`${backendUrl}/api/feed`);
      const data = await res.json();
      if (data.success && data.feed) {
        set({ liveFeed: data.feed });
      } else {
        throw new Error('Feed fetch failed');
      }
    } catch (e) {
      console.warn('Failed to fetch live feed history:', e);
    }
  },

  updateUsername: async (newName: string) => {
    const state = get();
    if (!state.user) return;
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const res = await fetch(`${backendUrl}/api/user/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: state.user.id, newName: newName })
      });
      const data = await res.json();
      if (data.success) {
        set({ user: data.user });
        return { success: true };
      }
      return { success: false, message: data.message };
    } catch (e) {
      console.error(e);
      return { success: false, message: 'Server error' };
    }
  },

  setWithdrawStatus: (status: WithdrawStatus, error?: string) => {
    set({ withdrawStatus: status, withdrawError: error || null });
  },

  requestRewardSignature: async (amount: number): Promise<RewardSignatureResult> => {
    const state = get();
    if (!state.user) return { success: false, error: 'Not logged in' };
    if (!state.user.walletAddress) return { success: false, error: 'No wallet connected' };
    if (amount < 100) return { success: false, error: 'Minimum withdrawal is 100 coins' };
    if (state.user.coins < amount) return { success: false, error: 'Insufficient coins' };

    set({ withdrawStatus: 'signing' as WithdrawStatus, withdrawError: null });

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const res = await fetch(`${backendUrl}/api/rewards/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: state.user.id, amount }),
      });
      const data = await res.json();

      if (data.success) {
        // Update local coin balance
        set({
          user: { ...state.user, coins: data.remainingCoins } as UserProfile,
          withdrawStatus: 'confirming' as WithdrawStatus,
        });
        return {
          success: true,
          tokenAmount: data.tokenAmount,
          nonce: data.nonce,
          signature: data.signature,
          remainingCoins: data.remainingCoins,
        };
      } else {
        set({ withdrawStatus: 'error' as WithdrawStatus, withdrawError: data.error });
        return { success: false, error: data.error };
      }
    } catch (e: any) {
      const errorMsg = e.message || 'Failed to request reward signature';
      set({ withdrawStatus: 'error' as WithdrawStatus, withdrawError: errorMsg });
      return { success: false, error: errorMsg };
    }
  },
}));
