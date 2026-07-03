export interface ShipUpgrades {
  engineLevel: number;
  shieldLevel: number;
  fuelLevel: number;
  cargoBayLevel: number;
  magnetLevel: number;
}

export interface PlayerStats {
  id: string;
  telegramId?: string;
  walletAddress?: string;
  username: string;
  coins: number;
  xp: number;
  highScore: number;
  ship: ShipUpgrades;
}
