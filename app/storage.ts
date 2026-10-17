export interface Transaction {
  id: number;
  item: string;
  amount: string;
  client: string;
  time: string;
  hash: string;
}

const STORAGE_KEY = 'monad_erp_sales_v1';

export function getSavedSales(): Transaction[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    const defaults = [
      { id: 1, item: 'Licencia Software ERP', amount: '0.05 MON', client: '0x1234...5678', time: '10:00 AM', hash: '0xabc...123' },
      { id: 2, item: 'Suscripción Mensual', amount: '0.02 MON', client: '0xabcd...ef89', time: '10:15 AM', hash: '0xdef...456' },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveSale(sale: Transaction) {
  const current = getSavedSales();
  const updated = [sale, ...current];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
