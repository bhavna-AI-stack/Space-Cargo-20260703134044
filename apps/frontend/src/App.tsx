import { useEffect, useState, useRef } from 'react';
import { useStore } from './store/useStore';
import { PhaserGame } from './game/PhaserGame';
import { Rocket, Coins, Trophy, Settings, LogOut, User, Pause, Play, Volume2, VolumeX, Music2, Music, Medal, Palette, Shield, Magnet, Gauge, Timer, ArrowDownToLine, Wallet } from 'lucide-react';
import { useAccount, useDisconnect, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther } from 'viem';
import { CONTRACT_ADDRESS, SPACE_CARGO_TOKEN_ABI } from './contracts/SpaceCargoToken';
import { useWalletModal } from './context/WalletModalContext';
import ProvenanceWalletModal from './components/ui/ProvenanceWalletModal';
import EditPilotModal from './components/ui/EditPilotModal';
import { socket } from './lib/socket';
import type { UserProfile } from 'shared';
import './App.css';
import './styles/console.css';

interface AuthPayload {
  isGuest: true;
  userId?: string;
  username?: string;
}

function App() {
  const {
    gameState,
    distance,
    coinsCollected,
    cargoCollected,
    timeSurvived,
    bestScore,
    lastRunStats,
    activePowerUp,
    soundEnabled,
    musicEnabled,
    achievements,
    missions,
    shipSkins,
    selectedSkinId,
    health,
    maxHealth,
    shieldLevel,
    fuel,
    maxFuel,
    fuelLevel,
    setGameState,
    resetRun,
    user,
    setUser,
    syncPlayerStats,
    upgradeShield,
    upgradeFuel,
    toggleSound,
    toggleMusic,
    selectSkin
  } = useStore();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [walletBound, setWalletBound] = useState(false);
  const [isEditNameModalOpen, setIsEditNameModalOpen] = useState(false);
  const initAttempted = useRef(false);
  const { isWalletModalOpen, openWalletModal, closeWalletModal } = useWalletModal();
  const getPilotLevel = useStore((state) => state.getPilotLevel);
  const getXpProgress = useStore((state) => state.getXpProgress);
  const liveFeed = useStore((state) => state.liveFeed);
  const topRunners = useStore((state) => state.topRunners);
  const isBackendWakingUp = useStore((state) => state.isBackendWakingUp);
  const leaderboardError = useStore((state) => state.leaderboardError);
  const fetchLeaderboard = useStore((state) => state.fetchLeaderboard);
  const fetchLiveFeed = useStore((state) => state.fetchLiveFeed);
  const [showFirstRunBrief, setShowFirstRunBrief] = useState(() => localStorage.getItem('tutorialSeen') !== 'true');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const withdrawStatus = useStore((state) => state.withdrawStatus);
  const withdrawError = useStore((state) => state.withdrawError);
  const requestRewardSignature = useStore((state) => state.requestRewardSignature);
  const setWithdrawStatus = useStore((state) => state.setWithdrawStatus);

  // On-chain SCR token balance
  const { data: onChainBalance, refetch: refetchBalance } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SPACE_CARGO_TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Contract write for claiming rewards
  const { writeContract, data: txHash, isPending: isWritePending } = useWriteContract();
  const { isLoading: isTxConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Handle successful transaction confirmation
  useEffect(() => {
    if (isTxSuccess) {
      setWithdrawStatus('success');
      refetchBalance();
      setWithdrawAmount('');
      // Auto-reset status after 5 seconds
      const timer = setTimeout(() => setWithdrawStatus('idle'), 5000);
      return () => clearTimeout(timer);
    }
  }, [isTxSuccess]);

  // Handle withdrawal submission
  const handleWithdraw = async () => {
    const amount = parseInt(withdrawAmount);
    if (isNaN(amount) || amount < 100) {
      setWithdrawStatus('error', 'Minimum withdrawal is 100 coins');
      return;
    }

    const result = await requestRewardSignature(amount);
    if (result.success && result.tokenAmount && result.signature !== undefined && result.nonce !== undefined) {
      try {
        writeContract({
          address: CONTRACT_ADDRESS,
          abi: SPACE_CARGO_TOKEN_ABI,
          functionName: 'claimReward',
          args: [BigInt(result.tokenAmount), BigInt(result.nonce), result.signature as `0x${string}`],
        });
      } catch (e: any) {
        setWithdrawStatus('error', e.message || 'Transaction failed');
      }
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    fetchLiveFeed();
    socket.on('scoreUpdated', (updatedUser: UserProfile) => {
      // If this is the current player, sync their new state locally
      if (user && updatedUser.id === user.id) {
        setUser(updatedUser);
      }
      useStore.getState().pushToLiveFeed(updatedUser);
    });

    return () => {
      socket.off('scoreUpdated');
    };
  }, [user, setUser]);

  // Initialize Guest User
  useEffect(() => {
    if (!user && !initAttempted.current) {
      initAttempted.current = true;
      const initGuest = async () => {
        try {
          const storedGuestId = localStorage.getItem('guestId');
          const storedUserId = localStorage.getItem('userId');
          
          const payload: AuthPayload = { isGuest: true };
          if (storedUserId) payload.userId = storedUserId;
          else if (storedGuestId) payload.username = storedGuestId;

          const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
          const res = await fetch(`${backendUrl}/api/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (data.success && data.user) {
            localStorage.setItem('userId', data.user.id);
            localStorage.setItem('guestId', data.user.username); // Keep for legacy
            setUser(data.user);
            syncPlayerStats(data.user);
          } else {
            throw new Error('Backend auth failed: ' + (data.message || 'No user returned'));
          }
        } catch (e) {
          console.warn('Failed to init guest from backend. Falling back to offline mode:', e);
          // Offline Fallback so the game doesn't permanently lock out
          const offlineUser = {
            id: 'offline-' + Math.random().toString(36).substring(2, 9),
            username: 'Offline Pilot',
            coins: 0,
            highScore: 0,
            shipEngineLevel: 1,
            shipHandlingLevel: 1,
            shipShieldLevel: 1,
            walletAddress: undefined,
            xp: 0
          };
          setUser(offlineUser);
        }
      };
      initGuest();
    }
  }, [user, setUser]);

  useEffect(() => {
    // If a wallet is connected and we haven't bound it to this session user yet
    if (isConnected && address && user && !walletBound) {
      const bindWallet = async () => {
        try {
          const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
          const res = await fetch(`${backendUrl}/api/wallet/bind`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, walletAddress: address })
          });
          const data = await res.json();
          if (data.success && data.user) {
            console.log('Wallet bound successfully:', data.user.walletAddress);
            localStorage.setItem('userId', data.user.id);
            setUser(data.user);
            setWalletBound(true);
            syncPlayerStats(data.user);
          } else {
            throw new Error('Backend wallet bind failed: ' + (data.message || 'No user returned'));
          }
        } catch (e) {
          console.warn('Failed to bind wallet with backend. Simulating local bind.', e);
          setUser({ ...user, walletAddress: address as string, username: 'Linked Pilot' });
          setWalletBound(true);
        }
      };
      bindWallet();
    }
  }, [isConnected, address, user, walletBound]);

  const handleStart = () => {
    localStorage.setItem('tutorialSeen', 'true');
    setShowFirstRunBrief(false);
    resetRun();
    setGameState('PLAYING');
  };

  const handleOpenLeaderboard = () => {
    fetchLeaderboard();
    setGameState('LEADERBOARD');
  };

  const handleDismissBrief = () => {
    localStorage.setItem('tutorialSeen', 'true');
    setShowFirstRunBrief(false);
  };

  const displayedRun = lastRunStats || {
    finalScore: distance + coinsCollected * 10 + cargoCollected * 25 + timeSurvived,
    bestScore,
    distance,
    coins: coinsCollected,
    cargo: cargoCollected,
    timeSurvived,
    achievementNames: []
  };

  const hudScore = distance + coinsCollected * 10 + cargoCollected * 25 + timeSurvived;
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const PowerIcon = activePowerUp?.type === 'Shield' ? Shield : activePowerUp?.type === 'Magnet' ? Magnet : activePowerUp?.type === 'Slow Motion' ? Gauge : Timer;
  const screenClass = `screen-${gameState.toLowerCase().replaceAll('_', '-')}`;

  return (
    <>
      <PhaserGame />
      
      <div className={`console-overlay ${screenClass}`}>
        
        {/* Top Cockpit Bar: HUD & Player ID */}
        <div className="hud-cockpit">
          <div className="hud-cluster" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
              <>
                <div className="hud-bars" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div className="hud-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '0.7rem', color: '#8899b5', letterSpacing: '2px', marginBottom: '4px' }}>HULL INTEGRITY</div>
                    <div className="health-bar-container">
                      <div 
                        className="health-bar-fill" 
                        style={{ width: `${(health / maxHealth) * 100}%`, background: health > 30 ? 'var(--primary)' : '#ff005a' }}
                      ></div>
                    </div>
                    <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>{health} / {maxHealth} HP</div>
                  </div>

                  <div className="hud-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '0.7rem', color: '#8899b5', letterSpacing: '2px', marginBottom: '4px' }}>FUEL CORE DISSIPATION</div>
                    <div className="fuel-bar-container">
                      <div className="fuel-bar-fill" style={{ width: `${(fuel / maxFuel) * 100}%` }}></div>
                    </div>
                    <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>{Math.floor(fuel)} / {maxFuel} EU</div>
                  </div>

                  {/* EXPERIENCE/RANK */}
                  <div className="hud-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '0.7rem', color: '#00ffcc', letterSpacing: '2px', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <span>PILOT RANK</span>
                      <span>LVL {getPilotLevel()}</span>
                    </div>
                    <div className="fuel-bar-container" style={{ width: '150px' }}>
                      <div className="xp-bar-fill" style={{ width: `${getXpProgress()}%` }}></div>
                    </div>
                  </div>
                </div>

                <div className="hud-item hud-mini-stat">
                  <Rocket className="text-primary" />
                  <span className="stat-value">{Math.floor(distance)}m</span>
                </div>
                <div className="hud-item hud-mini-stat">
                  <Coins className="text-secondary" color="#ff00ff" />
                  <span className="stat-value">{coinsCollected}</span>
                </div>
                <div className="hud-score-card">
                  <span>Score</span>
                  <strong>{hudScore}</strong>
                  <small>{formatTime(timeSurvived)} | Cargo {cargoCollected}</small>
                </div>
                {activePowerUp && (
                  <div className="powerup-pill">
                    <PowerIcon size={18} />
                    <span>{activePowerUp.type}</span>
                    <strong>{Math.ceil(activePowerUp.remainingMs / 1000)}s</strong>
                  </div>
                )}
              </>
            )}
          </div>

        </div>

        {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
          <div className="quick-controls console-interactive">
            <button className="icon-btn" title={gameState === 'PAUSED' ? 'Resume' : 'Pause'} onClick={() => setGameState(gameState === 'PAUSED' ? 'PLAYING' : 'PAUSED')}>
              {gameState === 'PAUSED' ? <Play size={18} /> : <Pause size={18} />}
            </button>
            <button className="icon-btn" title={soundEnabled ? 'Sound off' : 'Sound on'} onClick={toggleSound}>
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button className="icon-btn" title={musicEnabled ? 'Music off' : 'Music on'} onClick={toggleMusic}>
              {musicEnabled ? <Music2 size={18} /> : <Music size={18} />}
            </button>
          </div>
        )}

        {/* Interactive Top-Right Wallet Panel */}
        <div className="console-interactive wallet-panel-container">
          <div className="player-id-panel">
            <div className={`status-light ${isConnected ? 'connected' : 'disconnected'}`}></div>
            
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div className="profile-avatar">
                  <User size={24} color={isConnected ? "var(--primary)" : "#8899b5"} />
                </div>
                <div className="pilot-meta" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.8rem', color: '#8899b5' }}>
                    {isConnected ? 'LINKED PILOT' : 'GUEST PILOT'}
                  </span>
                  <strong 
                    style={{ fontSize: '1.2rem', letterSpacing: '1px', cursor: 'pointer', borderBottom: '1px dashed #444' }}
                    onClick={() => setIsEditNameModalOpen(true)}
                    title="Click to change name"
                  >
                    {user.username}
                  </strong>
                </div>
                <div className="wallet-credits" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: '20px' }}>
                  <span style={{ fontSize: '0.8rem', color: '#ff00ff', letterSpacing: '2px' }}>CREDITS</span>
                  <strong style={{ fontSize: '1.2rem', color: '#ff00ff' }}>{user.coins} <Coins size={14} style={{ display: 'inline', verticalAlign: 'middle' }}/></strong>
                </div>
                {isConnected ? (
                  <button 
                    className="disconnect-btn" 
                    onClick={() => {
                      disconnect();
                      localStorage.removeItem('guestId');
                      window.location.reload();
                    }}
                    title="Disconnect Wallet"
                  >
                    <LogOut size={16} />
                  </button>
                ) : (
                  <button className="physical-btn primary" style={{ padding: '6px 12px', fontSize: '0.7rem', marginLeft: '10px' }} onClick={openWalletModal}>
                    LINK WALLET
                  </button>
                )}
              </div>
            ) : (
              <button onClick={openWalletModal} className="connect-prompt">
                <Wallet size={15} />
                <span>Link wallet</span>
              </button>
            )}
          </div>
        </div>

        {/* Center CRT Screens */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }} className="center-stage">
          
          {gameState === 'MENU' && (
             <div className="menu-screen" style={{ textAlign: 'center', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
               <h1 className="neon-title">Space Cargo<br/>Runner</h1>

               {showFirstRunBrief && (
                 <div className="tutorial-brief">
                  <div>
                    <strong>First flight brief</strong>
                    <span>Move with arrow keys or hold left/right on the screen. Collect cargo, fuel, and power-ups. Dodge asteroids, mines, and debris. Press P or Space to pause.</span>
                  </div>
                  <button className="icon-btn" title="Dismiss briefing" onClick={handleDismissBrief}>OK</button>
                 </div>
               )}

               <div className="mission-strip">
                {missions.map((mission) => (
                  <div key={mission.id} className={`mission-chip ${mission.completed ? 'completed' : ''}`}>
                    <span>{mission.label}</span>
                    <strong>{Math.min(mission.progress, mission.target)} / {mission.target}</strong>
                  </div>
                ))}
               </div>

               {/* LIVE COMMS TICKER */}
               <div className="live-comms-ticker" style={{ marginTop: '40px', border: '1px solid #00ffcc', padding: '15px', background: 'rgba(5, 5, 10, 0.85)', backdropFilter: 'blur(4px)', color: '#00ffcc', fontFamily: 'monospace', width: '100%', maxWidth: '600px', height: '140px', overflow: 'hidden', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,255,204,0.1)' }}>
                  <div style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px', borderBottom: '1px solid rgba(0,255,204,0.3)', paddingBottom: '6px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="status-light connected" style={{ width: '8px', height: '8px' }}></div>
                    GLOBAL LIVE COMMS LINK
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left', fontSize: '13px' }}>
                    {liveFeed.length === 0 ? (
                      <span className="blinking" style={{ color: '#8899b5' }}>Awaiting incoming transmissions...</span>
                    ) : (
                      liveFeed.map((feedUser, idx) => (
                        <div key={`${feedUser.id}-${idx}`} className="fade-in-ticker" style={{ display: 'flex', gap: '10px', color: '#fff' }}>
                          <span style={{ color: '#00aaff' }}>[{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                          <span>
                            <strong style={{ color: 'var(--primary)' }}>{feedUser.username}</strong> achieved High Score: <span style={{ color: 'var(--secondary)' }}>{feedUser.highScore}m</span> <span style={{ color: '#ff00ff', fontSize: '11px' }}>(+{feedUser.xp} XP)</span>
                          </span>
                        </div>
                      ))
                    )}
                  </div>
               </div>
             </div>
          )}

          {gameState === 'GAME_OVER' && (
            <div className="crt-panel game-over-panel" style={{ padding: '40px', textAlign: 'center', width: '100%', maxWidth: '400px' }}>
              <h2 className="title emergency-text" style={{ fontSize: '2.5rem' }}>CRITICAL FAILURE</h2>
              <div className="run-summary-grid">
                <div>
                  <span>Final Score</span>
                  <strong>{displayedRun.finalScore}</strong>
                </div>
                <div>
                  <span>Best Score</span>
                  <strong>{displayedRun.bestScore}</strong>
                </div>
                <div>
                  <span>Distance</span>
                  <strong>{displayedRun.distance}m</strong>
                </div>
                <div>
                  <span>Time</span>
                  <strong>{formatTime(displayedRun.timeSurvived)}</strong>
                </div>
                <div>
                  <span>Cargo</span>
                  <strong>{displayedRun.cargo}</strong>
                </div>
                <div>
                  <span>Credits</span>
                  <strong>{displayedRun.coins}</strong>
                </div>
              </div>
              {displayedRun.achievementNames.length > 0 && (
                <div className="unlock-callout">
                  <Medal size={18} />
                  {displayedRun.achievementNames.join(', ')} unlocked
                </div>
              )}
              <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                <button className="physical-btn" onClick={() => setGameState('MENU')}>Return to Menu</button>
                <button className="physical-btn primary" onClick={handleStart}>Reboot Engine</button>
              </div>
            </div>
          )}

          {gameState === 'PAUSED' && (
            <div className="crt-panel pause-panel">
              <h2 className="title" style={{ fontSize: '2rem', textAlign: 'center' }}>PAUSED</h2>
              <div className="pause-stats">
                <span>Score <strong>{hudScore}</strong></span>
                <span>Time <strong>{formatTime(timeSurvived)}</strong></span>
                <span>Distance <strong>{Math.floor(distance)}m</strong></span>
              </div>
              <div className="settings-row">
                <button className="physical-btn" onClick={toggleSound}>{soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />} Sound</button>
                <button className="physical-btn" onClick={toggleMusic}>{musicEnabled ? <Music2 size={18} /> : <Music size={18} />} Music</button>
              </div>
              <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                <button className="physical-btn" onClick={() => setGameState('MENU')}>Abort Run</button>
                <button className="physical-btn primary" onClick={() => setGameState('PLAYING')}><Play size={20} /> Resume</button>
              </div>
            </div>
          )}

          {gameState === 'HOW_TO_PLAY' && (
            <div className="crt-panel manual-panel" style={{ padding: '30px', width: '100%', maxWidth: '500px' }}>
              <h2 className="title" style={{ fontSize: '2rem', textAlign: 'center' }}>SYSTEM MANUAL</h2>
              <div className="manual-entry">
                <Rocket size={42} color="var(--primary)" />
                <div className="manual-text">
                  <strong style={{color: 'var(--primary)'}}>CONTROLS:</strong> Arrow keys or screen hold to steer. P / Space pauses.
                </div>
              </div>
              
              <div className="manual-entry">
                <img src={`${import.meta.env.BASE_URL}assets/cargo.png`} alt="Cargo" className="manual-sprite" />
                <div className="manual-text">
                  <strong style={{color: 'var(--secondary)'}}>CARGO & DATA:</strong> Collect for credits, score, and XP. Data caches are worth more.
                </div>
              </div>
              
              <div className="manual-entry">
                <img src={`${import.meta.env.BASE_URL}assets/asteroid.png`} alt="Asteroid" className="manual-sprite" style={{ filter: 'drop-shadow(0 0 10px rgba(255,0,0,0.5))' }} />
                <div className="manual-text">
                  <strong style={{color: '#ff3366'}}>ASTEROID:</strong> Dodge. Hits drain fuel.
                </div>
              </div>
              
              <div className="manual-entry">
                <img src={`${import.meta.env.BASE_URL}assets/fuel.png`} alt="Fuel" className="manual-sprite" style={{ filter: 'drop-shadow(0 0 10px rgba(0,170,255,0.5))' }} />
                <div className="manual-text">
                  <strong style={{color: '#00aaff'}}>FUEL:</strong> Replenish. Running empty ends session.
                </div>
              </div>

              <div className="manual-entry">
                <Shield size={42} color="#63ff8f" />
                <div className="manual-text">
                  <strong style={{color: '#63ff8f'}}>POWER-UPS:</strong> Shield, Magnet, Double Score, and Slow Motion appear during runs.
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <button className="physical-btn" onClick={() => setGameState('MENU')} style={{ margin: '0 auto' }}>Close Manual</button>
              </div>
            </div>
          )}

          {gameState === 'SHOP' && (
            <div className="crt-panel shop-panel" style={{ padding: '30px', width: '100%', maxWidth: '500px' }}>
              <div className="shop-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 className="title" style={{ fontSize: '2rem', margin: 0 }}>SHIP UPGRADES</h2>
                <div style={{ color: '#ff00ff', fontSize: '1.2rem', fontWeight: 'bold', fontFamily: 'Courier New' }}>
                  CREDITS: {user?.coins || 0} <Coins size={16} style={{ display: 'inline', verticalAlign: 'middle' }}/>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'Courier New', marginBottom: '20px' }}>
                <div className="upgrade-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0, 0, 0, 0.4)', padding: '15px', borderRadius: '8px', border: '1px solid #1a2233' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>DEFLECTOR SHIELDS</span>
                    <span style={{ color: '#8899b5' }}>Level {shieldLevel} &rarr; Level {shieldLevel + 1}</span>
                    <span style={{ color: '#8899b5', fontSize: '0.9rem' }}>Max HP: {maxHealth} &rarr; {maxHealth + 100}</span>
                  </div>
                  <button 
                    className="physical-btn" 
                    style={{ minWidth: '150px', padding: '10px' }}
                    onClick={upgradeShield}
                    disabled={!user || user.coins < shieldLevel * 150}
                  >
                    UPGRADE ({shieldLevel * 150} <Coins size={14} style={{ display: 'inline', verticalAlign: 'middle' }}/>)
                  </button>
                </div>
                
                <div className="upgrade-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0, 0, 0, 0.4)', padding: '15px', borderRadius: '8px', border: '1px solid #1a2233' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '1.2rem', color: '#00f0ff' }}>PLASMA FUEL CORE</span>
                    <span style={{ color: '#8899b5' }}>Level {fuelLevel} &rarr; Level {fuelLevel + 1}</span>
                    <span style={{ color: '#8899b5', fontSize: '0.9rem' }}>Capacity: {maxFuel} &rarr; {maxFuel + 100}</span>
                  </div>
                  <button 
                    className="physical-btn" 
                    style={{ minWidth: '150px', padding: '10px' }}
                    onClick={upgradeFuel}
                    disabled={!user || user.coins < fuelLevel * 125}
                  >
                    UPGRADE ({fuelLevel * 125} <Coins size={14} style={{ display: 'inline', verticalAlign: 'middle' }}/>)
                  </button>
                </div>
              </div>

              {/* On-Chain Withdrawal Section */}
              {isConnected && (
                <div style={{ background: 'rgba(0, 0, 0, 0.4)', padding: '15px', borderRadius: '8px', border: '1px solid #ffd166', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '1.2rem', color: '#ffd166', letterSpacing: '1px' }}>WITHDRAW TO WALLET</span>
                      <span style={{ color: '#8899b5', fontSize: '0.85rem' }}>Convert in-game coins to SCR tokens on SecureChain</span>
                    </div>
                    <ArrowDownToLine size={28} color="#ffd166" />
                  </div>

                  {onChainBalance !== undefined && (
                    <div style={{ color: '#ffd166', fontSize: '0.9rem', marginBottom: '10px', fontFamily: 'Courier New' }}>
                      ON-CHAIN BALANCE: {parseFloat(formatEther(onChainBalance as bigint)).toFixed(0)} SCR
                    </div>
                  )}

                  <div className="withdraw-row" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="number"
                      placeholder="Amount (min 100)"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      min={100}
                      max={user?.coins || 0}
                      style={{
                        flex: 1,
                        background: 'rgba(0,0,0,0.6)',
                        border: '1px solid #333',
                        color: '#fff',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        fontFamily: 'Courier New',
                        fontSize: '1rem',
                        outline: 'none',
                      }}
                    />
                    <button
                      className="physical-btn"
                      style={{ minWidth: '140px', padding: '10px', background: withdrawStatus === 'success' ? '#0f3' : undefined }}
                      onClick={handleWithdraw}
                      disabled={
                        !user ||
                        withdrawStatus === 'signing' ||
                        withdrawStatus === 'confirming' ||
                        isWritePending ||
                        isTxConfirming ||
                        !withdrawAmount ||
                        parseInt(withdrawAmount) < 100 ||
                        (user?.coins || 0) < parseInt(withdrawAmount || '0')
                      }
                    >
                      {withdrawStatus === 'signing' ? 'SIGNING...' :
                       withdrawStatus === 'confirming' || isWritePending || isTxConfirming ? 'CONFIRMING...' :
                       withdrawStatus === 'success' ? '✓ CLAIMED!' :
                       'WITHDRAW'}
                    </button>
                  </div>

                  {withdrawStatus === 'error' && withdrawError && (
                    <div style={{ color: '#ff4466', fontSize: '0.85rem', marginTop: '8px' }}>
                      ⚠ {withdrawError}
                    </div>
                  )}
                  {withdrawStatus === 'success' && (
                    <div style={{ color: '#0f3', fontSize: '0.85rem', marginTop: '8px' }}>
                      ✓ Tokens claimed successfully! Check your wallet.
                    </div>
                  )}
                </div>
              )}

              {!isConnected && (
                <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '12px', borderRadius: '8px', border: '1px dashed #444', textAlign: 'center', color: '#8899b5', fontSize: '0.85rem', marginBottom: '20px' }}>
                  <ArrowDownToLine size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                  Connect a wallet to withdraw coins as SCR tokens on SecureChain
                </div>
              )}

              <div style={{ textAlign: 'center' }}>
                <button className="physical-btn" onClick={() => setGameState('MENU')} style={{ margin: '0 auto' }}>Exit Bay</button>
              </div>
            </div>
          )}

          {gameState === 'ACHIEVEMENTS' && (
            <div className="crt-panel meta-panel">
              <h2 className="title" style={{ fontSize: '2rem', textAlign: 'center' }}>PILOT RECORDS</h2>
              <div className="achievement-grid">
                {achievements.map((achievement) => (
                  <div key={achievement.id} className={`achievement-card ${achievement.unlocked ? 'unlocked' : ''}`}>
                    <Medal size={26} />
                    <strong>{achievement.name}</strong>
                    <span>{achievement.description}</span>
                  </div>
                ))}
              </div>
              <div className="mission-list">
                {missions.map((mission) => (
                  <div key={mission.id} className="mission-row">
                    <span>{mission.label}</span>
                    <div className="mission-progress">
                      <div style={{ width: `${Math.min(100, (mission.progress / mission.target) * 100)}%` }}></div>
                    </div>
                    <strong>{mission.completed ? 'Complete' : mission.reward}</strong>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'center' }}>
                <button className="physical-btn" onClick={() => setGameState('MENU')} style={{ margin: '0 auto' }}>Exit Records</button>
              </div>
            </div>
          )}

          {gameState === 'HANGAR' && (
            <div className="crt-panel meta-panel">
              <h2 className="title" style={{ fontSize: '2rem', textAlign: 'center' }}>SHIP HANGAR</h2>
              <div className="skin-grid">
                {shipSkins.map((skin) => (
                  <button
                    key={skin.id}
                    className={`skin-card ${selectedSkinId === skin.id ? 'selected' : ''}`}
                    onClick={() => selectSkin(skin.id)}
                    disabled={!skin.unlocked}
                  >
                    <span className="skin-swatch" style={{ background: skin.color }}></span>
                    <strong>{skin.name}</strong>
                    <small>{skin.unlocked ? selectedSkinId === skin.id ? 'Equipped' : 'Available' : skin.unlock}</small>
                  </button>
                ))}
              </div>
              <div style={{ textAlign: 'center' }}>
                <button className="physical-btn" onClick={() => setGameState('MENU')} style={{ margin: '0 auto' }}>Exit Hangar</button>
              </div>
            </div>
          )}

          {gameState === 'LEADERBOARD' && (
            <div className="crt-panel leaderboard-panel" style={{ padding: '30px', width: '100%', maxWidth: '400px' }}>
              <h2 className="title" style={{ fontSize: '2rem', textAlign: 'center' }}>TOP RUNNERS</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', fontFamily: 'Courier New', marginBottom: '30px' }}>
                {topRunners === null ? (
                  <div style={{ textAlign: 'center', color: '#8899b5', padding: '20px' }}>
                    {isBackendWakingUp 
                      ? "Backend is waking up... this might take around a minute." 
                      : "Fetching data..."}
                  </div>
                ) : leaderboardError ? (
                  <div style={{ textAlign: 'center', color: '#ff4444', padding: '20px' }}>
                    Leaderboard unavailable.
                  </div>
                ) : topRunners.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#8899b5' }}>No runners yet! Be the first!</div>
                ) : (
                  topRunners.map((runner, idx) => (
                    <div key={runner.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1a2233', paddingBottom: '10px' }}>
                      <span style={runner.id === user?.id ? { color: 'var(--secondary)' } : {}}>
                        {idx + 1}. {runner.username} {runner.id === user?.id && '(You)'}
                      </span>
                      <span className="stat-value">{runner.highScore}m</span>
                    </div>
                  ))
                )}
              </div>
              <div style={{ textAlign: 'center' }}>
                <button className="physical-btn" onClick={() => setGameState('MENU')} style={{ margin: '0 auto' }}>Exit Terminal</button>
              </div>
            </div>
          )}

        </div>

        {/* Bottom Physical Dashboard */}
        {(gameState === 'MENU' || gameState === 'GAME_OVER') && (
          <div className="console-dashboard console-interactive">
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="physical-btn primary" onClick={handleStart}>
                <Rocket size={20} /> START ENGINE
              </button>
              <button className="physical-btn" onClick={() => setGameState('SHOP')}>
                <Settings size={20} /> UPGRADES
              </button>
              <button className="physical-btn" onClick={() => setGameState('HANGAR')}>
                <Palette size={20} /> HANGAR
              </button>
              <button className="physical-btn" onClick={() => setGameState('ACHIEVEMENTS')}>
                <Medal size={20} /> RECORDS
              </button>
              <button className="physical-btn" onClick={handleOpenLeaderboard}>
                <Trophy size={20} /> LEADERBOARD
              </button>
              <button className="physical-btn" onClick={() => setGameState('HOW_TO_PLAY')}>
                HOW TO PLAY
              </button>
            </div>
          </div>
        )}

      </div>
      
      <ProvenanceWalletModal isOpen={isWalletModalOpen} onClose={closeWalletModal} />
      {user && (
        <EditPilotModal 
          isOpen={isEditNameModalOpen} 
          onClose={() => setIsEditNameModalOpen(false)} 
          currentName={user.username} 
        />
      )}
    </>
  );
}

export default App;
