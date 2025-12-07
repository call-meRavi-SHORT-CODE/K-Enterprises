'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  BarChart3, 
  Download,
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  FileText,
  PieChart,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';

export default function AdminReportsPage() {
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedReport, setSelectedReport] = useState('attendance');

  const user = {
    name: 'Admin User',
    email: 'admin@epicallayouts.com'
  };

  const reportTypes = [
    { value: 'attendance', label: 'Attendance Report' },
    { value: 'leave', label: 'Leave Report' },
    { value: 'timesheet', label: 'Timesheet Report' },
    { value: 'payroll', label: 'Payroll Report' },
    { value: 'performance', label: 'Performance Report' }
  ];

  const departments = ['Engineering', 'Design', 'Marketing', 'HR', 'Sales'];

  const quickStats = {
    totalEmployees: 124,
    avgAttendance: 87,
    totalLeaves: 45,
    avgWorkHours: 8.5,
    productivity: 92,
    satisfaction: 88
  };

  const attendanceData = [
    { month: 'Jan', attendance: 89, target: 90 },
    { month: 'Feb', attendance: 92, target: 90 },
    { month: 'Mar', attendance: 87, target: 90 },
    { month: 'Apr', attendance: 94, target: 90 },
    { month: 'May', attendance: 91, target: 90 },
    { month: 'Jun', attendance: 88, target: 90 }
  ];

  const departmentStats = [
    { name: 'Engineering', employees: 45, attendance: 89, leaves: 12, productivity: 94 },
    { name: 'Design', employees: 22, attendance: 92, leaves: 8, productivity: 91 },
    { name: 'Marketing', employees: 18, attendance: 87, leaves: 6, productivity: 88 },
    { name: 'HR', employees: 12, attendance: 94, leaves: 4, productivity: 96 },
    { name: 'Sales', employees: 27, attendance: 85, leaves: 15, productivity: 87 }
  ];

  const generateReport = () => {
    console.log('Generating report:', {
      type: selectedReport,
      department: selectedDepartment,
      dateFrom,
      dateTo
    });
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isAdmin={true} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Reports & Analytics" user={user} />
        
        <main className="flex-1 overflow-auto p-6 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Employees</p>
                      <p className="text-2xl font-bold text-blue-600">{quickStats.totalEmployees}</p>
                    </div>
                    <div className="p-2 bg-blue-100 rounded-full">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Attendance</p>
                      <p className="text-2xl font-bold text-green-600">{quickStats.avgAttendance}%</p>
                    </div>
                    <div className="p-2 bg-green-100 rounded-full">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Leaves</p>
                      <p className="text-2xl font-bold text-orange-600">{quickStats.totalLeaves}</p>
                    </div>
                    <div className="p-2 bg-orange-100 rounded-full">
                      <CalendarIcon className="h-5 w-5 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Avg Hours</p>
                      <p className="text-2xl font-bold text-purple-600">{quickStats.avgWorkHours}h</p>
                    </div>
                    <div className="p-2 bg-purple-100 rounded-full">
                      <Clock className="h-5 w-5 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Productivity</p>
                      <p className="text-2xl font-bold text-indigo-600">{quickStats.productivity}%</p>
                    </div>
                    <div className="p-2 bg-indigo-100 rounded-full">
                      <Activity className="h-5 w-5 text-indigo-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Satisfaction</p>
                      <p className="text-2xl font-bold text-pink-600">{quickStats.satisfaction}%</p>
                    </div>
                    <div className="p-2 bg-pink-100 rounded-full">
                      <PieChart className="h-5 w-5 text-pink-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="generate" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="generate">Generate Reports</TabsTrigger>
                <TabsTrigger value="analytics">Analytics Dashboard</TabsTrigger>
                <TabsTrigger value="insights">Insights</TabsTrigger>
              </TabsList>

              {/* Generate Reports */}
              <TabsContent value="generate" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Generate Custom Report
                    </CardTitle>
                    <CardDescription>
                      Create detailed reports for specific time periods and departments
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="space-y-2">
                        <Label>Report Type</Label>
                        <Select value={selectedReport} onValueChange={setSelectedReport}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select report type" />
                          </SelectTrigger>
                          <SelectContent>
                            {reportTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Department</Label>
                        <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Departments</SelectItem>
                            {departments.map((dept) => (
                              <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>From Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {dateFrom ? format(dateFrom, 'PPP') : 'Select start date'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={dateFrom}
                              onSelect={setDateFrom}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <Label>To Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {dateTo ? format(dateTo, 'PPP') : 'Select end date'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={dateTo}
                              onSelect={setDateTo}
                              disabled={(date) => date < (dateFrom || new Date())}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <Button 
                        onClick={generateReport}
                        className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                      >
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Generate Report
                      </Button>
                      <Button variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Download Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Reports */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Reports</CardTitle>
                    <CardDescription>
                      Pre-configured reports for common use cases
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <Button variant="outline" className="h-20 flex flex-col items-center gap-2">
                        <Users className="h-6 w-6" />
                        <span className="text-sm">Monthly Attendance</span>
                      </Button>
                      <Button variant="outline" className="h-20 flex flex-col items-center gap-2">
                        <CalendarIcon className="h-6 w-6" />
                        <span className="text-sm">Leave Summary</span>
                      </Button>
                      <Button variant="outline" className="h-20 flex flex-col items-center gap-2">
                        <Clock className="h-6 w-6" />
                        <span className="text-sm">Timesheet Report</span>
                      </Button>
                      <Button variant="outline" className="h-20 flex flex-col items-center gap-2">
                        <BarChart3 className="h-6 w-6" />
                        <span className="text-sm">Performance Review</span>
                      </Button>
                      <Button variant="outline" className="h-20 flex flex-col items-center gap-2">
                        <FileText className="h-6 w-6" />
                        <span className="text-sm">Payroll Summary</span>
                      </Button>
                      <Button variant="outline" className="h-20 flex flex-col items-center gap-2">
                        <Activity className="h-6 w-6" />
                        <span className="text-sm">Department Analysis</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Analytics Dashboard */}
              <TabsContent value="analytics" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Attendance Trends</CardTitle>
                      <CardDescription>Monthly attendance vs target</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {attendanceData.map((data, index) => (
                          <div key={index} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">{data.month}</span>
                              <span className="text-sm text-gray-600">{data.attendance}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full transition-all duration-300 ${
                                  data.attendance >= data.target ? 'bg-green-600' : 'bg-orange-600'
                                }`}
                                style={{ width: `${data.attendance}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Department Performance</CardTitle>
                      <CardDescription>Key metrics by department</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {departmentStats.map((dept, index) => (
                          <div key={index} className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="font-medium">{dept.name}</h4>
                              <span className="text-sm text-gray-600">{dept.employees} employees</span>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600">Attendance:</span>
                                <span className="font-medium ml-1">{dept.attendance}%</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Leaves:</span>
                                <span className="font-medium ml-1">{dept.leaves}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Productivity:</span>
                                <span className="font-medium ml-1">{dept.productivity}%</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Insights */}
              <TabsContent value="insights" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-green-600">Positive Trends</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                          <div>
                            <p className="font-medium">Attendance Improving</p>
                            <p className="text-sm text-gray-600">+5% increase this month</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                          <div>
                            <p className="font-medium">Productivity Up</p>
                            <p className="text-sm text-gray-600">Engineering team leading</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                          <div>
                            <p className="font-medium">Lower Leave Requests</p>
                            <p className="text-sm text-gray-600">15% decrease from last quarter</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-orange-600">Areas for Improvement</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                          <TrendingDown className="h-5 w-5 text-orange-600" />
                          <div>
                            <p className="font-medium">Late Arrivals</p>
                            <p className="text-sm text-gray-600">Sales team needs attention</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                          <TrendingDown className="h-5 w-5 text-orange-600" />
                          <div>
                            <p className="font-medium">Document Processing</p>
                            <p className="text-sm text-gray-600">Average time increased</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                          <TrendingDown className="h-5 w-5 text-orange-600" />
                          <div>
                            <p className="font-medium">Training Completion</p>
                            <p className="text-sm text-gray-600">Some modules behind schedule</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}