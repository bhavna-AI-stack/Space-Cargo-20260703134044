import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

interface WalletModalContextType {
  isWalletModalOpen: boolean;
  openWalletModal: () => void;
  closeWalletModal: () => void;
}

const WalletModalContext = createContext<WalletModalContextType | undefined>(undefined);

export const WalletModalProvider = ({ children }: { children: React.ReactNode }) => {
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  const openWalletModal = useCallback(() => setIsWalletModalOpen(true), []);
  const closeWalletModal = useCallback(() => setIsWalletModalOpen(false), []);

  const value = useMemo(() => ({ 
    isWalletModalOpen, 
    openWalletModal, 
    closeWalletModal 
  }), [isWalletModalOpen, openWalletModal, closeWalletModal]);

  return (
    <WalletModalContext.Provider value={value}>
      {children}
    </WalletModalContext.Provider>
  );
};

export const useWalletModal = () => {
  const context = useContext(WalletModalContext);
  if (!context) {
    throw new Error('useWalletModal must be used within a WalletModalProvider');
  }
  return context;
};
