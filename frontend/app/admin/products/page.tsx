'use client';

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
  BarChart3
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
  quantity: number;
  unit: string;
  pricePerUnit: number;
  totalValue: number;
  row?: number;
}

const UNIT_OPTIONS = ['Kg', 'g', 'pc', 'box'];
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', quantity: '', unit: 'Kg', pricePerUnit: '' });
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Load products on mount
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/products/`);
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

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddProduct = async () => {
    if (!formData.name || !formData.quantity || !formData.pricePerUnit || !formData.unit) {
      toast({ title: 'Error', description: 'Please fill in all required fields' });
      return;
    }

    try {
      const isEditing = editingId !== null;
      const method = isEditing ? 'PUT' : 'POST';
      const url = isEditing
        ? `${API_BASE_URL}/products/${editingId}`
        : `${API_BASE_URL}/products/`;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          quantity: parseInt(formData.quantity),
          unit: formData.unit,
          pricePerUnit: parseFloat(formData.pricePerUnit)
        })
      });

      if (!response.ok) throw new Error('Failed to save product');

      toast({ 
        title: 'Success', 
        description: isEditing ? 'Product updated successfully' : 'Product added successfully'
      });
      
      setFormData({ name: '', quantity: '', unit: 'Kg', pricePerUnit: '' });
      setEditingId(null);
      setIsDialogOpen(false);
      await fetchProducts();
    } catch (error) {
      logger.error('Failed to save product:', error);
      toast({ title: 'Error', description: 'Failed to save product' });
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingId(product.id);
    setFormData({
      name: product.name,
      quantity: product.quantity.toString(),
      unit: product.unit,
      pricePerUnit: product.pricePerUnit.toString()
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
      const response = await fetch(`${API_BASE_URL}/products/${productToDelete.id}`, {
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
    setFormData({ name: '', quantity: '', unit: 'Kg', pricePerUnit: '' });
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isAdmin={true} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Products" />
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
                  setFormData({ name: '', quantity: '', unit: 'Kg', pricePerUnit: '' });
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
                        <Label htmlFor="quantity" className="text-right">Quantity</Label>
                        <Input 
                          id="quantity"
                          type="number"
                          value={formData.quantity}
                          onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                          placeholder="Enter quantity"
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="unit" className="text-right">Unit</Label>
                        <Select value={formData.unit} onValueChange={(value) => setFormData({...formData, unit: value})}>
                          <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                          <SelectContent>
                            {UNIT_OPTIONS.map((unit) => (
                              <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="price" className="text-right">Price/Unit</Label>
                        <Input 
                          id="price"
                          type="number"
                          step="0.01"
                          value={formData.pricePerUnit}
                          onChange={(e) => setFormData({...formData, pricePerUnit: e.target.value})}
                          placeholder="Enter price per unit"
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
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Quantity</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Unit</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Price per Unit</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((product) => (
                        <tr key={product.id} className="border-t hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium">{product.name}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{product.quantity}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{product.unit}</td>
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium">${product.pricePerUnit.toFixed(2)}</td>
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
                      ))}
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
