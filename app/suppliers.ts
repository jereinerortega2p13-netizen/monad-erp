export interface Supplier {
  id: number;
  name: string;
  category: string;
  wallet: string;
}

const SUPPLIERS_KEY = 'monad_erp_suppliers_v1';

export function getSavedSuppliers(): Supplier[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(SUPPLIERS_KEY);
  if (!data) {
    const defaults: Supplier[] = [
      { id: 1, name: 'AWS Cloud Services', category: 'Infraestructura Software', wallet: '0x1234567890abcdef1234567890abcdef12345678' },
      { id: 2, name: 'Distribuidora Logística S.A.', category: 'Insumos y Logística', wallet: '0xabcdef1234567890abcdef1234567890abcdef12' },
      { id: 3, name: 'Agencia Marketing Digital', category: 'Servicios Profesionales', wallet: '0x9876543210fedcba9876543210fedcba98765432' },
    ];
    localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(defaults));
    return defaults;
  }
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveSupplier(supplier: Supplier) {
  const current = getSavedSuppliers();
  const updated = [supplier, ...current];
  localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(updated));
  return updated;
}
