'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Clock, 
  Calendar, 
  FileText, 
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Building2,
  BarChart3,
  UserCheck,
  UserX
} from 'lucide-react';

export default function AdminDashboard() {
  const user = {
    name: 'Admin User',
    email: 'admin@kokilaenterprises.com'
  };

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const [kpis, setKpis] = useState<{ 
    todaysSales?: number;
    todaysSalesChangePct?: number;
    monthRevenue?: number;
    monthRevenueChangePct?: number;
    lowStockCount?: number;
    lowStockChangePct?: number;
    bestSellingProduct?: string;
    profitToday?: number;
    profitTodayChangePct?: number;
  }>({});

  const [loadingKpis, setLoadingKpis] = useState(false);
  const [kpisError, setKpisError] = useState<string | null>(null);

  const fetchKpis = async () => {
    try {
      setLoadingKpis(true);
      setKpisError(null);
      const resp = await fetch(`${API_BASE_URL}/reports/kpis`);
      if (!resp.ok) throw new Error('Failed to fetch KPIs');
      const data = await resp.json();
      // Accept flexible payloads
      const payload = data.kpis || data.report || data || {};
      setKpis({
        todaysSales: payload.todays_sales?.value ?? payload.todaysSales ?? payload.todays_sales ?? undefined,
        todaysSalesChangePct: payload.todays_sales?.change_pct ?? payload.todaysSalesChangePct ?? payload.todays_sales?.change_pct ?? undefined,
        monthRevenue: payload.month_revenue?.value ?? payload.monthRevenue ?? undefined,
        monthRevenueChangePct: payload.month_revenue?.change_pct ?? payload.monthRevenueChangePct ?? undefined,
        lowStockCount: payload.low_stock_count?.value ?? payload.lowStockCount ?? undefined,
        lowStockChangePct: payload.low_stock_count?.change_pct ?? payload.lowStockChangePct ?? undefined,
        bestSellingProduct: payload.best_selling_product ?? payload.bestSellingProduct ?? undefined,
        profitToday: payload.profit_today?.value ?? payload.profitToday ?? undefined,
        profitTodayChangePct: payload.profit_today?.change_pct ?? payload.profitTodayChangePct ?? undefined,
      });
    } catch (err: any) {
      console.error(err);
      setKpisError(err?.message || 'Failed to load KPIs');
    } finally {
      setLoadingKpis(false);
    }
  };

  useEffect(()=>{ fetchKpis(); }, []);

  // App-focused dashboard: removed unrelated HR/activity data. Metrics are populated from backend later.

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isAdmin={true} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Admin Dashboard" user={user} />
        
        <main className="flex-1 overflow-auto p-6 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Welcome Section */}
            <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Welcome to Admin Dashboard! 🎯</h2>
                  <p className="text-purple-100">Manage your organization effectively</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-purple-100">KOKILA</p>
                  <p className="text-xl font-semibold">ENTERPRISES</p>
                </div>
              </div>
            </div>

            {/* App Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Today's Sales</p>
                      <p className="text-2xl font-bold text-blue-600">{loadingKpis ? '—' : (typeof kpis.todaysSales === 'number' ? `₹${Number(kpis.todaysSales).toLocaleString('en-IN')}` : '—')}</p>
                      {kpis.todaysSalesChangePct !== undefined && (
                        <div className={`text-sm ${kpis.todaysSalesChangePct! >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {kpis.todaysSalesChangePct! >= 0 ? '▲' : '▼'} {Math.abs(Number(kpis.todaysSalesChangePct)).toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <div className="p-3 bg-blue-100 rounded-full">
                      <Clock className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">This Month Revenue</p>
                      <p className="text-2xl font-bold text-green-600">{loadingKpis ? '—' : (kpis.monthRevenue ? `₹${kpis.monthRevenue.toLocaleString()}` : '—')}</p>
                      {kpis.monthRevenueChangePct !== undefined && (
                        <div className={`text-sm ${kpis.monthRevenueChangePct! >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {kpis.monthRevenueChangePct! >= 0 ? '▲' : '▼'} {Math.abs(Number(kpis.monthRevenueChangePct)).toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <div className="p-3 bg-green-100 rounded-full">
                      <BarChart3 className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Low Stock Count</p>
                      <p className="text-2xl font-bold text-orange-600">{loadingKpis ? '—' : (kpis.lowStockCount ?? '—')} Items</p>
                      {kpis.lowStockChangePct !== undefined && (
                        <div className={`text-sm ${kpis.lowStockChangePct! >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {kpis.lowStockChangePct! >= 0 ? '▲' : '▼'} {Math.abs(Number(kpis.lowStockChangePct)).toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <div className="p-3 bg-orange-100 rounded-full">
                      <AlertCircle className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Best Selling Product</p>
                      <p className="text-2xl font-bold text-purple-600">{loadingKpis ? '—' : kpis.bestSellingProduct ?? '—'}</p>
                    </div>
                    <div className="p-3 bg-purple-100 rounded-full">
                      <TrendingUp className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Profit Today</p>
                      <p className="text-2xl font-bold text-teal-600">{loadingKpis ? '—' : (kpis.profitToday ? `₹${kpis.profitToday.toLocaleString()}` : '—')}</p>
                      {kpis.profitTodayChangePct !== undefined && (
                        <div className={`text-sm ${kpis.profitTodayChangePct! >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {kpis.profitTodayChangePct! >= 0 ? '▲' : '▼'} {Math.abs(Number(kpis.profitTodayChangePct)).toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <div className="p-3 bg-teal-100 rounded-full">
                      <CheckCircle className="h-6 w-6 text-teal-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Frequently used product & inventory functions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button variant="outline" className="h-20 flex flex-col items-center gap-2" onClick={()=>{ /* navigate to products */ window.location.href='/admin/products'; }}>
                    <FileText className="h-6 w-6" />
                    <span className="text-sm">View Products</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col items-center gap-2" onClick={()=>{ window.location.href='/admin/reports'; }}>
                    <BarChart3 className="h-6 w-6" />
                    <span className="text-sm">Inventory Reports</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col items-center gap-2" onClick={()=>{ window.location.href='/admin/products'; }}>
                    <Users className="h-6 w-6" />
                    <span className="text-sm">Add Product</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col items-center gap-2" onClick={()=>{ window.location.href='/admin/purchase'; }}>
                    <TrendingUp className="h-6 w-6" />
                    <span className="text-sm">Create Purchase</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}