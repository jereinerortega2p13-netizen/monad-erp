'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface MetaMaskContextType {
  authenticated: boolean;
  account: string | null;
  balance: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshBalance: () => Promise<void>;
}

const MetaMaskContext = createContext<MetaMaskContextType>({
  authenticated: false,
  account: null,
  balance: null,
  connectWallet: async () => {},
  disconnectWallet: () => {},
  refreshBalance: async () => {},
});

export function MetaMaskProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);

  const fetchRealBalance = async (address: string) => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const hexBalance = await window.ethereum.request({
          method: 'eth_getBalance',
          params: [address, 'latest'],
        });

        const wei = BigInt(hexBalance);
        const mon = (Number(wei) / 1e18).toFixed(3);
        setBalance(mon);
      } catch (err) {
        console.error("Error al consultar saldo en blockchain:", err);
      }
    }
  };

  const refreshBalance = async () => {
    if (account) {
      await fetchRealBalance(account);
    }
  };

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setAuthenticated(true);
          await fetchRealBalance(accounts[0]);
        }
      } catch (error) {
        alert("Error al conectar MetaMask");
      }
    } else {
      alert("Por favor instala MetaMask en tu navegador.");
    }
  };

  const disconnectWallet = () => {
    setAuthenticated(false);
    setAccount(null);
    setBalance(null);
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.request({ method: 'eth_accounts' }).then((accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setAuthenticated(true);
          fetchRealBalance(accounts[0]);
        }
      });

      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setAuthenticated(true);
          fetchRealBalance(accounts[0]);
        } else {
          disconnectWallet();
        }
      });

      window.ethereum.on('chainChanged', () => {
        if (account) fetchRealBalance(account);
      });
    }
  }, []);

  return (
    <MetaMaskContext.Provider value={{ authenticated, account, balance, connectWallet, disconnectWallet, refreshBalance }}>
      {children}
    </MetaMaskContext.Provider>
  );
}

export const useMetaMask = () => useContext(MetaMaskContext);

export default function Providers({ children }: { children: React.ReactNode }) {
  return <MetaMaskProvider>{children}</MetaMaskProvider>;
}
