"use client";

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  Search, 
  Filter, 
  Plus,
  Edit,
  Trash2,
  BarChart3,
  AlertTriangle,
  X
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const logger = {
  error: (msg: string, err?: any) => console.error(msg, err),
  info: (msg: string) => console.log(msg)
};

interface Product {
  id: number;
  name: string;
  quantity_with_unit: string;
  price_per_unit: number;
  reorder_point?: number | null;
  totalValue?: number;
  row?: number;
}

interface LowStockAlert {
  product_id: number;
  product_name: string;
  available_stock: number;
  reorder_point: number;
  shortage: number;
}
const UNIT_OPTIONS = ['kg', 'g', 'pack', 'pc', 'liter'];
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Utility function to parse quantity_with_unit
const parseQuantityWithUnit = (qty_unit: string): { quantity: number; unit: string } => {
  const match = qty_unit.match(/^(\d+\.?\d*)\s*([a-zA-Z]+)$/);
  if (!match) return { quantity: 0, unit: 'kg' };
  return { quantity: parseFloat(match[1]), unit: match[2].toLowerCase() };
};

  const user = {
    name: 'Admin User',
    email: 'admin@kokilaenterprises.com',
  };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', quantity: '', unit: 'kg', price_per_unit: '', reorder_point: '' });
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [showAlerts, setShowAlerts] = useState(false); // Hidden by default
  const [stockMap, setStockMap] = useState<Record<number, number>>({});

  // Load products on mount
  useEffect(() => {
    fetchProducts();
    fetchLowStockAlerts();
    fetchStock();
  }, []);

  // Refresh alerts when products are updated
  useEffect(() => {
    if (products.length > 0) {
      fetchLowStockAlerts();
      fetchStock();
    }
  }, [products]);

  // Listen for stock updates from other pages (e.g., after creating purchase)
  useEffect(() => {
    const onStockUpdated = () => {
      fetchStock();
      fetchProducts();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('stock-updated', onStockUpdated);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('stock-updated', onStockUpdated);
      }
    };
  }, []);

  // Poll stock periodically as a fallback when writes happen outside this UI
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStock();
    }, 10000); // every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/products/');
      if (!response.ok) throw new Error('Failed to fetch products');
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      logger.error('Failed to load products:', error);
      toast({ title: 'Error', description: 'Failed to load products' });
    } finally {
      setLoading(false);
    }
  };

  const fetchStock = async () => {
    try {
      const response = await fetch('/api/stock/');
      if (!response.ok) throw new Error('Failed to fetch stock');
      const data = await response.json();
      const stock: Record<number, number> = {};
      data.forEach((item: any) => {
        stock[item.product_id] = item.available_stock || 0;
      });
      setStockMap(stock);
    } catch (error) {
      logger.error('Failed to load stock:', error);
    }
  };

  const fetchLowStockAlerts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/stock/alerts/low-stock`);
      if (!response.ok) throw new Error('Failed to fetch low stock alerts');
      const data = await response.json();
      setLowStockAlerts(data.alerts || []);
      // No toast notification - user can see alerts in the banner
    } catch (error) {
      logger.error('Failed to load low stock alerts:', error);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddProduct = async () => {
    if (!formData.name || formData.quantity === '' || formData.price_per_unit === '' || !formData.unit) {
      toast({ title: 'Error', description: 'Please fill in all required fields' });
      return;
    }

    try {
      const isEditing = editingId !== null;
      const method = isEditing ? 'PUT' : 'POST';
      const url = isEditing ? `/api/products/${editingId}` : `/api/products/`;

      // Combine quantity and unit
      const quantity_with_unit = `${formData.quantity}${formData.unit}`;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          quantity_with_unit: quantity_with_unit,
          price_per_unit: parseFloat(formData.price_per_unit),
          reorder_point: formData.reorder_point === '' ? null : parseInt(formData.reorder_point)
        })
      });

      if (!response.ok) throw new Error('Failed to save product');

      toast({ 
        title: 'Success', 
        description: isEditing ? 'Product updated successfully' : 'Product added successfully'
      });
      
      setFormData({ name: '', quantity: '', unit: 'kg', price_per_unit: '', reorder_point: '' });
      setEditingId(null);
      setIsDialogOpen(false);
      await fetchProducts();
    } catch (error) {
      logger.error('Failed to save product:', error);
      toast({ title: 'Error', description: 'Failed to save product' });
    }
  };

  const handleEditProduct = (product: Product) => {
    const parsed = parseQuantityWithUnit(product.quantity_with_unit);
    setEditingId(product.id);
    setFormData({
      name: product.name,
      quantity: parsed.quantity.toString(),
      unit: parsed.unit,
      price_per_unit: product.price_per_unit?.toString() ?? '0',
      reorder_point: product.reorder_point != null ? String(product.reorder_point) : ''
    });
    setIsDialogOpen(true);
  };

  const handleDeleteProduct = (productId: number) => {
    const product = products.find(p => p.id === productId) || null;
    setProductToDelete(product);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      const response = await fetch(`/api/products/${productToDelete.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete product');

      toast({ title: 'Success', description: 'Product deleted successfully' });
      setIsDeleteDialogOpen(false);
      setProductToDelete(null);
      await fetchProducts();
    } catch (error) {
      logger.error('Failed to delete product:', error);
      toast({ title: 'Error', description: 'Failed to delete product' });
    }
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    setFormData({ name: '', quantity: '', unit: 'kg', price_per_unit: '', reorder_point: '' });
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isAdmin={true} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Products" user={user} />
        <div className="flex-1 overflow-auto">
          <div className="p-8 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Products</h1>
                <p className="text-gray-600 mt-1">Manage your product inventory</p>
              </div>
              <div className="flex items-center gap-4">
                <Button className="gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700" onClick={() => {
                  setEditingId(null);
                  setFormData({ name: '', quantity: '', unit: 'kg', price_per_unit: '', reorder_point: '' });
                  setIsDialogOpen(true);
                }}>
                  <Plus className="h-4 w-4" />
                  Add Product
                </Button>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen} key={editingId}>
                  <DialogContent className="max-w-xl">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        {editingId !== null ? (
                          <><Edit className="h-5 w-5" /> Edit Product</>
                        ) : (
                          <><Plus className="h-5 w-5" /> Add Product</>
                        )}
                      </DialogTitle>
                      <DialogDescription>
                        {editingId !== null ? 'Modify the fields and save to update the product.' : 'Fill in the details below to add a new product.'}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-2">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Name</Label>
                        <Input 
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          placeholder="Enter product name"
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="quantity" className="text-right">Units</Label>
                        <div className="col-span-3 flex gap-2">
                          <Input 
                            id="quantity"
                            type="number"
                            step="0.01"
                            value={formData.quantity}
                            onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                            placeholder="e.g., 1, 500"
                            className="flex-1"
                          />
                          <Select value={formData.unit} onValueChange={(value) => setFormData({...formData, unit: value})}>
                            <SelectTrigger className="w-24">
                              <SelectValue placeholder="Unit" />
                            </SelectTrigger>
                            <SelectContent>
                              {UNIT_OPTIONS.map((unit) => (
                                <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="price" className="text-right">Price/Unit</Label>
                        <Input
                          id="price"
                          type="number"
                          step="0.01"
                          value={formData.price_per_unit}
                          onChange={(e) => setFormData({...formData, price_per_unit: e.target.value})}
                          placeholder="Enter price per unit"
                          className="col-span-3"
                        />
                      </div>

                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="reorder_point" className="text-right">Low Stock Alert</Label>
                        <Input 
                          id="reorder_point"
                          type="number"
                          value={formData.reorder_point}
                          onChange={(e) => setFormData({...formData, reorder_point: e.target.value})}
                          placeholder="Optional: alert when stock below"
                          className="col-span-3"
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={closeDialog}>Cancel</Button>
                      <Button onClick={handleAddProduct} className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                        {editingId !== null ? 'Save' : 'Submit'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Delete confirmation dialog */}
                <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete Product</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to delete <span className="font-bold text-gray-900">{productToDelete ? productToDelete.name : 'this product'}</span>? This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => { setIsDeleteDialogOpen(false); setProductToDelete(null); }}>Cancel</Button>
                      <Button onClick={confirmDeleteProduct} className="bg-red-600 hover:bg-red-700 text-white">Delete</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Low Stock Alerts Banner */}
            {showAlerts && lowStockAlerts.length > 0 && (
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-orange-900 mb-2">
                          Low Stock Alert ({lowStockAlerts.length} product{lowStockAlerts.length > 1 ? 's' : ''})
                        </h3>
                        <div className="space-y-2">
                          {lowStockAlerts.slice(0, 5).map((alert) => (
                            <div key={alert.product_id} className="flex items-center gap-2 text-sm text-orange-800">
                              <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                                {alert.product_name}
                              </Badge>
                              <span className="text-gray-600">
                                Stock: <span className="font-semibold text-orange-700">{alert.available_stock}</span> / 
                                Reorder Point: <span className="font-semibold">{alert.reorder_point}</span>
                                {alert.shortage > 0 && (
                                  <span className="ml-2 text-red-600">
                                    (Need {alert.shortage} more)
                                  </span>
                                )}
                              </span>
                            </div>
                          ))}
                          {lowStockAlerts.length > 5 && (
                            <p className="text-sm text-orange-700 mt-2">
                              + {lowStockAlerts.length - 5} more product(s) with low stock
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAlerts(false)}
                      className="text-orange-600 hover:text-orange-700 hover:bg-orange-100"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Search and Filter */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input 
                      placeholder="Search products..." 
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  {lowStockAlerts.length > 0 && (
                    <Button 
                      variant="outline" 
                      className="gap-2 text-orange-600 hover:bg-orange-50 border-orange-200"
                      onClick={() => setShowAlerts(!showAlerts)}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      {lowStockAlerts.length} Alert{lowStockAlerts.length > 1 ? 's' : ''}
                    </Button>
                  )}
                  <Button variant="outline" className="gap-2 text-gray-700 hover:bg-gray-100">
                    <Filter className="h-4 w-4" />
                    Filter
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Products Table */}
            <Card>
              <CardHeader>
                <CardTitle>Product List</CardTitle>
                <CardDescription>Total Products: {filteredProducts.length}</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-gray-500">Loading products...</div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No products found</div>
                ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Units</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Price/Unit</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Current Stock</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Low Stock Alert</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                          </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((product) => {
                        const currentStock = stockMap[product.id] ?? 0;
                        const isLowStock = product.reorder_point != null && currentStock < product.reorder_point;
                        const alert = lowStockAlerts.find(a => a.product_id === product.id);
                        
                        return (
                          <tr 
                            key={product.id} 
                            className={`border-t hover:bg-gray-50 ${isLowStock ? 'bg-orange-50' : ''}`}
                          >
                            <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                              <div className="flex items-center gap-2">
                                {product.name}
                                {isLowStock && (
                                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 font-semibold text-blue-600">{product.quantity_with_unit}</td>
                            <td className="px-6 py-4 text-sm text-gray-900">₹{product.price_per_unit.toFixed(2)}</td>
                            <td className="px-6 py-4 text-sm">
                              <span className={`font-semibold ${isLowStock ? 'text-orange-700' : 'text-gray-900'}`}>
                                {currentStock}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              {product.reorder_point != null ? (
                                <div className="flex flex-col gap-1">
                                  <span className={`font-semibold ${isLowStock ? 'text-orange-700' : 'text-gray-600'}`}>
                                    {product.reorder_point}
                                  </span>
                                  {isLowStock && alert && (
                                    <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 text-xs w-fit">
                                      Low Stock
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleEditProduct(product)}
                                className="text-gray-700 hover:bg-gray-50"
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleDeleteProduct(product.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
