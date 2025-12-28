'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  DollarSign,
  Search, 
  Filter, 
  Plus,
  Edit,
  Trash2,
  FileText,
  Download,
  Printer,
  MoreHorizontal,
  Calendar,
  User,
  X
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Label } from '@/components/ui/label';

const logger = {
  error: (msg: string, err?: any) => console.error(msg, err),
  info: (msg: string) => console.log(msg)
};
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
// Use native HTML select for Sales dialog to avoid Radix overlay issues

// Utility function to parse quantity_with_unit
const parseQuantityWithUnit = (qty_unit: string): { quantity: number; unit: string } => {
  if (!qty_unit) return { quantity: 0, unit: '' };
  const match = qty_unit.match(/^(\d+\.?\d*)\s*([a-zA-Z]+)$/);
  if (!match) return { quantity: 0, unit: '' };
  return { quantity: parseFloat(match[1]), unit: match[2].toLowerCase() };
};

export default function SalesPage() {
  const [sales, setSales] = useState([] as any[]);
  const [products, setProducts] = useState<any[]>([]);
  const [stock, setStock] = useState<Record<number, number>>({}); // product_id -> available_stock
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ customer: '', invoice_number: '', date: new Date().toISOString().split('T')[0], notes: '' });
  const [lineItems, setLineItems] = useState([{ product_id: 0, quantity: 0, unit_price: 0, total_price: 0 }]);
  const [stockErrors, setStockErrors] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<any>(null);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [serverCustomerSuggestions, setServerCustomerSuggestions] = useState<string[]>([]);
  const [editingSaleId, setEditingSaleId] = useState<number | null>(null);

  // View sale/invoice dialog state
  const [isViewSaleOpen, setIsViewSaleOpen] = useState(false);
  const [viewSale, setViewSale] = useState<any | null>(null);

  // Customer suggestions derived from existing sales (fallback to client sales)
  const localCustomerSuggestions = Array.from(new Set(sales.map(s => s.customer_name))).filter(c => c && c.toLowerCase().includes(formData.customer.toLowerCase()) && c.toLowerCase() !== formData.customer.toLowerCase()).slice(0, 6);
  const customerSuggestions = serverCustomerSuggestions.length ? serverCustomerSuggestions : localCustomerSuggestions;

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  const user = {
    name: 'Admin User',
    email: 'admin@kokilaenterprises.com'
  };

  useEffect(() => {
    fetchSales();
    fetchProducts();
    fetchStock();
  }, []);

  // Refresh products and stock when dialog opens to get latest stock
  useEffect(() => {
    if (isDialogOpen) {
      fetchProducts();
      fetchStock();
      setStockErrors({});
    }
  }, [isDialogOpen]);

  const fetchProducts = async () => {
    try {
      const resp = await fetch('/api/products/');
      if (!resp.ok) throw new Error('Failed to fetch products');
      const data = await resp.json();
      setProducts(data);
    } catch (err) {
      logger.error('Failed to load products', err);
      toast({ title: 'Error', description: 'Failed to load products' });
    }
  };

  const fetchCustomerSuggestions = async (q: string) => {
    try {
      const resp = await fetch(`/api/customers?query=${encodeURIComponent(q)}`);
      if (!resp.ok) return;
      const data = await resp.json();
      setServerCustomerSuggestions((data || []).map((d: any) => d.name));
    } catch (err) {
      // ignore suggestions errors
    }
  };

  const fetchStock = async () => {
    try {
      const resp = await fetch('/api/stock/');
      if (!resp.ok) throw new Error('Failed to fetch stock');
      const data = await resp.json();
      // Convert array to object: product_id -> available_stock
      const stockMap: Record<number, number> = {};
      data.forEach((item: any) => {
        stockMap[item.product_id] = item.available_stock || 0;
      });
      setStock(stockMap);
    } catch (err) {
      logger.error('Failed to load stock', err);
      // Don't show toast for stock errors, just log
    }
  };

  const fetchSales = async () => {
    try {
      const resp = await fetch('/api/sales/');
      if (!resp.ok) throw new Error('Failed to fetch sales');
      const data = await resp.json();
      // Normalize items property for convenience in UI
      const norm = (data || []).map((s: any) => ({ ...s, items: s.items ?? s.sale_items ?? [] }));
      setSales(norm);
    } catch (err) {
      logger.error('Failed to load sales', err);
      toast({ title: 'Error', description: 'Failed to load sales' });
    }
  };

  const filteredSales = sales.filter(sale =>
    sale.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (sale.invoice_number || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddSale = async () => {
    if (!formData.customer || !formData.invoice_number) {
      toast({ title: 'Error', description: 'Please fill in all required fields' });
      return;
    }
    if (lineItems.some(it => !it.product_id || it.quantity <= 0)) {
      toast({ title: 'Error', description: 'Please select products and quantities' });
      return;
    }

    // Check for stock errors before submitting
    if (Object.keys(stockErrors).length > 0) {
      toast({ 
        title: 'Insufficient Stock', 
        description: 'Please fix stock issues before creating/updating the sale',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        customer_name: formData.customer,
        invoice_number: formData.invoice_number,
        sale_date: formData.date,
        notes: formData.notes,
        items: lineItems.map(it => ({ product_id: it.product_id, quantity: it.quantity, unit_price: it.unit_price }))
      };

      const isEditing = editingSaleId !== null;
      const url = isEditing ? `/api/sales/${editingSaleId}` : `/api/sales/`;
      const method = isEditing ? 'PUT' : 'POST';

      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({ detail: isEditing ? 'Failed to update sale' : 'Failed to create sale' }));
        const errorMessage = errorData.detail || errorData.message || (isEditing ? 'Failed to update sale' : 'Failed to create sale');
        
        if (resp.status === 503 || errorMessage.toLowerCase().includes('network') || 
            errorMessage.toLowerCase().includes('connection') || 
            errorMessage.toLowerCase().includes('unavailable')) {
          throw new Error('Network connection issue. Please check your internet connection and try again.');
        }
        
        throw new Error(errorMessage);
      }

      toast({ title: 'Success', description: isEditing ? 'Sale record updated successfully' : 'Sale record created successfully' });
      // Reset dialog and state
      setFormData({ customer: '', invoice_number: '', date: new Date().toISOString().split('T')[0], notes: '' });
      setLineItems([{ product_id: 0, quantity: 0, unit_price: 0, total_price: 0 }]);
      setStockErrors({});
      setEditingSaleId(null);
      setIsDialogOpen(false);
      await fetchSales();
      // Notify other pages (products) that stock changed
      try { window.dispatchEvent(new Event('stock-updated')); } catch (e) { /* ignore */ }
    } catch (err: any) {
      logger.error('Failed to add/update sale', err);
      let errorMessage = err.message || 'Failed to save sale';

      if (errorMessage.toLowerCase().includes('network') || 
          errorMessage.toLowerCase().includes('connection') ||
          errorMessage.toLowerCase().includes('unavailable') ||
          errorMessage.toLowerCase().includes('fetch')) {
        errorMessage = 'Network connection issue. Please check your internet connection and try again.';
      }

      toast({ 
        title: 'Error', 
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddLineItem = () => {
    const newIndex = lineItems.length;
    setLineItems([...lineItems, { product_id: 0, quantity: 0, unit_price: 0, total_price: 0 }]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
    // Clear error for removed item and reindex remaining errors
    setStockErrors(prev => {
      const newErrors: Record<number, string> = {};
      Object.keys(prev).forEach(key => {
        const keyNum = parseInt(key);
        if (keyNum < index) {
          newErrors[keyNum] = prev[keyNum];
        } else if (keyNum > index) {
          newErrors[keyNum - 1] = prev[keyNum];
        }
      });
      return newErrors;
    });
  };

  const handleProductChange = (index: number, productId: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const newItems = [...lineItems];
    const unitPrice = product.default_price || product.price_per_unit || 0;
    const quantity = newItems[index].quantity || 0;
    
    newItems[index] = {
      ...newItems[index],
      product_id: productId,
      unit_price: unitPrice,
      total_price: quantity * unitPrice
    };
    setLineItems(newItems);

    // Validate stock when product changes
    if (quantity > 0) {
      validateStock(index, productId, quantity);
    } else {
      // Clear error when product changes and quantity is 0
      setStockErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[index];
        return newErrors;
      });
    }
  };

  const validateStock = (index: number, productId: number, quantity: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) {
      setStockErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[index];
        return newErrors;
      });
      return;
    }

    // Get available stock from stock tracking sheet (numeric value, no unit)
    const availableStock = stock[productId] || 0;
    
    // Ensure both values are numbers for comparison
    const enteredQty = Number(quantity) || 0;
    const stockQty = Number(availableStock) || 0;
    
    // Compare only numeric quantities (not units)
    if (enteredQty > stockQty) {
      const needQty = enteredQty - stockQty; // Calculate the difference
      setStockErrors(prev => ({
        ...prev,
        [index]: `Used: ${enteredQty}\nInsufficient stock: Available ${stockQty}, Need ${needQty}`
      }));
    } else {
      setStockErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[index];
        return newErrors;
      });
    }
  };

  const handleQuantityChange = (index: number, quantity: string) => {
    const qty = parseFloat(quantity) || 0;
    const newItems = [...lineItems];
    newItems[index] = { ...newItems[index], quantity: qty, total_price: qty * newItems[index].unit_price };
    setLineItems(newItems);

    // Validate stock when quantity changes
    if (newItems[index].product_id) {
      validateStock(index, newItems[index].product_id, qty);
    }
  };

  const handleUnitPriceChange = (index: number, price: string) => {
    const p = parseFloat(price) || 0;
    const newItems = [...lineItems];
    newItems[index] = { ...newItems[index], unit_price: p, total_price: p * newItems[index].quantity };
    setLineItems(newItems);
  };

  const calculateTotal = () => lineItems.reduce((s, it) => s + it.total_price, 0);

  const totalSales = sales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
  const totalQuantity = sales.reduce((sum, sale) => sum + ((sale.items || []).reduce((a: number, it: any) => a + (it.quantity || 0), 0) || 0), 0);


  const handleDeleteSale = (sale: any) => {
    setSaleToDelete(sale);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteSale = async () => {
    if (!saleToDelete) return;
    setIsLoading(true);
    try {
      const resp = await fetch(`/api/sales/${saleToDelete.id}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error('Failed to delete sale');
      toast({ title: 'Success', description: 'Sale deleted successfully' });
      setIsDeleteDialogOpen(false);
      setSaleToDelete(null);
      await fetchSales();
      try { window.dispatchEvent(new Event('stock-updated')); } catch (e) { /* ignore */ }
    } catch (err) {
      logger.error('Failed to delete sale', err);
      toast({ title: 'Error', description: 'Failed to delete sale' });
    } finally {
      setIsLoading(false);
    }
  };

  // View sale/invoice
  const handleViewSale = (sale: any) => {
    setViewSale(sale);
    setIsViewSaleOpen(true);
  };



  const downloadSaleCSV = (sale: any) => {
    const headers = ['product_id','product_name','quantity','unit_price','total_price'];
    const rows = (sale.items || []).map((it: any) => [it.product_id, it.product_name, it.quantity, it.unit_price, it.total_price]);
    const csv = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sale_${sale.invoice_number || sale.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printSaleInvoice = (sale: any) => {
    const title = 'Sales Invoice';
    const dateText = `<p style="margin:4px 0;">${sale.sale_date}</p>`;
    const header = `<div style="text-align:center;margin-bottom:12px"><h1 style="margin:0">Kokila Enterprise</h1><h2 style="margin:4px 0 0 0">${title}</h2>${dateText}</div>`;
    const itemsTable = `<table style="width:100%;border-collapse:collapse"><thead><tr><th style="border:1px solid #ddd;padding:6px;text-align:left">Product</th><th style="border:1px solid #ddd;padding:6px;text-align:center">Qty</th><th style="border:1px solid #ddd;padding:6px;text-align:center">Unit Price</th><th style="border:1px solid #ddd;padding:6px;text-align:center">Total</th></tr></thead><tbody>${(sale.items || []).map((it: any) => `<tr><td style="border:1px solid #ddd;padding:6px">${it.product_name}</td><td style="border:1px solid #ddd;padding:6px;text-align:center">${it.quantity}</td><td style="border:1px solid #ddd;padding:6px;text-align:center">₹${it.unit_price}</td><td style="border:1px solid #ddd;padding:6px;text-align:center">₹${it.total_price}</td></tr>`).join('')}</tbody></table>`;
    const total = `<div style="margin-top:12px;text-align:right;font-weight:bold">Total: ₹${Number(sale.total_amount || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</div>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:Inter, Arial, sans-serif;color:#111">${header}<div style="margin:12px 0"><strong>Customer:</strong> ${sale.customer_name} <br/><strong>Invoice:</strong> ${sale.invoice_number} <br/>${sale.notes ? `<strong>Notes:</strong> ${sale.notes}` : ''}</div>${itemsTable}${total}</body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
    }
  };

  const closeSaleDialog = () => {
    setIsDialogOpen(false);
    setEditingSaleId(null);
    setFormData({ customer: '', invoice_number: '', date: new Date().toISOString().split('T')[0], notes: '' });
    setLineItems([{ product_id: 0, quantity: 0, unit_price: 0, total_price: 0 }]);
    setStockErrors({});
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isAdmin={true} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Sales" user={user} onRefresh={async () => { await Promise.all([fetchSales(), fetchProducts(), fetchStock()]); }} />
        <div className="flex-1 overflow-auto">
          <div className="p-8 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Sales</h1>
                <p className="text-gray-600 mt-1">Track and manage sales transactions</p>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2" onClick={() => { setEditingSaleId(null); setFormData({ customer: '', invoice_number: '', date: new Date().toISOString().split('T')[0], notes: '' }); setLineItems([{ product_id: 0, quantity: 0, unit_price: 0, total_price: 0 }]); setStockErrors({}); }}>
                    <Plus className="h-4 w-4" />
                    New Sale
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingSaleId ? 'Edit Sale Record' : 'Create Sale Record'}</DialogTitle>
                    <DialogDescription>{editingSaleId ? 'Update sales transaction' : 'Add a new sales transaction'}</DialogDescription>
                  </DialogHeader> 
                  <div className="space-y-4 pr-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="relative">
                        <label className="text-sm font-medium block mb-2">Customer Name</label>
                        <Input 
                          value={formData.customer}
                          onChange={(e) => { const v = e.target.value; setFormData({...formData, customer: v }); setShowCustomerSuggestions(true); if (v && v.length >= 2) fetchCustomerSuggestions(v); else setServerCustomerSuggestions([]); }}
                          onFocus={() => { setShowCustomerSuggestions(true); if (formData.customer && formData.customer.length >= 2) fetchCustomerSuggestions(formData.customer); }}
                          onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 150)}
                          list="customers"
                          placeholder="Select or enter customer name"
                          className="w-full"
                        />

                        {/* Datalist for existing customers - allows selecting or typing a new customer */}
                        <datalist id="customers">
                          {Array.from(new Set(sales.map(s => s.customer_name))).map((c) => (
                            <option key={c} value={c} />
                          ))}
                        </datalist>

                        {/* Suggestion dropdown shown while typing */}
                        {showCustomerSuggestions && customerSuggestions.length > 0 && (
                          <div className="absolute left-0 right-0 mt-1 bg-white border rounded shadow z-20 max-h-40 overflow-y-auto">
                            {customerSuggestions.map((c: any) => (
                              <div
                                key={c}
                                className="px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer"
                                onMouseDown={() => { setFormData({ ...formData, customer: c }); setServerCustomerSuggestions([]); setShowCustomerSuggestions(false); }}
                              >
                                {c}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium block mb-2">Invoice Number</label>
                        <Input 
                          value={formData.invoice_number}
                          onChange={(e) => setFormData({...formData, invoice_number: e.target.value})}
                          placeholder="Enter invoice number"
                          className="w-full"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium block mb-2">Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                              <Calendar className="mr-2 h-4 w-4" />
                              {formData.date ? format(new Date(formData.date + 'T00:00:00'), 'yyyy-MM-dd') : 'Select date'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={formData.date ? new Date(formData.date + 'T00:00:00') : undefined}
                              onSelect={(date) => {
                                if (date) {
                                  const dateStr = format(date, 'yyyy-MM-dd');
                                  setFormData(prev => ({ ...prev, date: dateStr }));
                                }
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Line Items</h3>
                        <Button type="button" variant="outline" size="sm" onClick={handleAddLineItem} className="gap-2">
                          <Plus className="h-4 w-4" />
                          Add Item
                        </Button>
                      </div>

                      <div className="overflow-x-auto border rounded-lg bg-white shadow-sm">
                        <div className="max-h-[40vh] overflow-y-auto">
                          <table className="w-full min-w-[800px]">
                            <thead className="bg-gray-50 border-b sticky top-0 z-10">
                              <tr>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[200px]">Product</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[100px]">Unit</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[120px]">Quantity</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[140px]">Unit Price</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[120px]">Total</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 min-w-[80px]">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lineItems.map((item, index) => {
                                const selectedProduct = products.find(p => p.id === item.product_id);
                                return (
                                  <tr key={index} className="border-b hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                      <select
                                        className="w-full min-w-[180px] h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={item.product_id ? String(item.product_id) : ''}
                                        onChange={(e) => {
                                          const productId = parseInt(e.target.value);
                                          if (productId && !isNaN(productId)) {
                                            handleProductChange(index, productId);
                                          }
                                        }}
                                      >
                                        <option value="">Select product</option>
                                        {products.length === 0 && <option value="" disabled>No products available</option>}
                                        {products.map(prod => (
                                          <option value={String(prod.id)} key={prod.id}>{prod.name}</option>
                                        ))}
                                      </select>

                                      {selectedProduct && (
                                        <div className="text-xs text-gray-500 mt-1">ID: {`P0_${selectedProduct.id}`}</div>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{selectedProduct?.quantity_with_unit || '-'}</td>
                                    <td className="px-4 py-3">
                                      <div className="space-y-1">
                                        <Input
                                          type="number"
                                          step="0.01"
                                          value={item.quantity || ''}
                                          onChange={(e) => handleQuantityChange(index, e.target.value)}
                                          placeholder="0"
                                          className={`w-full min-w-[100px] ${stockErrors[index] ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                                        />
                                        {stockErrors[index] && (
                                          <div className="text-xs text-red-600 font-medium whitespace-pre-line">
                                            {stockErrors[index]}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={item.unit_price || ''}
                                        onChange={(e) => handleUnitPriceChange(index, e.target.value)}
                                        placeholder="0.00"
                                        className="w-full min-w-[120px]"
                                      />
                                    </td>
                                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">₹{item.total_price.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-center">
                                      <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveLineItem(index)} className="text-red-500 hover:text-red-700">
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Total Amount */}
                      <div className="mt-4 flex justify-end">
                        <div className="w-48 bg-gray-50 p-4 rounded-lg border">
                          <div className="flex justify-between mb-2">
                            <span className="text-gray-600">Subtotal:</span>
                            <span className="font-semibold">₹{calculateTotal().toFixed(2)}</span>
                          </div>
                          <div className="border-t pt-2 flex justify-between text-lg font-bold">
                            <span>Total:</span>
                            <span className="text-blue-600">₹{calculateTotal().toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0 mt-4">
                    <DialogClose asChild>
                      <Button variant="outline" type="button" onClick={closeSaleDialog}>Cancel</Button>
                    </DialogClose> 
                    <Button onClick={handleAddSale} disabled={isLoading}>
                      {isLoading ? (editingSaleId ? 'Updating...' : 'Creating...') : (editingSaleId ? 'Update Sale' : 'Create Sale')}
                    </Button> 
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {/* View Sale / Invoice Dialog */}
            <Dialog open={isViewSaleOpen} onOpenChange={setIsViewSaleOpen}>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Invoice Preview
                  </DialogTitle>
                  <DialogDescription>View, print, or download this sales invoice.</DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                  <div className="text-center">
                    <h1 className="text-xl font-bold">Kokila Enterprise</h1>
                    <div className="text-sm text-gray-600 mt-1">{viewSale?.sale_date}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Customer</div>
                      <div className="font-semibold">{viewSale?.customer_name}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Invoice</div>
                      <div className="font-semibold">{viewSale?.invoice_number}</div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full mt-2 table-fixed">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-semibold">Product</th>
                          <th className="px-4 py-2 text-center text-sm font-semibold">Qty</th>
                          <th className="px-4 py-2 text-center text-sm font-semibold">Unit Price</th>
                          <th className="px-4 py-2 text-center text-sm font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(viewSale?.items || []).map((it: any, idx: number) => (
                          <tr key={idx} className="border-t">
                            <td className="px-4 py-2 text-sm">{it.product_name}</td>
                            <td className="px-4 py-2 text-sm text-center">{it.quantity}</td>
                            <td className="px-4 py-2 text-sm text-center">₹{it.unit_price}</td>
                            <td className="px-4 py-2 text-sm text-center">₹{it.total_price}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end">
                    <div className="w-48 bg-gray-50 p-3 rounded-lg border">
                      <div className="flex justify-between font-semibold">Total:</div>
                      <div className="text-right text-lg font-bold">₹{Number(viewSale?.total_amount || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between mt-4">
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { if (viewSale) downloadSaleCSV(viewSale); }}><Download className="mr-2" />Download</Button>
                    <Button onClick={() => { if (viewSale) printSaleInvoice(viewSale); }}><Printer className="mr-2" />Print</Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setIsViewSaleOpen(false); setViewSale(null); }}>Close</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-500" />
                    <span className="text-2xl font-bold">${totalSales.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                    <span className="text-2xl font-bold">{totalQuantity}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-purple-500" />
                    <span className="text-2xl font-bold">{sales.length}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Search and Filter */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input 
                      placeholder="Search sales..." 
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Filter
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Sales Table */}
            <Card>
              <CardHeader>
                <CardTitle>Sales Transactions</CardTitle>
                <CardDescription>Total Records: {filteredSales.length}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] table-fixed">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 min-w-[160px]">Invoice No</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 min-w-[180px]">Customer</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 min-w-[140px]">Date</th>
                        <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 min-w-[160px]">Amount</th>
                        <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700 min-w-[120px]">Quantity</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 min-w-[120px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSales.map((sale) => (
                        <tr key={sale.id} className="border-t hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium whitespace-nowrap">{sale.invoice_number}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{sale.customer_name}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 flex items-center gap-2 whitespace-nowrap">
                            <Calendar className="h-4 w-4" /> <span className="ml-1">{sale.sale_date}</span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium text-right whitespace-nowrap">
                            <span>₹{Number(sale.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 text-center whitespace-nowrap">{(sale.items || []).reduce((a: number, it: any) => a + (it.quantity || 0), 0)}</td>
                          <td className="px-6 py-4 text-sm">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-700 hover:bg-gray-100">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem onSelect={() => handleViewSale(sale)}><FileText className="mr-2 h-4 w-4" /> View</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => { if (sale) downloadSaleCSV(sale); }}><Download className="mr-2 h-4 w-4" /> Download</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => { if (sale) printSaleInvoice(sale); }}><Printer className="mr-2 h-4 w-4" /> Print</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => handleDeleteSale(sale)} className="text-red-600"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Sale</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete the sale for <span className="font-bold text-gray-900">{saleToDelete?.customer_name}</span> (Invoice: {saleToDelete?.invoice_number}) dated {saleToDelete?.sale_date}? This action cannot be undone and will restore stock to inventory.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => { setIsDeleteDialogOpen(false); setSaleToDelete(null); }}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={confirmDeleteSale} 
                    disabled={isLoading}
                    className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                        Deleting...
                      </>
                    ) : (
                      'Delete'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </div>
  );
}
