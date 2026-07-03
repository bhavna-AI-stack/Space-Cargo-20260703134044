export interface UserProfile {
  id: string;
  telegramId?: string;
  walletAddress?: string;
  username: string;
  coins: number;
  xp: number;
  highScore: number;
}

export interface GameSession {
  id: string;
  userId: string;
  distance: number;
  cargoCollected: number;
  coinsEarned: number;
  xpEarned: number;
}

export interface ShipState {
  health: number;
  maxHealth: number;
  fuel: number;
  maxFuel: number;
  speed: number;
  shieldActive: boolean;
}

export * from './types';
