import { useState, useEffect, useRef } from 'react';
import { useConnect, useAccount, useDisconnect } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Download, ExternalLink, Wallet, AlertCircle, AlertTriangle, Smartphone, Copy, Check, ArrowLeft } from 'lucide-react';
import { useStore } from '../../store/useStore';

const UI_STATES = {
  DEFAULT: 'DEFAULT',
  INSTALL_METAMASK: 'INSTALL_METAMASK',
  INSTALL_RAINBOW: 'INSTALL_RAINBOW',
  CONNECTING: 'CONNECTING',
  ERROR: 'ERROR',
  MOBILE_INSTALL_REQUIRED: 'MOBILE_INSTALL_REQUIRED',
  MOBILE_ACTION_REQUIRED: 'MOBILE_ACTION_REQUIRED',
  IN_APP_BROWSER: 'IN_APP_BROWSER',
  WARNING: 'WARNING'
} as const;

type UiState = typeof UI_STATES[keyof typeof UI_STATES];

interface ProvenanceWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Build the dapp URL used for wallet deep-links (no scheme, e.g. "krrish41.github.io/space-cargo-runner/").
const getDappHostPath = () => {
  if (typeof window === 'undefined') return '';
  return `${window.location.host}${window.location.pathname}`;
};
const getFullUrl = () => (typeof window === 'undefined' ? '' : window.location.href);

type WalletTarget = 'metamask' | 'rainbow';

const getWalletTarget = (connector: any): WalletTarget => {
  const name = (connector?.name || '').toLowerCase();
  if (name.includes('rainbow')) return 'rainbow';
  return 'metamask';
};

const WALLET_META: Record<WalletTarget, { label: string; deepLink: () => string; install: string }> = {
  metamask: {
    label: 'MetaMask',
    deepLink: () => `https://metamask.app.link/dapp/${getDappHostPath()}`,
    install: 'https://metamask.io/download/'
  },
  rainbow: {
    label: 'Rainbow',
    deepLink: () => `https://rnbwapp.com/dapp/${getDappHostPath()}`,
    install: 'https://rainbow.me/download'
  }
};

