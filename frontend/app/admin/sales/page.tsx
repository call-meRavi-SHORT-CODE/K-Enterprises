'use client';

import { useState } from 'react';
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

export default function SalesPage() {
  const [sales, setSales] = useState([
    { id: 1, invoiceNo: 'INV001', customer: 'Customer A', date: '2024-12-05', amount: 5500, quantity: 10, status: 'Completed' },
    { id: 2, invoiceNo: 'INV002', customer: 'Customer B', date: '2024-12-08', amount: 3200, quantity: 8, status: 'Pending' },
    { id: 3, invoiceNo: 'INV003', customer: 'Customer C', date: '2024-12-09', amount: 8900, quantity: 20, status: 'Completed' },
  ]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ customer: '', invoiceNo: '', date: '', amount: '', quantity: '' });

  const filteredSales = sales.filter(sale =>
    sale.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddSale = () => {
    if (!formData.customer || !formData.invoiceNo) {
      toast({ title: 'Error', description: 'Please fill in all required fields' });
      return;
    }
    const newSale = {
      id: sales.length + 1,
      customer: formData.customer,
      invoiceNo: formData.invoiceNo,
      date: formData.date,
      amount: parseFloat(formData.amount),
      quantity: parseInt(formData.quantity),
      status: 'Pending'
    };
    setSales([...sales, newSale]);
    setFormData({ customer: '', invoiceNo: '', date: '', amount: '', quantity: '' });
    setIsDialogOpen(false);
    toast({ title: 'Success', description: 'Sale record created successfully' });
  };

  const totalSales = sales.reduce((sum, sale) => sum + sale.amount, 0);
  const totalQuantity = sales.reduce((sum, sale) => sum + sale.quantity, 0);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Completed': return 'default';
      case 'Pending': return 'secondary';
      default: return 'secondary';
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
                      <label className="text-sm font-medium">Amount</label>
                      <Input 
                        type="number"
                        value={formData.amount}
                        onChange={(e) => setFormData({...formData, amount: e.target.value})}
                        placeholder="Enter amount"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Quantity</label>
                      <Input 
                        type="number"
                        value={formData.quantity}
                        onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                        placeholder="Enter quantity"
                      />
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
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium">{sale.invoiceNo}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{sale.customer}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 flex items-center gap-2">
                            <Calendar className="h-4 w-4" /> {sale.date}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 font-medium flex items-center gap-1">
                            <DollarSign className="h-4 w-4" /> {sale.amount}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{sale.quantity}</td>
                          <td className="px-6 py-4 text-sm">
                            <Badge variant={getStatusColor(sale.status)}>
                              {sale.status}
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
