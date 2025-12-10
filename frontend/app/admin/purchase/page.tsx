'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  ShoppingCart, 
  Search, 
  Filter, 
  Plus,
  Edit,
  Trash2,
  Calendar,
  DollarSign
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
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

export default function PurchasePage() {
  const [purchases, setPurchases] = useState([
    { id: 1, vendor: 'Vendor A', poNumber: 'PO001', date: '2024-12-05', amount: 5000, status: 'Completed', items: 10 },
    { id: 2, vendor: 'Vendor B', poNumber: 'PO002', date: '2024-12-08', amount: 3500, status: 'Pending', items: 5 },
    { id: 3, vendor: 'Vendor C', poNumber: 'PO003', date: '2024-12-09', amount: 7200, status: 'In Transit', items: 15 },
  ]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ vendor: '', poNumber: '', date: '', amount: '', items: '' });

  const filteredPurchases = purchases.filter(purchase =>
    purchase.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
    purchase.poNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddPurchase = () => {
    if (!formData.vendor || !formData.poNumber) {
      toast({ title: 'Error', description: 'Please fill in all required fields' });
      return;
    }
    const newPurchase = {
      id: purchases.length + 1,
      vendor: formData.vendor,
      poNumber: formData.poNumber,
      date: formData.date,
      amount: parseFloat(formData.amount),
      items: parseInt(formData.items),
      status: 'Pending'
    };
    setPurchases([...purchases, newPurchase]);
    setFormData({ vendor: '', poNumber: '', date: '', amount: '', items: '' });
    setIsDialogOpen(false);
    toast({ title: 'Success', description: 'Purchase order created successfully' });
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Completed': return 'default';
      case 'Pending': return 'secondary';
      case 'In Transit': return 'outline';
      default: return 'secondary';
    }
  };

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
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Purchase Order
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Purchase Order</DialogTitle>
                    <DialogDescription>Add a new purchase order</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Vendor Name</label>
                      <Input 
                        value={formData.vendor}
                        onChange={(e) => setFormData({...formData, vendor: e.target.value})}
                        placeholder="Enter vendor name"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">PO Number</label>
                      <Input 
                        value={formData.poNumber}
                        onChange={(e) => setFormData({...formData, poNumber: e.target.value})}
                        placeholder="Enter PO number"
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
                      <label className="text-sm font-medium">Amount</label>
                      <Input 
                        type="number"
                        value={formData.amount}
                        onChange={(e) => setFormData({...formData, amount: e.target.value})}
                        placeholder="Enter amount"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Items</label>
                      <Input 
                        type="number"
                        value={formData.items}
                        onChange={(e) => setFormData({...formData, items: e.target.value})}
                        placeholder="Enter number of items"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleAddPurchase}>Create Order</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

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
                  <Button variant="outline" className="gap-2">
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
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">PO Number</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Vendor</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Amount</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Items</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPurchases.map((purchase) => (
                        <tr key={purchase.id} className="border-t hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium">{purchase.poNumber}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{purchase.vendor}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 flex items-center gap-2">
                            <Calendar className="h-4 w-4" /> {purchase.date}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium flex items-center gap-1">
                            <DollarSign className="h-4 w-4" /> {purchase.amount}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{purchase.items}</td>
                          <td className="px-6 py-4 text-sm">
                            <Badge variant={getStatusColor(purchase.status)}>
                              {purchase.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-sm space-x-2">
                            <Button variant="ghost" size="sm"><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm"><Trash2 className="h-4 w-4 text-red-500" /></Button>
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
