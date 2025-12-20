'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Download, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';

export default function AdminReportsPage() {
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d;
  });

  const user = {
    name: 'Admin User',
    email: 'admin@epicallayouts.com'
  };

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [inventoryReportType, setInventoryReportType] = useState<'current'|'low'|'monthly'|null>(null);
  const [inventoryReportData, setInventoryReportData] = useState<any[]>([]);
  const [inventoryMonth, setInventoryMonth] = useState<{ year: number; month: number }>({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const [inventorySelected, setInventorySelected] = useState<'current'|'low'|'monthly'>('current');



  const handleInventoryQuick = async (type: 'current'|'low'|'monthly') => {
    try {
      setInventoryReportType(type);
      setInventoryReportData([]);
      if (type === 'current') {
        const start = dateFrom ? format(dateFrom, 'yyyy-MM-dd') : undefined;
        const end = dateTo ? format(dateTo, 'yyyy-MM-dd') : undefined;
        const q = new URLSearchParams();
        if (start) q.set('start_date', start);
        if (end) q.set('end_date', end);
        // limit results for preview to avoid large payloads
        q.set('limit', '50');
        const resp = await fetch(`${API_BASE_URL}/reports/current-stock?${q.toString()}`);
        if (!resp.ok) throw new Error('Failed to fetch current stock');
        const data = await resp.json();
        setInventoryReportData(data.report || data);
      } else if (type === 'low') {
        const resp = await fetch(`${API_BASE_URL}/reports/low-stock?limit=50`);
        if (!resp.ok) throw new Error('Failed to fetch low stock');
        const data = await resp.json();
        setInventoryReportData(data.alerts || data);
      } else {
        const { year, month } = inventoryMonth;
        const resp = await fetch(`${API_BASE_URL}/reports/monthly?year=${year}&month=${month}&limit=50`);
        if (!resp.ok) throw new Error('Failed to fetch monthly report');
        const data = await resp.json();
        setInventoryReportData(data.report || data);
      }

      // keep modal closed for inline preview; open manually when user wants full view
    } catch (err) {
      console.error('Failed to fetch inventory report', err);
      // toast could be used here
    }
  }; 



  const downloadInventoryCSV = (type: 'current'|'low'|'monthly') => {
    if (type === 'current') {
      const start = dateFrom ? format(dateFrom, 'yyyy-MM-dd') : undefined;
      const end = dateTo ? format(dateTo, 'yyyy-MM-dd') : undefined;
      const q = new URLSearchParams();
      if (start) q.set('start_date', start);
      if (end) q.set('end_date', end);
      window.open(`${API_BASE_URL}/reports/current-stock?format=csv&${q.toString()}`, '_blank');
    } else if (type === 'low') {
      window.open(`${API_BASE_URL}/reports/low-stock?format=csv`, '_blank');
    } else {
      const { year, month } = inventoryMonth;
      window.open(`${API_BASE_URL}/reports/monthly?format=csv&year=${year}&month=${month}`, '_blank');
    }
  };

  const printInventory = () => {
    const html = `<!doctype html><html><head><title>Inventory Report</title><style>table{border-collapse:collapse;width:100%}td,th{padding:8px;border:1px solid #ddd}</style></head><body><h2>Inventory Report</h2>${renderInventoryTableHtml(inventoryReportData, inventoryReportType)}</body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
    }
  };

  const openFullInventoryReport = async (type: 'current'|'low'|'monthly') => {
    try {
      setInventoryReportType(type);
      setInventoryReportData([]);
      if (type === 'current') {
        const start = dateFrom ? format(dateFrom, 'yyyy-MM-dd') : undefined;
        const end = dateTo ? format(dateTo, 'yyyy-MM-dd') : undefined;
        const q = new URLSearchParams();
        if (start) q.set('start_date', start);
        if (end) q.set('end_date', end);
        // no limit for full view
        const resp = await fetch(`${API_BASE_URL}/reports/current-stock?${q.toString()}`);
        if (!resp.ok) throw new Error('Failed to fetch current stock');
        const data = await resp.json();
        setInventoryReportData(data.report || data);
      } else if (type === 'low') {
        const resp = await fetch(`${API_BASE_URL}/reports/low-stock`);
        if (!resp.ok) throw new Error('Failed to fetch low stock');
        const data = await resp.json();
        setInventoryReportData(data.alerts || data);
      } else {
        const { year, month } = inventoryMonth;
        const resp = await fetch(`${API_BASE_URL}/reports/monthly?year=${year}&month=${month}`);
        if (!resp.ok) throw new Error('Failed to fetch monthly report');
        const data = await resp.json();
        setInventoryReportData(data.report || data);
      }

      setInventoryModalOpen(true);
    } catch (err) {
      console.error('Failed to fetch inventory report', err);
    }
  };

  const renderInventoryTableHtml = (rows: any[], type: any) => {
    if (!rows || rows.length === 0) return '<p>No data</p>';
    let headers: string[] = [];
    if (type === 'current') headers = ['Product', 'Opening', 'Purchased', 'Sold', 'Closing'];
    else if (type === 'low') headers = ['Product', 'Current Stock', 'Reorder Point', 'Shortage'];
    else headers = ['Product', 'Opening', 'Closing'];

    const trs = rows.map(r => {
      if (type === 'current') return `<tr><td>${r.product_name}</td><td>${r.opening}</td><td>${r.purchased}</td><td>${r.sold}</td><td>${r.closing}</td></tr>`;
      if (type === 'low') return `<tr><td>${r.product_name}</td><td>${r.current_stock}</td><td>${r.reorder_point}</td><td>${r.shortage}</td></tr>`;
      return `<tr><td>${r.product_name}</td><td>${r.opening}</td><td>${r.closing}</td></tr>`;
    }).join('');

    return `<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${trs}</tbody></table>`;
  };


  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isAdmin={true} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Reports & Analytics" user={user} />
        
        <main className="flex-1 overflow-auto p-6 custom-scrollbar">
          <div className="max-w-9xl mx-auto space-y-6">
            

            <Tabs defaultValue="generate" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="generate">Inventory Report</TabsTrigger>
                <TabsTrigger value="analytics">Sales Report</TabsTrigger>
                <TabsTrigger value="insights">Purchases Report</TabsTrigger>
              </TabsList>

              <TabsContent value="generate" className="space-y-15">

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-black-800">Inventory Reports</CardTitle>
                      <CardDescription>Get your inventory stock reports</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col sm:flex-row sm:items-end sm:gap-4 gap-3">
                        <div className="flex-1">
                          <Label className="text-sm">Report Type</Label>
                          <Select value={inventorySelected} onValueChange={(v) => setInventorySelected(v as 'current'|'low'|'monthly')}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select report" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="current">Current Stock</SelectItem>
                              <SelectItem value="low">Low Stock</SelectItem>
                              <SelectItem value="monthly">Opening / Closing (Monthly)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {inventorySelected === 'monthly' ? (
                          <div className="flex gap-2 items-end">
                            <div>
                              <Label className="text-sm">Month</Label>
                              <div className="flex gap-2">
                                <Select value={String(inventoryMonth.month)} onValueChange={(v) => setInventoryMonth(prev => ({ ...prev, month: Number(v) }))}>
                                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: 12 }).map((_, i) => (
                                      <SelectItem key={i} value={String(i + 1)}>{format(new Date(2020, i, 1), 'LLLL')}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                <Select value={String(inventoryMonth.year)} onValueChange={(v) => setInventoryMonth(prev => ({ ...prev, year: Number(v) }))}>
                                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: 5 }).map((_, i) => {
                                      const y = new Date().getFullYear() - 2 + i;
                                      return <SelectItem key={y} value={String(y)}>{String(y)}</SelectItem>;
                                    })}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-sm">From</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" className="w-full">{dateFrom ? format(dateFrom, 'yyyy-MM-dd') : 'Select'}</Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                  <Calendar mode="single" selected={dateFrom} onSelect={(d) => setDateFrom(d || undefined)} initialFocus />
                                </PopoverContent>
                              </Popover>
                            </div>

                            <div>
                              <Label className="text-sm">To</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" className="w-full">{dateTo ? format(dateTo, 'yyyy-MM-dd') : 'Select'}</Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                  <Calendar mode="single" selected={dateTo} onSelect={(d) => setDateTo(d || undefined)} />
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <Button onClick={() => handleInventoryQuick(inventorySelected as any)}><Download className="mr-2" />Generate</Button>
                          <Button variant="outline" onClick={() => downloadInventoryCSV(inventorySelected as any)}><Download className="mr-2" />Download</Button>
                          <Button variant="ghost" onClick={async () => await openFullInventoryReport(inventorySelected as any)}><FileText className="mr-2" />Open</Button>
                        </div>
                      </div>

                      <div className="mt-4">
                        {inventoryReportData && inventoryReportData.length > 0 ? (
                          <div className="overflow-auto">
                            <table className="w-full min-w-[700px] table-auto">
                              <thead>
                                <tr>
                                  {inventoryReportType === 'current' && <><th className="text-left p-2">Product</th><th className="p-2">Opening</th><th className="p-2">Purchased</th><th className="p-2">Sold</th><th className="p-2">Closing</th></>}
                                  {inventoryReportType === 'low' && <><th className="text-left p-2">Product</th><th className="p-2">Current Stock</th><th className="p-2">Reorder Point</th><th className="p-2">Shortage</th></>}
                                  {inventoryReportType === 'monthly' && <><th className="text-left p-2">Product</th><th className="p-2">Opening</th><th className="p-2">Closing</th></>}
                                </tr>
                              </thead>
                              <tbody>
                                {inventoryReportData.map((r: any, i: number) => (
                                  <tr key={i} className="odd:bg-gray-50">
                                    {inventoryReportType === 'current' && <><td className="p-2">{r.product_name}</td><td className="p-2">{r.opening}</td><td className="p-2">{r.purchased}</td><td className="p-2">{r.sold}</td><td className="p-2">{r.closing}</td></>}
                                    {inventoryReportType === 'low' && <><td className="p-2">{r.product_name}</td><td className="p-2">{r.current_stock}</td><td className="p-2">{r.reorder_point}</td><td className="p-2">{r.shortage}</td></>}
                                    {inventoryReportType === 'monthly' && <><td className="p-2">{r.product_name}</td><td className="p-2">{r.opening}</td><td className="p-2">{r.closing}</td></>}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-600">No preview available. Generate a report to see a preview here.</p>
                        )}
                      </div>
                    </CardContent>
                  </Card> 



                  {/* Inventory Report Dialog */}
                  <Dialog open={inventoryModalOpen} onOpenChange={setInventoryModalOpen}>
                    <DialogContent className="max-w-[90vw] max-h-[80vh] overflow-auto">
                      <DialogHeader>
                        <DialogTitle>{inventoryReportType === 'current' ? 'Current Stock Report' : inventoryReportType === 'low' ? 'Low Stock / Reorder Alerts' : 'Monthly Opening & Closing'}</DialogTitle>
                      </DialogHeader>

                      <div className="mt-2">
                        {inventoryReportData && inventoryReportData.length > 0 ? (
                          <div className="overflow-auto max-w-full">
                            <table className="w-full min-w-[700px] table-auto">
                              <thead>
                                <tr>
                                  {inventoryReportType === 'current' && <><th className="text-left p-2">Product</th><th className="p-2">Opening</th><th className="p-2">Purchased</th><th className="p-2">Sold</th><th className="p-2">Closing</th></>}
                                  {inventoryReportType === 'low' && <><th className="text-left p-2">Product</th><th className="p-2">Current Stock</th><th className="p-2">Reorder Point</th><th className="p-2">Shortage</th></>}
                                  {inventoryReportType === 'monthly' && <><th className="text-left p-2">Product</th><th className="p-2">Opening</th><th className="p-2">Closing</th></>}
                                </tr>
                              </thead>
                              <tbody>
                                {inventoryReportData.map((r:any, i:number)=>(
                                  <tr key={i} className="odd:bg-gray-50">
                                    {inventoryReportType === 'current' && <><td className="p-2">{r.product_name}</td><td className="p-2">{r.opening}</td><td className="p-2">{r.purchased}</td><td className="p-2">{r.sold}</td><td className="p-2">{r.closing}</td></>}
                                    {inventoryReportType === 'low' && <><td className="p-2">{r.product_name}</td><td className="p-2">{r.current_stock}</td><td className="p-2">{r.reorder_point}</td><td className="p-2">{r.shortage}</td></>}
                                    {inventoryReportType === 'monthly' && <><td className="p-2">{r.product_name}</td><td className="p-2">{r.opening}</td><td className="p-2">{r.closing}</td></>}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-600">No data to display</p>
                        )}
                      </div>

                      <DialogFooter className="mt-4 flex gap-2">
                        <Button onClick={()=>downloadInventoryCSV(inventoryReportType || 'current')}><Download className="mr-2" /> CSV</Button>
                        <Button variant="outline" onClick={printInventory}>Print</Button>
                        <DialogClose asChild>
                          <Button variant="ghost">Close</Button>
                        </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}