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
  User
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function SalesPage() {
  const [sales, setSales] = useState([] as any[]);
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ customer: '', invoiceNo: '', date: new Date().toISOString().split('T')[0], notes: '' });
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
    sale.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddSale = async () => {
    if (!formData.customer || !formData.invoiceNo) {
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
      setFormData({ customer: '', invoiceNo: '', date: new Date().toISOString().split('T')[0], notes: '' });
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
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Sale Record</DialogTitle>
                    <DialogDescription>Add a new sales transaction</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Customer Name</label>
                      <Input 
                        value={formData.customer}
                        onChange={(e) => setFormData({...formData, customer: e.target.value})}
                        placeholder="Enter customer name"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Invoice Number</label>
                      <Input 
                        value={formData.invoiceNo}
                        onChange={(e) => setFormData({...formData, invoiceNo: e.target.value})}
                        placeholder="Enter invoice number"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Date</label>
                      <Input 
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Line Items</label>
                      <div className="space-y-3 mt-2">
                        {lineItems.map((it, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-4">
                              <Select onValueChange={(val) => handleProductChange(idx, parseInt(val))}>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select Product" />
                                </SelectTrigger>
                                <SelectContent>
                                  {products.map(p => (
                                    <SelectItem value={String(p.id)} key={p.id}>{p.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-3">
                              <Input type="number" placeholder="Quantity" value={String(it.quantity)} onChange={(e) => handleQuantityChange(idx, e.target.value)} />
                            </div>
                            <div className="col-span-3">
                              <Input type="number" placeholder="Unit Price" value={String(it.unit_price)} onChange={(e) => handleUnitPriceChange(idx, e.target.value)} />
                            </div>
                            <div className="col-span-1 text-right">{it.total_price.toFixed(2)}</div>
                            <div className="col-span-1">
                              <Button variant="ghost" onClick={() => handleRemoveLineItem(idx)}>Remove</Button>
                            </div>
                          </div>
                        ))}
                        <div>
                          <Button onClick={handleAddLineItem} size="sm" variant="outline">Add Item</Button>
                        </div>
                        <div className="text-right font-semibold">Total: ${calculateTotal().toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleAddSale}>Create Sale</Button>
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
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium">{`SAL_${sale.id}`}</td>
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
