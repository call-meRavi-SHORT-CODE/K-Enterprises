'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Download, FileText } from 'lucide-react';
import { format } from 'date-fns';

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

  const [inventoryReportType, setInventoryReportType] = useState<'current'|'low'|'monthly'|null>(null);
  const [inventoryReportData, setInventoryReportData] = useState<any[]>([]);
  const [inventoryMonth, setInventoryMonth] = useState<{ year: number; month: number }>({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const [inventorySelected, setInventorySelected] = useState<'current'|'low'|'monthly'>('current');
  const [inventoryScrollable, setInventoryScrollable] = useState(true);



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

  const printInventory = (type?: 'current'|'low'|'monthly') => {
    const t = type || inventoryReportType || inventorySelected;
    let dateText = '';
    if (t === 'current' || t === 'low') {
      const start = dateFrom ? format(dateFrom, 'yyyy-MM-dd') : '';
      const end = dateTo ? format(dateTo, 'yyyy-MM-dd') : '';
      dateText = (start || end) ? `<p style="margin:4px 0;">${start}${start && end ? ' - ' : ''}${end}</p>` : '';
    } else {
      dateText = `<p style="margin:4px 0;">${format(new Date(inventoryMonth.year, inventoryMonth.month -1, 1), 'MMMM yyyy')}</p>`;
    }

    const title = t === 'current' ? 'Current Stock Report' : t === 'low' ? 'Low Stock / Reorder Alerts' : 'Monthly Opening & Closing';
    const html = `<!doctype html><html><head><title>${title}</title><style>body{font-family:Inter, Arial, sans-serif;color:#111}table{border-collapse:collapse;width:100%}th,td{padding:8px;border:1px solid #ddd}th{background:#f9fafb;font-weight:700;text-transform:uppercase;font-size:12px;color:#000}td.center{text-align:center}tbody tr:nth-child(odd){background:#ffffff}tbody tr:nth-child(even){background:#fbfbfb}</style></head><body><div style="text-align:center;margin-bottom:12px"><h1 style="margin:0">Kokila Enterprise</h1><h2 style="margin:4px 0 0 0">${title}</h2>${dateText}</div>${renderInventoryTableHtml(inventoryReportData, t)}</body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
    }
  };



  const renderInventoryTableHtml = (rows: any[], type: any) => {
    if (!rows || rows.length === 0) return '<p>No data</p>';
    let headers: string[] = [];
    if (type === 'current') headers = ['Product', 'Opening', 'Purchased', 'Sold', 'Closing'];
    else if (type === 'low') headers = ['Product', 'Current Stock', 'Reorder Point', 'Shortage'];
    else headers = ['Product', 'Opening', 'Closing'];

    const headerCells = headers.map(h => {
      if (['Opening','Purchased','Sold','Closing','Current Stock','Reorder Point','Shortage'].includes(h)) {
        return `<th style="text-align:center;font-weight:700;color:#000;text-transform:uppercase">${h}</th>`;
      }
      return `<th style="text-align:left;font-weight:700;color:#000;text-transform:uppercase">${h}</th>`;
    }).join('');

    const trs = rows.map(r => {
      if (type === 'current') return `<tr><td style="text-align:left">${r.product_name}</td><td style="text-align:center">${r.opening}</td><td style="text-align:center">${r.purchased}</td><td style="text-align:center">${r.sold}</td><td style="text-align:center">${r.closing}</td></tr>`;
      if (type === 'low') return `<tr><td style="text-align:left">${r.product_name}</td><td style="text-align:center">${r.current_stock}</td><td style="text-align:center">${r.reorder_point}</td><td style="text-align:center">${r.shortage}</td></tr>`;
      return `<tr><td style="text-align:left">${r.product_name}</td><td style="text-align:center">${r.opening}</td><td style="text-align:center">${r.closing}</td></tr>`;
    }).join('');

    return `<table><thead><tr>${headerCells}</tr></thead><tbody>${trs}</tbody></table>`;
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
                          <Button variant="ghost" onClick={() => printInventory(inventorySelected as any)}><FileText className="mr-2" />Print</Button>
                        </div>
                      </div>

                      <div className="mt-4">
                        {inventoryReportData && inventoryReportData.length > 0 ? (
                          <>
                            <div className="mb-2 flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="text-sm text-gray-600">Showing {inventoryReportData.length} rows</div>
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Switch checked={inventoryScrollable} onCheckedChange={(v) => setInventoryScrollable(Boolean(v))} />
                                  <div>Enable scroll</div>
                                </div>
                              </div>
                            </div>
                            <div className={`overflow-auto rounded-lg shadow-sm border border-gray-200 bg-white ${inventoryScrollable ? 'max-h-[420px]' : ''}`}>
                              <table className="w-full min-w-[700px] table-auto">
                              <thead>
                                <tr>
                                  {(inventoryReportType || inventorySelected) === 'current' && <><th className="text-left p-3 sticky top-0 z-10 bg-gray-50 font-bold text-sm text-black uppercase tracking-wide">Product</th><th className="p-3 text-center sticky top-0 z-10 bg-gray-50 font-bold text-sm text-black uppercase tracking-wide">Opening</th><th className="p-3 text-center sticky top-0 z-10 bg-gray-50 font-bold text-sm text-black uppercase tracking-wide">Purchased</th><th className="p-3 text-center sticky top-0 z-10 bg-gray-50 font-bold text-sm text-black uppercase tracking-wide">Sold</th><th className="p-3 text-center sticky top-0 z-10 bg-gray-50 font-bold text-sm text-black uppercase tracking-wide">Closing</th></>}
                                  {(inventoryReportType || inventorySelected) === 'low' && <><th className="text-left p-3 sticky top-0 z-10 bg-gray-50 font-semibold text-sm text-gray-700 uppercase tracking-wide">Product</th><th className="p-3 text-center sticky top-0 z-10 bg-gray-50 font-semibold text-sm text-gray-700 uppercase tracking-wide">Current Stock</th><th className="p-3 text-center sticky top-0 z-10 bg-gray-50 font-semibold text-sm text-gray-700 uppercase tracking-wide">Reorder Point</th><th className="p-3 text-center sticky top-0 z-10 bg-gray-50 font-semibold text-sm text-gray-700 uppercase tracking-wide">Shortage</th></>}
                                  {(inventoryReportType || inventorySelected) === 'monthly' && <><th className="text-left p-3 sticky top-0 z-10 bg-gray-50 font-semibold text-sm text-gray-700 uppercase tracking-wide">Product</th><th className="p-3 text-center sticky top-0 z-10 bg-gray-50 font-semibold text-sm text-gray-700 uppercase tracking-wide">Opening</th><th className="p-3 text-center sticky top-0 z-10 bg-gray-50 font-semibold text-sm text-gray-700 uppercase tracking-wide">Closing</th></>}
                                </tr>
                              </thead>
                              <tbody>
                                {inventoryReportData.map((r: any, i: number) => (
                                  <tr key={i} className="odd:bg-white even:bg-gray-50 hover:bg-gray-50 transition-colors">
                                    {inventoryReportType === 'current' && <><td className="p-3 max-w-[420px] truncate" title={r.product_name}>{r.product_name}</td><td className="p-3 text-center font-mono">{r.opening}</td><td className="p-3 text-center font-mono">{r.purchased}</td><td className="p-3 text-center font-mono">{r.sold}</td><td className="p-3 text-center font-mono">{r.closing}</td></>}
                                    {inventoryReportType === 'low' && <><td className="p-3 max-w-[420px] truncate" title={r.product_name}>{r.product_name}</td><td className="p-3 text-center font-mono">{r.current_stock}</td><td className="p-3 text-center font-mono">{r.reorder_point}</td><td className="p-3 text-center font-mono">{r.shortage}</td></>}
                                    {inventoryReportType === 'monthly' && <><td className="p-3 max-w-[420px] truncate" title={r.product_name}>{r.product_name}</td><td className="p-3 text-center font-mono">{r.opening}</td><td className="p-3 text-center font-mono">{r.closing}</td></> }
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          </>
                        ) : (
                          <p className="text-sm text-gray-600">No preview available. Generate a report to see a preview here.</p>
                        )}
                      </div>
                    </CardContent>
                  </Card> 




              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}