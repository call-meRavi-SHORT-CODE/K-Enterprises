'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Download, 
  FileText, 
  Calendar,
  Search,
  Filter,
  Eye,
  DollarSign,
  TrendingUp,
  PieChart,
  Receipt
} from 'lucide-react';
import { format } from 'date-fns';

export default function PayslipsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState('2025');
  const [selectedMonth, setSelectedMonth] = useState('all');

  const user = {
    name: 'Ravikrishna J',
    email: 'ravikrishna@epicallayouts.com'
  };

  const payslips = [
    {
      id: 1,
      month: 'January',
      year: '2025',
      grossSalary: 85000,
      netSalary: 72500,
      deductions: 12500,
      status: 'available',
      generatedDate: '2025-01-31',
      downloadCount: 2
    },
    {
      id: 2,
      month: 'December',
      year: '2024',
      grossSalary: 85000,
      netSalary: 72500,
      deductions: 12500,
      status: 'available',
      generatedDate: '2024-12-31',
      downloadCount: 1
    },
    {
      id: 3,
      month: 'November',
      year: '2024',
      grossSalary: 80000,
      netSalary: 68000,
      deductions: 12000,
      status: 'available',
      generatedDate: '2024-11-30',
      downloadCount: 3
    },
    {
      id: 4,
      month: 'October',
      year: '2024',
      grossSalary: 80000,
      netSalary: 68000,
      deductions: 12000,
      status: 'available',
      generatedDate: '2024-10-31',
      downloadCount: 1
    },
    {
      id: 5,
      month: 'September',
      year: '2024',
      grossSalary: 75000,
      netSalary: 63750,
      deductions: 11250,
      status: 'available',
      generatedDate: '2024-09-30',
      downloadCount: 2
    }
  ];

  const salaryBreakdown = {
    basicSalary: 50000,
    hra: 20000,
    allowances: 15000,
    providentFund: 6000,
    professionalTax: 2500,
    incomeTax: 4000
  };

  const yearlyStats = {
    totalEarnings: 975000,
    totalDeductions: 142500,
    totalNetPay: 832500,
    averageMonthly: 69375
  };

  const filteredPayslips = payslips.filter(payslip => {
    const matchesSearch = payslip.month.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         payslip.year.includes(searchTerm);
    const matchesYear = selectedYear === 'all' || payslip.year === selectedYear;
    const matchesMonth = selectedMonth === 'all' || payslip.month === selectedMonth;
    
    return matchesSearch && matchesYear && matchesMonth;
  });

  const handleDownload = (payslipId: number, month: string, year: string) => {
    // Simulate download
    console.log(`Downloading payslip for ${month} ${year}`);
  };

  const handleView = (payslipId: number, month: string, year: string) => {
    // Simulate view
    console.log(`Viewing payslip for ${month} ${year}`);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Payslips & Salary" user={user} />
        
        <main className="flex-1 overflow-auto p-6 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Salary Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Current Salary</p>
                      <p className="text-3xl font-bold text-green-600">₹85,000</p>
                    </div>
                    <div className="p-3 bg-green-100 rounded-full">
                      <DollarSign className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center text-sm">
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-green-600">+6.25% from last month</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Net Pay</p>
                      <p className="text-3xl font-bold text-blue-600">₹72,500</p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-full">
                      <Receipt className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-sm text-gray-600">After deductions</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">YTD Earnings</p>
                      <p className="text-3xl font-bold text-purple-600">₹9,75,000</p>
                    </div>
                    <div className="p-3 bg-purple-100 rounded-full">
                      <PieChart className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-sm text-gray-600">Year to date</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Deductions</p>
                      <p className="text-3xl font-bold text-orange-600">₹12,500</p>
                    </div>
                    <div className="p-3 bg-orange-100 rounded-full">
                      <FileText className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-sm text-gray-600">This month</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="payslips" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="payslips">Payslips</TabsTrigger>
                <TabsTrigger value="breakdown">Salary Breakdown</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>

              {/* Payslips Tab */}
              <TabsContent value="payslips" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Payslip History
                    </CardTitle>
                    <CardDescription>
                      Download and view your monthly payslips
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-4 mb-6">
                      <div className="flex-1">
                        <Label htmlFor="search">Search</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            id="search"
                            placeholder="Search by month or year..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="year">Year</Label>
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Year" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Years</SelectItem>
                            <SelectItem value="2025">2025</SelectItem>
                            <SelectItem value="2024">2024</SelectItem>
                            <SelectItem value="2023">2023</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="month">Month</Label>
                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                          <SelectTrigger className="w-36">
                            <SelectValue placeholder="Month" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Months</SelectItem>
                            <SelectItem value="January">January</SelectItem>
                            <SelectItem value="February">February</SelectItem>
                            <SelectItem value="March">March</SelectItem>
                            <SelectItem value="April">April</SelectItem>
                            <SelectItem value="May">May</SelectItem>
                            <SelectItem value="June">June</SelectItem>
                            <SelectItem value="July">July</SelectItem>
                            <SelectItem value="August">August</SelectItem>
                            <SelectItem value="September">September</SelectItem>
                            <SelectItem value="October">October</SelectItem>
                            <SelectItem value="November">November</SelectItem>
                            <SelectItem value="December">December</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Payslips List */}
                    <div className="space-y-4">
                      {filteredPayslips.map((payslip) => (
                        <div key={payslip.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow duration-200">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-lg">{payslip.month} {payslip.year}</h4>
                                <Badge variant="secondary" className="bg-green-100 text-green-800">
                                  {payslip.status}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-600">
                                <div>
                                  <span className="font-medium">Gross: </span>
                                  ₹{payslip.grossSalary.toLocaleString()}
                                </div>
                                <div>
                                  <span className="font-medium">Net: </span>
                                  ₹{payslip.netSalary.toLocaleString()}
                                </div>
                                <div>
                                  <span className="font-medium">Deductions: </span>
                                  ₹{payslip.deductions.toLocaleString()}
                                </div>
                              </div>
                              <p className="text-xs text-gray-500">
                                Generated on {format(new Date(payslip.generatedDate), 'MMM dd, yyyy')} • 
                                Downloaded {payslip.downloadCount} times
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleView(payslip.id, payslip.month, payslip.year)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              <Button 
                                size="sm"
                                onClick={() => handleDownload(payslip.id, payslip.month, payslip.year)}
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {filteredPayslips.length === 0 && (
                      <div className="text-center py-8">
                        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">No payslips found matching your criteria</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Salary Breakdown Tab */}
              <TabsContent value="breakdown" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-green-600">Earnings</CardTitle>
                      <CardDescription>Monthly salary components</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                        <span className="font-medium">Basic Salary</span>
                        <span className="font-semibold">₹{salaryBreakdown.basicSalary.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                        <span className="font-medium">House Rent Allowance</span>
                        <span className="font-semibold">₹{salaryBreakdown.hra.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                        <span className="font-medium">Other Allowances</span>
                        <span className="font-semibold">₹{salaryBreakdown.allowances.toLocaleString()}</span>
                      </div>
                      <div className="border-t pt-3">
                        <div className="flex justify-between items-center font-bold text-lg">
                          <span>Total Earnings</span>
                          <span className="text-green-600">
                            ₹{(salaryBreakdown.basicSalary + salaryBreakdown.hra + salaryBreakdown.allowances).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-red-600">Deductions</CardTitle>
                      <CardDescription>Monthly deductions breakdown</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                        <span className="font-medium">Provident Fund</span>
                        <span className="font-semibold">₹{salaryBreakdown.providentFund.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                        <span className="font-medium">Professional Tax</span>
                        <span className="font-semibold">₹{salaryBreakdown.professionalTax.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                        <span className="font-medium">Income Tax</span>
                        <span className="font-semibold">₹{salaryBreakdown.incomeTax.toLocaleString()}</span>
                      </div>
                      <div className="border-t pt-3">
                        <div className="flex justify-between items-center font-bold text-lg">
                          <span>Total Deductions</span>
                          <span className="text-red-600">
                            ₹{(salaryBreakdown.providentFund + salaryBreakdown.professionalTax + salaryBreakdown.incomeTax).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Net Salary Calculation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                        <span className="font-medium text-lg">Gross Salary</span>
                        <span className="font-bold text-lg text-blue-600">₹85,000</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-red-50 rounded-lg">
                        <span className="font-medium text-lg">Total Deductions</span>
                        <span className="font-bold text-lg text-red-600">- ₹12,500</span>
                      </div>
                      <div className="border-t-2 border-gray-200 pt-4">
                        <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                          <span className="font-bold text-xl">Net Salary</span>
                          <span className="font-bold text-xl text-green-600">₹72,500</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Analytics Tab */}
              <TabsContent value="analytics" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardContent className="p-6 text-center">
                      <div className="text-2xl font-bold text-blue-600">{yearlyStats.totalEarnings.toLocaleString()}</div>
                      <p className="text-sm text-gray-600">Total Earnings (YTD)</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6 text-center">
                      <div className="text-2xl font-bold text-red-600">{yearlyStats.totalDeductions.toLocaleString()}</div>
                      <p className="text-sm text-gray-600">Total Deductions (YTD)</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6 text-center">
                      <div className="text-2xl font-bold text-green-600">{yearlyStats.totalNetPay.toLocaleString()}</div>
                      <p className="text-sm text-gray-600">Net Pay (YTD)</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6 text-center">
                      <div className="text-2xl font-bold text-purple-600">{yearlyStats.averageMonthly.toLocaleString()}</div>
                      <p className="text-sm text-gray-600">Average Monthly</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Salary Trends</CardTitle>
                    <CardDescription>Your salary progression over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="text-center p-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                        <TrendingUp className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                        <p className="text-lg font-semibold text-blue-600">Salary Growth: +15%</p>
                        <p className="text-sm text-gray-600">Compared to last year</p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-green-50 rounded-lg">
                          <h4 className="font-semibold text-green-800">Highest Month</h4>
                          <p className="text-2xl font-bold text-green-600">₹85,000</p>
                          <p className="text-sm text-gray-600">January 2025</p>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-lg">
                          <h4 className="font-semibold text-blue-800">Average Growth</h4>
                          <p className="text-2xl font-bold text-blue-600">₹2,500</p>
                          <p className="text-sm text-gray-600">Per quarter</p>
                        </div>
                      </div>
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