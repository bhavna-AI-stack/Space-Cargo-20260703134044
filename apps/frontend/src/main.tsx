import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

import { createConfig, http, WagmiProvider } from 'wagmi';
import { polygon, base, mainnet } from 'wagmi/chains';
import { type Chain } from 'viem';

const secureChain = {
  id: 34,
  name: 'SCAI Mainnet',
  nativeCurrency: { name: 'SCAI', symbol: 'SCAI', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet-rpc.scai.network'] },
  },
  blockExplorers: {
    default: { name: 'SecureChain Explorer', url: 'https://explorer.securechain.ai' },
  },
} as const satisfies Chain;
import { injected, walletConnect } from 'wagmi/connectors';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { WalletModalProvider } from './context/WalletModalContext';

const config = createConfig({
  chains: [secureChain, polygon, base, mainnet],
  connectors: [
    injected(), 
    injected({ target: 'metaMask' }),
    injected({ target: 'rainbow' }),
    walletConnect({ 
      projectId: 'c03d4d825a075306ea64eddb747a5446',
      showQrModal: false,
      metadata: {
        name: 'Space Cargo Runner',
        description: 'Retro Web3 Game',
        url: typeof window !== 'undefined' ? window.location.origin : '',
        icons: []
      }
    }),
  ],
  transports: {
    [secureChain.id]: http(),
    [polygon.id]: http(),
    [base.id]: http(),
    [mainnet.id]: http(),
  },
});

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <WalletModalProvider>
          <App />
        </WalletModalProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
