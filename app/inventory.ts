export interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
  minStock: number;
  reorderQuantity: number;
  supplierId: number;
}

const INVENTORY_KEY = 'monad_erp_inventory_v2';

export function getSavedInventory(): Product[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(INVENTORY_KEY);
  if (!data) {
    const defaults: Product[] = [
      { id: 1, name: 'Insumo Software Enterprise', price: 0.05, stock: 3, minStock: 2, reorderQuantity: 10, supplierId: 1 },
      { id: 2, name: 'Suscripción Cloud Node', price: 0.02, stock: 15, minStock: 5, reorderQuantity: 20, supplierId: 1 },
    ];
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(defaults));
    return defaults;
  }
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveInventory(products: Product[]) {
  localStorage.setItem(INVENTORY_KEY, JSON.stringify(products));
}

export function addProduct(product: Omit<Product, 'id'>) {
  const inventory = getSavedInventory();
  const newProd: Product = { ...product, id: Date.now() };
  const updated = [newProd, ...inventory];
  saveInventory(updated);
  return updated;
}
