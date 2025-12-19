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
  ShoppingCart, 
  Search, 
  Filter, 
  Plus,
  Edit,
  Trash2,
  Calendar,
  DollarSign,
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
  default_price?: number | null;
  reorder_point?: number | null;
}

interface PurchaseItem {
  product_id: number;
  product_name: string;
  quantity_with_unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Purchase {
  id: number;
  vendor_name: string;
  invoice_number: string;
  purchase_date: string;
  total_amount: number;
  notes: string | null;
  items: PurchaseItem[];
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function PurchasePage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState<Purchase | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    vendor_name: '',
    invoice_number: '',
    purchase_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [showVendorSuggestions, setShowVendorSuggestions] = useState(false);

  const [lineItems, setLineItems] = useState<Omit<PurchaseItem, 'product_name'>[]>([
    { product_id: 0, quantity_with_unit: '', quantity: 0, unit_price: 0, total_price: 0 }
  ]);

  // Vendor suggestions derived from existing purchases
  const vendorSuggestions = Array.from(new Set(purchases.map(p => p.vendor_name))).filter(v => v && v.toLowerCase().includes(formData.vendor_name.toLowerCase()) && v.toLowerCase() !== formData.vendor_name.toLowerCase()).slice(0,6);

  // Load data on mount
  useEffect(() => {
    fetchPurchases();
    fetchProducts();
  }, []);

  const fetchPurchases = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/purchases/`);
      if (!response.ok) throw new Error('Failed to fetch purchases');
      const data = await response.json();
      setPurchases(data);
    } catch (error) {
      logger.error('Failed to load purchases:', error);
      toast({ title: 'Error', description: 'Failed to load purchases' });
    }
  };

  const fetchProducts = async () => {
    try {
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

  const handleAddLineItem = () => {
    setLineItems([
      ...lineItems,
      { product_id: 0, quantity_with_unit: '', quantity: 0, unit_price: 0, total_price: 0 }
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length === 1) {
      toast({ title: 'Error', description: 'Must have at least one item' });
      return;
    }
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleProductChange = (index: number, productId: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    // Prefer explicit default_price (legacy Sheets field), but fall back to price_per_unit
    const price = (typeof product.default_price === 'number' && !isNaN(product.default_price))
      ? product.default_price
      : (typeof product.price_per_unit === 'number' && !isNaN(product.price_per_unit))
        ? product.price_per_unit
        : 0;

    const newItems = [...lineItems];
    const qty = newItems[index].quantity || 0;
    newItems[index] = {
      ...newItems[index],
      product_id: productId,
      quantity_with_unit: product.quantity_with_unit,
      unit_price: price,
      total_price: qty * price
    };
    setLineItems(newItems);
  };

  const handleQuantityChange = (index: number, quantity: string) => {
    const qty = parseFloat(quantity) || 0;
    const newItems = [...lineItems];
    newItems[index] = {
      ...newItems[index],
      quantity: qty,
      total_price: qty * newItems[index].unit_price
    };
    setLineItems(newItems);
  };

  const handleUnitPriceChange = (index: number, price: string) => {
    const unitPrice = parseFloat(price) || 0;
    const newItems = [...lineItems];
    newItems[index] = {
      ...newItems[index],
      unit_price: unitPrice,
      total_price: newItems[index].quantity * unitPrice
    };
    setLineItems(newItems);
  };

  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => sum + item.total_price, 0);
  };

  const handleSavePurchase = async () => {
    // Validation
    if (!formData.vendor_name.trim()) {
      toast({ title: 'Error', description: 'Please enter vendor name' });
      return;
    }

    if (!formData.invoice_number.trim()) {
      toast({ title: 'Error', description: 'Please enter invoice number' });
      return;
    }

    if (lineItems.some(item => item.product_id === 0)) {
      toast({ title: 'Error', description: 'Please select products for all items' });
      return;
    }

    if (lineItems.some(item => item.quantity <= 0)) {
      toast({ title: 'Error', description: 'Quantity must be greater than 0' });
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        vendor_name: formData.vendor_name,
        invoice_number: formData.invoice_number,
        purchase_date: formData.purchase_date,
        notes: formData.notes,
        items: lineItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price
        }))
      };

      const isEditing = editingPurchaseId !== null;
      const method = isEditing ? 'PUT' : 'POST';
      const url = isEditing
        ? `${API_BASE_URL}/purchases/${editingPurchaseId}`
        : `${API_BASE_URL}/purchases/`;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to save purchase');

      toast({ 
        title: 'Success', 
        description: isEditing ? 'Purchase updated successfully' : 'Purchase order created successfully'
      });

      // Reset form
      setFormData({
        vendor_name: '',
        invoice_number: '',
        purchase_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      setLineItems([{ product_id: 0, quantity_with_unit: '', quantity: 0, unit_price: 0, total_price: 0 }]);
      setEditingPurchaseId(null);
      setIsDialogOpen(false);
      await fetchPurchases();
    } catch (error) {
      logger.error('Failed to save purchase:', error);
      toast({ title: 'Error', description: 'Failed to save purchase' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditPurchase = (purchase: Purchase) => {
    setEditingPurchaseId(purchase.id);
    setFormData({
      vendor_name: purchase.vendor_name,
      invoice_number: purchase.invoice_number,
      purchase_date: purchase.purchase_date,
      notes: purchase.notes || ''
    });
    
    // Set line items from purchase
    const items = purchase.items.map(item => ({
      product_id: item.product_id,
      quantity_with_unit: item.quantity_with_unit,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price
    }));
    setLineItems(items);
    setIsDialogOpen(true);
  };

  const handleDeletePurchase = (purchase: Purchase) => {
    setPurchaseToDelete(purchase);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeletePurchase = async () => {
    if (!purchaseToDelete) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/purchases/${purchaseToDelete.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete purchase');

      toast({ title: 'Success', description: 'Purchase deleted successfully' });
      setIsDeleteDialogOpen(false);
      setPurchaseToDelete(null);
      await fetchPurchases();
    } catch (error) {
      logger.error('Failed to delete purchase:', error);
      toast({ title: 'Error', description: 'Failed to delete purchase' });
    } finally {
      setIsLoading(false);
    }
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingPurchaseId(null);
    setFormData({
      vendor_name: '',
      invoice_number: '',
      purchase_date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setLineItems([{ product_id: 0, quantity_with_unit: '', quantity: 0, unit_price: 0, total_price: 0 }]);
  };

  const filteredPurchases = purchases.filter(purchase =>
    purchase.vendor_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isAdmin={true} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Purchase Orders" />
        <div className="flex-1 overflow-auto">
          <div className="p-8 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Purchase Orders</h1>
                <p className="text-gray-600 mt-1">Manage purchase orders and vendor relations</p>
              </div>
              <Button 
                className="gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setIsDialogOpen(true)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    New Purchase Order
                  </>
                )}
              </Button>
            </div>

            {/* Create/Edit Purchase Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    {editingPurchaseId ? 'Edit Purchase Order' : 'Create Purchase Order'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingPurchaseId ? 'Update vendor details and line items' : 'Add vendor details and line items for the purchase order'}
                  </DialogDescription>
                </DialogHeader>

<div className="space-y-6 py-4 max-h-[65vh] overflow-y-auto pr-2">
                  {/* Purchase Header Section */}
                  <div className="border-b pb-4">
                    <h3 className="text-lg font-semibold mb-4 text-gray-900">Purchase Header</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="relative">
                        <Label htmlFor="vendor" className="text-right">Vendor Name *</Label>
                        <Input
                          id="vendor"
                          list="vendors"
                          value={formData.vendor_name}
                          onChange={(e) => { setFormData({ ...formData, vendor_name: e.target.value }); setShowVendorSuggestions(true); }}
                          onFocus={() => setShowVendorSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowVendorSuggestions(false), 150)}
                          placeholder="Select or enter vendor name"
                          className="mt-1"
                        />

                        {/* Datalist for existing vendors - allows selecting or typing a new vendor */}
                        <datalist id="vendors">
                          {Array.from(new Set(purchases.map(p => p.vendor_name))).map((v) => (
                            <option key={v} value={v} />
                          ))}
                        </datalist>

                        {/* Suggestion dropdown shown while typing */}
                        {showVendorSuggestions && vendorSuggestions.length > 0 && (
                          <div className="absolute left-0 right-0 mt-1 bg-white border rounded shadow z-20 max-h-40 overflow-y-auto">
                            {vendorSuggestions.map(v => (
                              <div
                                key={v}
                                className="px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer"
                                onMouseDown={() => { setFormData({ ...formData, vendor_name: v }); setShowVendorSuggestions(false); }}
                              >
                                {v}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="invoice" className="text-right">Invoice Number *</Label>
                        <Input
                          id="invoice"
                          value={formData.invoice_number}
                          onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                          placeholder="Enter invoice number"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="date" className="text-right">Purchase Date *</Label>
                        <Input
                          id="date"
                          type="date"
                          value={formData.purchase_date}
                          onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <Label htmlFor="notes">Notes</Label>
                      <Input
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Optional notes"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* Line Items Section */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Purchase Items</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddLineItem}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add Item
                      </Button>
                    </div>

                    <div className="overflow-x-auto border rounded-lg bg-white shadow-sm">
                      <div className="max-h-[34vh] overflow-y-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b sticky top-0">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Product</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Unit</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Quantity</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Unit Price</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Total</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lineItems.map((item, index) => {
                              const selectedProduct = products.find(p => p.id === item.product_id);
                              return (
                                <tr key={index} className="border-b hover:bg-gray-50">
                                  <td className="px-4 py-3">
                                    <Select
                                      value={item.product_id.toString()}
                                      onValueChange={(val) => handleProductChange(index, parseInt(val))}
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select product" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {products.map(prod => (
                                          <SelectItem key={prod.id} value={prod.id.toString()}>
                                            {prod.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>

                                    {selectedProduct && (
                                      <div className="text-xs text-gray-500 mt-1">ID: {`P0_${selectedProduct.id}`}</div>
                                    )}

                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-600">
                                    {selectedProduct?.quantity_with_unit || '-'}
                                  </td>
                                  <td className="px-4 py-3">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={item.quantity || ''}
                                      onChange={(e) => handleQuantityChange(index, e.target.value)}
                                      placeholder="0"
                                      className="w-20"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={item.unit_price || ''}
                                      onChange={(e) => handleUnitPriceChange(index, e.target.value)}
                                      placeholder="0.00"
                                      className="w-24"
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                                    ₹{item.total_price.toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRemoveLineItem(index)}
                                      className="text-red-500 hover:text-red-700"
                                    >
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

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={closeDialog}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSavePurchase}
                    disabled={isLoading}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                        {editingPurchaseId ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      editingPurchaseId ? 'Update Purchase Order' : 'Create Purchase Order'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Purchase Order</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete the purchase order from <span className="font-bold text-gray-900">{purchaseToDelete?.vendor_name}</span> dated {purchaseToDelete?.purchase_date}? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => { setIsDeleteDialogOpen(false); setPurchaseToDelete(null); }}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={confirmDeletePurchase} 
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

            {/* Search and Filter */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search purchase orders..."
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

            {/* Purchase Orders Table */}
            <Card>
              <CardHeader>
                <CardTitle>Purchase Orders</CardTitle>
                <CardDescription>Total Orders: {filteredPurchases.length}</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-gray-500">Loading purchases...</div>
                ) : filteredPurchases.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No purchases found</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] table-fixed">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 min-w-[180px]">Vendor</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 min-w-[160px]">Invoice #</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 min-w-[140px]">Date</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 min-w-[120px]">Items</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 min-w-[160px]">Total Amount</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 min-w-[180px]">Notes</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 min-w-[120px]">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPurchases.map((purchase) => (
                          <tr key={purchase.id} className="border-t hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm text-gray-900 font-medium whitespace-nowrap">{purchase.vendor_name}</td>
                            <td className="px-6 py-4 text-sm font-semibold text-blue-600 whitespace-nowrap">{purchase.invoice_number}</td>
                            <td className="px-6 py-4 text-sm text-gray-600 flex items-center gap-2 whitespace-nowrap">
                              <Calendar className="h-4 w-4" /> <span className="ml-1">{purchase.purchase_date}</span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">{purchase.items.length}</td>
                            <td className="px-6 py-4 text-sm text-gray-900 font-semibold flex items-center gap-1 whitespace-nowrap">
                              <DollarSign className="h-4 w-4" /> <span className="ml-1">₹{Number(purchase.total_amount || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                              {purchase.notes ? purchase.notes.substring(0, 30) + '...' : '-'}
                            </td>
                            <td className="px-6 py-4 text-sm space-x-2"> 
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleEditPurchase(purchase)}
                                disabled={isLoading}
                                className="text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isLoading ? (
                                  <div className="animate-spin h-4 w-4 border-2 border-gray-700 border-t-transparent rounded-full" />
                                ) : (
                                  <Edit className="h-4 w-4" />
                                )}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleDeletePurchase(purchase)}
                                disabled={isLoading}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isLoading ? (
                                  <div className="animate-spin h-4 w-4 border-2 border-red-600 border-t-transparent rounded-full" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
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
