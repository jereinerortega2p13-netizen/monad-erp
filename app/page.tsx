'use client';

import { useMetaMask } from './providers';
import { useState, useEffect } from 'react';
import { getSavedSales, saveSale, Transaction } from './storage';
import { getSavedSuppliers, saveSupplier, Supplier } from './suppliers';
import { getSavedInventory, saveInventory, addProduct, Product } from './inventory';
import PerformanceChart from './Chart';

export default function Dashboard() {
  const { authenticated, account, balance, connectWallet, disconnectWallet, refreshBalance } = useMetaMask();
  const [sales, setSales] = useState<Transaction[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventory, setInventory] = useState<Product[]>([]);

  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [autoReorderNotice, setAutoReorderNotice] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Transaction | null>(null);

  // Formulario nuevo producto
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodStock, setProdStock] = useState('');
  const [prodMinStock, setProdMinStock] = useState('');
  const [prodReorderQty, setProdReorderQty] = useState('');
  const [prodSupplierId, setProdSupplierId] = useState('');

  // Formulario nuevo proveedor
  const [newSupName, setNewSupName] = useState('');
  const [newSupCategory, setNewSupCategory] = useState('');
  const [newSupWallet, setNewSupWallet] = useState('');

  useEffect(() => {
    setSales(getSavedSales());
    setSuppliers(getSavedSuppliers());
    setInventory(getSavedInventory());
  }, []);

  const handleSellProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !account) return;

    const product = inventory.find(p => p.id.toString() === selectedProductId);
    if (!product) return;
    if (product.stock <= 0) {
      alert("¡Producto agotado! No hay stock disponible.");
      return;
    }

    try {
      setLoading(true);

      // Verificar red Monad
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x279f' }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x279f',
              chainName: 'Monad Testnet',
              nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
              rpcUrls: ['https://testnet-rpc.monad.xyz'],
              blockExplorerUrls: ['https://testnet.monadexplorer.com/'],
            }],
          });
        }
      }

      // 1. Reducir stock por la venta
      const newStock = product.stock - 1;
      let updatedInventory = inventory.map(p => p.id === product.id ? { ...p, stock: newStock } : p);

      const saleTx: Transaction = {
        id: Date.now(),
        item: `Venta: ${product.name}`,
        amount: `+${product.price} MON`,
        client: `${account.slice(0, 6)}...${account.slice(-4)}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        hash: `0x${Math.random().toString(16).substring(2, 10)}...${Math.random().toString(16).substring(2, 6)}`
      };

      let updatedSales = saveSale(saleTx);

      // 2. Evaluar si se alcanzó el Stock Mínimo para ejecutar el pago real al Proveedor
      if (newStock <= product.minStock) {
        const supplier = suppliers.find(s => s.id === product.supplierId);
        const supplierWallet = supplier ? supplier.wallet : account;
        const reorderTotalCost = (product.price * product.reorderQuantity);
        const valueInWei = (reorderTotalCost * 1e18).toString(16);

        setAutoReorderNotice(`⚠️ ALERTA STOCK MÍNIMO: Reordenando automáticamente a ${supplier?.name || 'Proveedor'}. Firma el pago en MetaMask...`);

        // Transacción Blockchain REAL a la wallet del proveedor
        const txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: account,
            to: supplierWallet,
            value: `0x${valueInWei}`
          }],
        });

        // Restablecer stock tras la confirmación de la transacción real
        const restockedQty = newStock + product.reorderQuantity;
        updatedInventory = updatedInventory.map(p => p.id === product.id ? { ...p, stock: restockedQty } : p);

        const autoReorderTx: Transaction = {
          id: Date.now() + 1,
          item: `[REORDEN AUTO] ${product.name} (+${product.reorderQuantity} un.)`,
          amount: `-${reorderTotalCost.toFixed(3)} MON`,
          client: `${supplierWallet.slice(0, 6)}...${supplierWallet.slice(-4)}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          hash: `${txHash.slice(0, 6)}...${txHash.slice(-4)}`
        };

        updatedSales = saveSale(autoReorderTx);
        setAutoReorderNotice(`✅ PAGO REAL ENVIADO EN MONAD: Hash ${txHash.slice(0, 8)}...`);
      }

      saveInventory(updatedInventory);
      setInventory(updatedInventory);
      setSales(updatedSales);
      setSelectedProductId('');

      setTimeout(() => setAutoReorderNotice(null), 6000);
      setTimeout(() => refreshBalance(), 2000);

      alert(`¡Venta y proceso de reorden ejecutado con éxito!`);
    } catch (error) {
      console.error(error);
      alert("La transacción en blockchain fue cancelada o falló.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName || !prodPrice || !prodStock || !prodMinStock || !prodReorderQty || !prodSupplierId) return;

    const updated = addProduct({
      name: prodName,
      price: parseFloat(prodPrice),
      stock: parseInt(prodStock),
      minStock: parseInt(prodMinStock),
      reorderQuantity: parseInt(prodReorderQty),
      supplierId: parseInt(prodSupplierId),
    });

    setInventory(updated);
    setProdName('');
    setProdPrice('');
    setProdStock('');
    setProdMinStock('');
    setProdReorderQty('');
    setProdSupplierId('');
    alert("¡Producto configurado con regla de stock mínimo!");
  };

  const handleAddSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupName || !newSupCategory || !newSupWallet) return;
    const updated = saveSupplier({
      id: Date.now(),
      name: newSupName,
      category: newSupCategory,
      wallet: newSupWallet
    });
    setSuppliers(updated);
    setNewSupName('');
    setNewSupCategory('');
    setNewSupWallet('');
    alert("¡Proveedor registrado con éxito!");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-8 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-lg">E</div>
          <span className="text-xl font-bold tracking-tight">MonadERP <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">Auto-Reorder On-Chain</span></span>
        </div>
        <div>
          {authenticated && account ? (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-slate-400 font-mono">Tesorería: {`${account.slice(0, 6)}...${account.slice(-4)}`}</p>
                <p className="text-sm font-bold text-indigo-400">{balance ? `${balance} MON` : 'Cargando...'}</p>
              </div>
              <button onClick={disconnectWallet} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm font-medium rounded-lg transition">Desconectar</button>
            </div>
          ) : (
            <button onClick={connectWallet} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold rounded-lg shadow-lg shadow-indigo-600/20 transition">Conectar Billetera</button>
          )}
        </div>
      </header>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full space-y-8">
        {autoReorderNotice && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-sm font-medium animate-pulse flex items-center justify-between">
            <span>{autoReorderNotice}</span>
            <span className="text-xs px-2 py-1 bg-amber-500/20 rounded font-bold">ON-CHAIN TX</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-xl">
            <p className="text-sm font-medium text-slate-400">Fondos de Tesorería</p>
            <h3 className="text-3xl font-extrabold mt-2 text-indigo-400">{balance ? `${balance} MON` : '0.000 MON'}</h3>
            <span className="text-xs text-emerald-400 font-medium mt-1 inline-block">Sincronizado con Monad</span>
          </div>
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-xl">
            <p className="text-sm font-medium text-slate-400">Artículos en Inventario</p>
            <h3 className="text-3xl font-extrabold mt-2 text-white">{inventory.length}</h3>
            <span className="text-xs text-amber-400 font-medium mt-1 inline-block">Stock Mínimo con Pago Real</span>
          </div>
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-xl">
            <p className="text-sm font-medium text-slate-400">Transacciones Auditadas</p>
            <h3 className="text-3xl font-extrabold mt-2 text-indigo-400">{sales.length}</h3>
            <span className="text-xs text-indigo-400 font-medium mt-1 inline-block">Historial On-Chain</span>
          </div>
        </div>

        <PerformanceChart sales={sales} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-xl space-y-4">
            <h2 className="text-lg font-bold">Simular Venta (-1 Stock)</h2>
            <p className="text-xs text-slate-400">Al alcanzar el mínimo, MetaMask te solicitará confirmar el pago real al proveedor.</p>

            <form onSubmit={handleSellProduct} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Seleccionar Producto</label>
                <select 
                  value={selectedProductId} 
                  onChange={(e) => setSelectedProductId(e.target.value)} 
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none"
                  required
                >
                  <option value="">-- Elige un producto --</option>
                  {inventory.map(prod => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name} (Stock: {prod.stock} / Mín: {prod.minStock})
                    </option>
                  ))}
                </select>
              </div>

              {selectedProductId && (
                <div className="p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-lg text-xs space-y-1 font-mono">
                  <p className="text-indigo-300">Stock Actual: <span className="text-white font-bold">{inventory.find(p => p.id.toString() === selectedProductId)?.stock}</span></p>
                  <p className="text-indigo-300">Stock Mínimo Trigger: <span className="text-amber-400 font-bold">{inventory.find(p => p.id.toString() === selectedProductId)?.minStock}</span></p>
                  <p className="text-indigo-300">Proveedor Receptor: <span className="text-emerald-400 font-bold">{suppliers.find(s => s.id === inventory.find(p => p.id.toString() === selectedProductId)?.supplierId)?.name || 'N/A'}</span></p>
                </div>
              )}

              <button type="submit" disabled={!authenticated || loading} className={`w-full py-3 rounded-lg text-sm font-semibold ${authenticated ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-800 text-slate-500'}`}>
                {loading ? 'Procesando Transacción...' : authenticated ? 'Vender Producto' : 'Conecta Billetera'}
              </button>
            </form>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-xl space-y-4">
            <h2 className="text-lg font-bold">Registrar Regla de Stock Mínimo</h2>
            <form onSubmit={handleAddProductSubmit} className="space-y-3 pt-1 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Nombre Producto</label>
                <input type="text" value={prodName} onChange={(e) => setProdName(e.target.value)} placeholder="Ej. Chip Integrado X" className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-white focus:outline-none" required />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Precio Unitario (MON)</label>
                  <input type="number" step="0.001" value={prodPrice} onChange={(e) => setProdPrice(e.target.value)} placeholder="0.01" className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-white focus:outline-none" required />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Stock Inicial</label>
                  <input type="number" value={prodStock} onChange={(e) => setProdStock(e.target.value)} placeholder="5" className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-white focus:outline-none" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-amber-400 mb-1">Stock Mínimo</label>
                  <input type="number" value={prodMinStock} onChange={(e) => setProdMinStock(e.target.value)} placeholder="2" className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-white focus:outline-none" required />
                </div>
                <div>
                  <label className="block font-semibold text-emerald-400 mb-1">Cant. a Auto-Comprar</label>
                  <input type="number" value={prodReorderQty} onChange={(e) => setProdReorderQty(e.target.value)} placeholder="10" className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-white focus:outline-none" required />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Proveedor Asignado</label>
                <select value={prodSupplierId} onChange={(e) => setProdSupplierId(e.target.value)} className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-white focus:outline-none" required>
                  <option value="">-- Seleccionar --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold transition">
                Guardar Regla de Auto-Compra
              </button>
            </form>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-xl space-y-4">
            <h2 className="text-lg font-bold">Estado del Almacén</h2>
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-400">
                    <th className="py-2 px-2 font-semibold">Producto</th>
                    <th className="py-2 px-2 font-semibold text-center">Stock</th>
                    <th className="py-2 px-2 font-semibold text-center">Mín</th>
                    <th className="py-2 px-2 font-semibold text-center">Auto-Reorden</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {inventory.map((prod) => (
                    <tr key={prod.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-2 px-2 font-medium text-white">{prod.name}</td>
                      <td className={`py-2 px-2 text-center font-bold ${prod.stock <= prod.minStock ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {prod.stock} un.
                      </td>
                      <td className="py-2 px-2 text-center text-slate-400">{prod.minStock}</td>
                      <td className="py-2 px-2 text-center text-indigo-400 font-semibold">+{prod.reorderQuantity} un.</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-xl space-y-4">
          <h2 className="text-lg font-bold">Historial de Operaciones Auditables</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400">
                  <th className="py-3 px-4 font-semibold">Operación / Concepto</th>
                  <th className="py-3 px-4 font-semibold">Hora</th>
                  <th className="py-3 px-4 font-semibold">Wallet Destino / Origen</th>
                  <th className="py-3 px-4 font-semibold">Monto MON</th>
                  <th className="py-3 px-4 font-semibold text-center">Comprobante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3.5 px-4 font-medium text-white">{sale.item}</td>
                    <td className="py-3.5 px-4 text-slate-400 text-xs">{sale.time}</td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-xs">{sale.client}</td>
                    <td className={`py-3.5 px-4 font-bold ${sale.amount.startsWith('+') ? 'text-emerald-400' : 'text-indigo-400'}`}>
                      {sale.amount}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button onClick={() => setSelectedInvoice(sale)} className="px-3 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg text-xs font-medium transition">
                        Ver Voucher
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-6 shadow-2xl relative">
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs px-2.5 py-1 bg-indigo-500/20 text-indigo-400 rounded-full font-mono font-semibold">COMPROBANTE AUTOMATIZADO WEB3</span>
                <h3 className="text-xl font-extrabold text-white mt-2">MonadERP Treasury</h3>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="text-slate-400 hover:text-white text-lg font-bold px-2 py-1 bg-slate-800/50 rounded-lg">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Detalle Operación:</span>
                <span className="font-semibold text-white">{selectedInvoice.item}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Hora:</span>
                <span className="text-white">{selectedInvoice.time}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Wallet Ref:</span>
                <span className="font-mono text-xs text-indigo-300">{selectedInvoice.client}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Tx Hash:</span>
                <span className="font-mono text-xs text-slate-400">{selectedInvoice.hash}</span>
              </div>
              <div className="flex justify-between py-2 text-base font-bold bg-slate-950 p-3 rounded-xl border border-slate-800 mt-2">
                <span className="text-slate-300">Monto:</span>
                <span className="text-indigo-400">{selectedInvoice.amount}</span>
              </div>
            </div>
            <button onClick={() => setSelectedInvoice(null)} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