const ProvenanceWalletModal = ({ isOpen, onClose }: ProvenanceWalletModalProps) => {
  const { connectAsync, connectors, error: connectError, reset } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const [errorMessage, setErrorMessage] = useState<string>('The connection was aborted or timed out.');
  const { isConnecting, isConnected } = useAccount();
  const [uiState, setUiState] = useState<UiState>(UI_STATES.DEFAULT);
  const [selectedConnector, setSelectedConnector] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const connectionTimeout = useRef<NodeJS.Timeout | null>(null);
  const { hasGuestProgress } = useStore();

  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isInAppBrowser = typeof navigator !== 'undefined' && /Twitter|Instagram|FBAV|FB_IAB|Telegram|Line|Snapchat/i.test(navigator.userAgent);
  const hasInjectedProvider = () => typeof window !== 'undefined' && !!(window as any).ethereum;

  const walletTarget: WalletTarget = getWalletTarget(selectedConnector);
  const walletMeta = WALLET_META[walletTarget];

  // Auto-close on successful connection
  useEffect(() => {
    if (isConnected) {
      if (connectionTimeout.current) clearTimeout(connectionTimeout.current);
      onClose();
    }
  }, [isConnected, onClose]);

  // Aggressive In-App (wallet) Browser Auto-Connect: if a provider is already injected on mobile, link it.
  useEffect(() => {
    if (isMobile && !isConnected && hasInjectedProvider()) {
      const injectedConnector =
        connectors.find(c => c.id === 'injected') ||
        connectors.find(c =>
          c.name.toLowerCase().includes('metamask') ||
          c.name.toLowerCase().includes('rainbow')
        );

      if (injectedConnector) {
        console.log('[Provenance] Web3 browser detected. Auto-connecting...');
        connectAsync({ connector: injectedConnector }).catch(console.error);
      }
    }
  }, [isConnected, connectors, connectAsync]);

  // Handle Wagmi connection errors
  useEffect(() => {
    if (connectError && selectedConnector) {
      if (
        connectError.message?.includes('already connected') ||
        connectError.message?.includes('Connector not found') ||
        connectError.message?.includes('Resource unavailable')
      ) {
        return;
      }

      if (connectionTimeout.current) clearTimeout(connectionTimeout.current);

      const isUserRejection =
        connectError.name === 'UserRejectedRequestError' ||
        connectError.message?.toLowerCase().includes('user rejected') ||
        connectError.message?.toLowerCase().includes('user denied') ||
        (connectError as any)?.code === 4001;

      if (isUserRejection) {
        setErrorMessage('You declined the connection request. Tap a provider to try again.');
        setUiState(UI_STATES.ERROR);
      } else {
        if (!isMobile) {
          console.warn('[Provenance] Desktop connection error:', connectError.message);
          setErrorMessage(connectError?.message || 'Connection failed.');
          setUiState(UI_STATES.ERROR);
          return;
        }
        setUiState(UI_STATES.MOBILE_INSTALL_REQUIRED);
      }
    }
  }, [connectError, isMobile, selectedConnector]);

  useEffect(() => {
    const blockingStates: UiState[] = [
      UI_STATES.INSTALL_METAMASK,
      UI_STATES.INSTALL_RAINBOW,
      UI_STATES.MOBILE_INSTALL_REQUIRED,
      UI_STATES.IN_APP_BROWSER,
      UI_STATES.MOBILE_ACTION_REQUIRED
    ];
    if (isConnecting && !blockingStates.includes(uiState)) {
      setUiState(UI_STATES.CONNECTING);
    }
  }, [isConnecting, uiState]);

  const handleConnectorClick = async (connector: any) => {
    setSelectedConnector(connector);
    setCopied(false);
    if (connectionTimeout.current) clearTimeout(connectionTimeout.current);

    if (isMobile) {
      // Inside a wallet's in-app browser a provider is injected — connect straight away.
      if (hasInjectedProvider()) {
        const injected = connectors.find(c => c.id === 'injected') || connector;
        handleProceedConnection(injected);
        return;
      }
      // Social media in-app webviews can't inject a wallet at all.
      if (isInAppBrowser) {
        setUiState(UI_STATES.IN_APP_BROWSER);
        return;
      }
      // Regular mobile browser — offer to open the game inside the wallet app.
      setUiState(UI_STATES.MOBILE_ACTION_REQUIRED);
      return;
    }

    const name = connector.name.toLowerCase();
    const win = window as any;
    const hasInjected = hasInjectedProvider();
    const isMetaMask = hasInjected && !!win.ethereum.isMetaMask;
    const isRainbow = hasInjected && !!win.ethereum.isRainbow;

    if (name.includes('metamask') && !isMetaMask) {
      setUiState(UI_STATES.INSTALL_METAMASK);
      return;
    }

    if (name.includes('rainbow') && !isRainbow) {
      setUiState(UI_STATES.INSTALL_RAINBOW);
      return;
    }

    if (hasGuestProgress() && uiState !== UI_STATES.WARNING) {
      setUiState(UI_STATES.WARNING);
      return;
    }

    handleProceedConnection(connector);
  };

  const handleProceedConnection = async (connectorToConnect: any = selectedConnector) => {
    if (!connectorToConnect) return;
    try {
      if (reset) reset();

      // Force clear any stale Wagmi state before connecting
      if (disconnectAsync) {
        await disconnectAsync({ connector: connectorToConnect }).catch(() => {});
      }

      setUiState(UI_STATES.CONNECTING);

      // Add a 10s timeout since MetaMask is known to hang if requests are queued silently
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT_HANG')), 10000)
      );

      await Promise.race([
        connectAsync({ connector: connectorToConnect, chainId: 34 }),
        timeoutPromise
      ]);
    } catch (err: any) {
      console.error('[Provenance] Connect error:', err);
      const msg = err?.message?.toLowerCase() || '';

      if (msg.includes('already connected')) {
        // Just let the auto-close handle it
        return;
      }

      if (msg.includes('timeout_hang')) {
        setErrorMessage('Your wallet is not responding. Open the wallet extension to check for a pending request, or refresh the page.');
      } else if (msg.includes('resource unavailable') || msg.includes('already processing')) {
        setErrorMessage('The wallet is already open in the background. Click the wallet extension icon to continue.');
      } else if (err.name === 'UserRejectedRequestError' || msg.includes('user rejected')) {
        setErrorMessage('You declined the connection request. Tap a provider to try again.');
      } else {
        setErrorMessage(err?.shortMessage || err?.message || 'The connection was aborted or timed out.');
      }

      setUiState(UI_STATES.ERROR);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getFullUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  const backToList = () => {
    setUiState(UI_STATES.DEFAULT);
    setSelectedConnector(null);
    setCopied(false);
  };

  useEffect(() => {
    if (!isOpen) {
      if (connectionTimeout.current) clearTimeout(connectionTimeout.current);
      setUiState(UI_STATES.DEFAULT);
      setSelectedConnector(null);
      setCopied(false);
    }
  }, [isOpen]);

  const visibleConnectors = connectors
    .filter((connector, index, self) =>
      index === self.findIndex((c) => c.name === connector.name)
    )
    .filter(c =>
      c.id !== 'walletConnect' &&
      c.name.toLowerCase() !== 'injected'
    );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="modal-backdrop">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'absolute', inset: 0 }}
          />

          <motion.div
            className="wallet-modal"
            initial={{ scale: 0.94, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          >
            <button onClick={onClose} className="wallet-modal__close" aria-label="Close">
              <X size={22} />
            </button>

            {/* Aside - Provider List */}
            <div className="wallet-modal__aside">
              <div className="wallet-modal__brand">
                <span className="wallet-modal__eyebrow">Provider Uplink</span>
                <h3 className="wallet-modal__aside-title">Link your wallet</h3>
              </div>

              <div className="wallet-modal__providers">
                {visibleConnectors.map((connector) => {
                  const isSelected = selectedConnector?.id === connector.id;
                  return (
                    <button
                      key={connector.id}
                      onClick={() => handleConnectorClick(connector)}
                      className={`provider-btn ${isSelected ? 'selected' : ''}`}
                    >
                      <span className="provider-btn__icon">
                        <Wallet size={18} color={isSelected ? '#00ffcc' : '#8899b5'} />
                      </span>
                      <span className="provider-btn__name">{connector.name}</span>
                    </button>
                  );
                })}
              </div>

              <div className="wallet-modal__note">
                <span className="status-light connected" style={{ width: '7px', height: '7px', flexShrink: 0 }} />
                Non-custodial. We never touch your keys.
              </div>
            </div>

            {/* Stage - Dynamic States */}
            <div className="wallet-modal__stage">
              <AnimatePresence mode="wait">
                {uiState === UI_STATES.DEFAULT ? (
                  <motion.div
                    key="default"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="wallet-stage__inner"
                  >
                    <div className="wallet-stage__halo">
                      <Wallet size={44} />
                    </div>
                    <h2 className="wallet-stage__title">System standby</h2>
                    <p className="wallet-stage__body">
                      Select a provider to authenticate your ship and establish an uplink.
                    </p>
                  </motion.div>
                ) : uiState === UI_STATES.CONNECTING ? (
                  <motion.div
                    key="connecting"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="wallet-stage__inner"
                  >
                    <div style={{ position: 'relative', width: '84px', height: '84px' }}>
                      <motion.div
                        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.1, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        style={{ position: 'absolute', inset: 0, background: '#00ffcc', borderRadius: '50%', filter: 'blur(20px)' }}
                      />
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                        style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px dashed rgba(0, 255, 204, 0.5)' }}
                      />
                      <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '50%', border: '2px solid rgba(0, 255, 204, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}>
                          <Loader2 size={30} color="#00ffcc" />
                        </motion.div>
                      </div>
                    </div>
                    <h3 className="wallet-stage__title" style={{ fontSize: '1.15rem' }}>Awaiting signature</h3>
                    <p className="wallet-stage__body">Confirm the connection request in {walletMeta.label}.</p>
                  </motion.div>
                ) : uiState === UI_STATES.ERROR ? (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="wallet-stage__inner"
                  >
                    <div className="wallet-stage__halo wallet-stage__halo--danger">
                      <AlertCircle size={40} />
                    </div>
                    <h3 className="wallet-stage__title">Connection failed</h3>
                    <p className="wallet-stage__body">{errorMessage}</p>
                    <button onClick={backToList} className="wallet-stage__link">Back to providers</button>
                  </motion.div>
                ) : (uiState === UI_STATES.INSTALL_METAMASK || uiState === UI_STATES.INSTALL_RAINBOW) ? (
                  <motion.div
                    key="install"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="wallet-stage__inner"
                  >
                    <div className="wallet-stage__halo wallet-stage__halo--soft">
                      <Download size={38} />
                    </div>
                    <h2 className="wallet-stage__title">
                      {uiState === UI_STATES.INSTALL_METAMASK ? 'MetaMask not detected' : 'Rainbow not detected'}
                    </h2>
                    <p className="wallet-stage__body">Install the browser extension, then reload and link again.</p>
                    <a
                      href={uiState === UI_STATES.INSTALL_METAMASK ? WALLET_META.metamask.install : WALLET_META.rainbow.install}
                      target="_blank"
                      rel="noreferrer"
                      className="physical-btn primary wallet-stage__cta"
                    >
                      Install {uiState === UI_STATES.INSTALL_METAMASK ? 'MetaMask' : 'Rainbow'}
                      <ExternalLink size={16} />
                    </a>
                    <button onClick={backToList} className="wallet-stage__link">Back to providers</button>
                  </motion.div>
                ) : uiState === UI_STATES.MOBILE_ACTION_REQUIRED ? (
                  <motion.div
                    key="mobile-action"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="wallet-stage__inner"
                  >
                    <div className="wallet-stage__halo">
                      <Smartphone size={38} />
                    </div>
                    <h2 className="wallet-stage__title">Open in {walletMeta.label}</h2>
                    <p className="wallet-stage__body">
                      Mobile browsers can't link a wallet directly. Open the game inside {walletMeta.label}'s
                      built-in browser to connect and auto-link.
                    </p>
                    <a href={walletMeta.deepLink()} className="physical-btn primary wallet-stage__cta">
                      Open in {walletMeta.label}
                      <ExternalLink size={16} />
                    </a>
                    <button onClick={handleCopyLink} className="wallet-stage__ghost-btn">
                      {copied ? <><Check size={15} /> Link copied</> : <><Copy size={15} /> Copy game link</>}
                    </button>
                    <button onClick={backToList} className="wallet-stage__link">
                      <ArrowLeft size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                      Back
                    </button>
                  </motion.div>
                ) : uiState === UI_STATES.IN_APP_BROWSER ? (
                  <motion.div
                    key="inapp"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="wallet-stage__inner"
                  >
                    <div className="wallet-stage__halo wallet-stage__halo--soft">
                      <ExternalLink size={36} />
                    </div>
                    <h2 className="wallet-stage__title">Open in your browser</h2>
                    <p className="wallet-stage__body">
                      This in-app view can't reach a wallet. Tap the menu and choose "Open in browser" (or in {walletMeta.label}),
                      then link again.
                    </p>
                    <a href={walletMeta.deepLink()} className="physical-btn primary wallet-stage__cta">
                      Open in {walletMeta.label}
                      <ExternalLink size={16} />
                    </a>
                    <button onClick={handleCopyLink} className="wallet-stage__ghost-btn">
                      {copied ? <><Check size={15} /> Link copied</> : <><Copy size={15} /> Copy game link</>}
                    </button>
                    <button onClick={backToList} className="wallet-stage__link">Back</button>
                  </motion.div>
                ) : uiState === UI_STATES.MOBILE_INSTALL_REQUIRED ? (
                  <motion.div
                    key="mobile-install"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="wallet-stage__inner"
                  >
                    <div className="wallet-stage__halo wallet-stage__halo--soft">
                      <Smartphone size={38} />
                    </div>
                    <h2 className="wallet-stage__title">Get {walletMeta.label}</h2>
                    <p className="wallet-stage__body">
                      We couldn't reach {walletMeta.label} on this device. Install the app, then open the game inside it.
                    </p>
                    <a href={walletMeta.install} target="_blank" rel="noreferrer" className="physical-btn primary wallet-stage__cta">
                      Get {walletMeta.label}
                      <ExternalLink size={16} />
                    </a>
                    <button onClick={handleCopyLink} className="wallet-stage__ghost-btn">
                      {copied ? <><Check size={15} /> Link copied</> : <><Copy size={15} /> Copy game link</>}
                    </button>
                    <button onClick={backToList} className="wallet-stage__link">Back</button>
                  </motion.div>
                ) : uiState === UI_STATES.WARNING ? (
                  <motion.div
                    key="warning"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="wallet-stage__inner"
                  >
                    <div className="wallet-stage__halo wallet-stage__halo--danger">
                      <AlertTriangle size={44} />
                    </div>
                    <h2 className="wallet-stage__title wallet-stage__title--danger">Heads up</h2>
                    <p className="wallet-stage__body">
                      Linking a wallet replaces your current guest progress with your saved profile. Continue?
                    </p>
                    <div className="wallet-stage__actions">
                      <button onClick={backToList} className="physical-btn wallet-stage__cta-secondary">
                        Keep playing
                      </button>
                      <button onClick={() => handleProceedConnection()} className="physical-btn primary wallet-stage__cta-inline">
                        Link anyway
                      </button>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ProvenanceWalletModal;
