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
  Search, 
  Filter, 
  Plus,
  Edit,
  Trash2,
  Calendar,
  DollarSign,
  User,
  X
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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
// Use native HTML select for Sales dialog to avoid Radix overlay issues

export default function SalesPage() {
  const [sales, setSales] = useState([] as any[]);
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ customer: '', invoice_number: '', date: new Date().toISOString().split('T')[0], notes: '' });
  const [lineItems, setLineItems] = useState([{ product_id: 0, quantity: 0, unit_price: 0, total_price: 0 }]);
  const [isLoading, setIsLoading] = useState(false);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    fetchSales();
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/products/`);
      if (!resp.ok) throw new Error('Failed to fetch products');
      const data = await resp.json();
      setProducts(data);
    } catch (err) {
      logger.error('Failed to load products', err);
      toast({ title: 'Error', description: 'Failed to load products' });
    }
  };

  const fetchSales = async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/sales/`);
      if (!resp.ok) throw new Error('Failed to fetch sales');
      const data = await resp.json();
      setSales(data);
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

    setIsLoading(true);
    try {
      const payload = {
        customer_name: formData.customer,
        sale_date: formData.date,
        notes: formData.notes,
        items: lineItems.map(it => ({ product_id: it.product_id, quantity: it.quantity, unit_price: it.unit_price }))
      };

      const resp = await fetch(`${API_BASE_URL}/sales/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) throw new Error('Failed to create sale');
      toast({ title: 'Success', description: 'Sale record created successfully' });
      setFormData({ customer: '', invoice_number: '', date: new Date().toISOString().split('T')[0], notes: '' });
      setLineItems([{ product_id: 0, quantity: 0, unit_price: 0, total_price: 0 }]);
      setIsDialogOpen(false);
      await fetchSales();
    } catch (err) {
      logger.error('Failed to add sale', err);
      toast({ title: 'Error', description: 'Failed to create sale' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddLineItem = () => setLineItems([...lineItems, { product_id: 0, quantity: 0, unit_price: 0, total_price: 0 }]);

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleProductChange = (index: number, productId: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const newItems = [...lineItems];
    newItems[index] = { ...newItems[index], product_id: productId, unit_price: product.default_price || product.price_per_unit, total_price: newItems[index].quantity * (product.default_price || product.price_per_unit) };
    setLineItems(newItems);
  };

  const handleQuantityChange = (index: number, quantity: string) => {
    const qty = parseFloat(quantity) || 0;
    const newItems = [...lineItems];
    newItems[index] = { ...newItems[index], quantity: qty, total_price: qty * newItems[index].unit_price };
    setLineItems(newItems);
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

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Completed': return 'default';
      case 'Pending': return 'secondary';
      default: return 'secondary';
    }
  };

  const handleDeleteSale = async (saleId: number) => {
    if (!confirm('Are you sure you want to delete this sale?')) return;
    setIsLoading(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/sales/${saleId}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error('Failed to delete sale');
      toast({ title: 'Success', description: 'Sale deleted' });
      await fetchSales();
    } catch (err) {
      logger.error('Failed to delete sale', err);
      toast({ title: 'Error', description: 'Failed to delete sale' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isAdmin={true} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Sales" />
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
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Sale
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Sale Record</DialogTitle>
                    <DialogDescription>Add a new sales transaction</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pr-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium block mb-2">Customer Name</label>
                        <Input 
                          value={formData.customer}
                          onChange={(e) => setFormData({...formData, customer: e.target.value})}
                          placeholder="Enter customer name"
                          className="w-full"
                        />
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
                        <label className="text-sm font-medium block mb-2">Date</label>
                        <Input 
                          type="date"
                          value={formData.date}
                          onChange={(e) => setFormData({...formData, date: e.target.value})}
                          className="w-full"
                        />
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
                                        onChange={(e) => handleProductChange(index, parseInt(e.target.value))}
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
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={item.quantity || ''}
                                        onChange={(e) => handleQuantityChange(index, e.target.value)}
                                        placeholder="0"
                                        className="w-full min-w-[100px]"
                                      />
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
                      <Button variant="outline" type="button">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleAddSale} disabled={isLoading}>
                      {isLoading ? 'Creating...' : 'Create Sale'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

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
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Invoice No</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Customer</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Amount</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Quantity</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSales.map((sale) => (
                        <tr key={sale.id} className="border-t hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium">{sale.invoice_number}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{sale.customer_name}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 flex items-center gap-2">
                            <Calendar className="h-4 w-4" /> {sale.sale_date}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium flex items-center gap-1">
                            <DollarSign className="h-4 w-4" /> {sale.total_amount}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{(sale.items || []).reduce((a: number, it: any) => a + (it.quantity || 0), 0)}</td>
                          <td className="px-6 py-4 text-sm">
                            <Badge variant={getStatusColor((sale.items && sale.items.length) ? 'Completed' : 'Pending')}>
                              {(sale.items && sale.items.length) ? 'Completed' : 'Pending'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-sm space-x-2">
                            <Button variant="ghost" size="sm"><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteSale(sale.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
