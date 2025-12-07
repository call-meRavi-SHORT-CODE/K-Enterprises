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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Clock, 
  Calendar as CalendarIcon,
  Search,
  Filter,
  Download,
  UserCheck,
  UserX,
  AlertCircle,
  TrendingUp,
  Building2
} from 'lucide-react';
import { format } from 'date-fns';

export default function AdminAttendancePage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');

  const user = {
    name: 'Admin User',
    email: 'admin@epicallayouts.com'
  };

  const attendanceData = [
    {
      id: 1,
      name: 'Ravikrishna J',
      department: 'Engineering',
      checkIn: '08:37 AM',
      checkOut: '06:15 PM',
      totalHours: '9:38',
      status: 'present',
      breakTime: '45 min'
    },
    {
      id: 2,
      name: 'Priya Sharma',
      department: 'Design',
      checkIn: '09:15 AM',
      checkOut: '06:30 PM',
      totalHours: '9:15',
      status: 'present',
      breakTime: '30 min'
    },
    {
      id: 3,
      name: 'Arjun Patel',
      department: 'Marketing',
      checkIn: '09:00 AM',
      checkOut: '06:00 PM',
      totalHours: '9:00',
      status: 'present',
      breakTime: '60 min'
    },
    {
      id: 4,
      name: 'Kavita Reddy',
      department: 'HR',
      checkIn: '08:45 AM',
      checkOut: '05:45 PM',
      totalHours: '9:00',
      status: 'present',
      breakTime: '45 min'
    },
    {
      id: 5,
      name: 'Raj Kumar',
      department: 'Sales',
      checkIn: '-',
      checkOut: '-',
      totalHours: '-',
      status: 'absent',
      breakTime: '-'
    }
  ];

  const attendanceStats = {
    totalEmployees: 124,
    present: 98,
    absent: 12,
    late: 14,
    avgWorkHours: 8.5,
    attendanceRate: 79
  };

  const departmentStats = [
    { name: 'Engineering', present: 38, total: 45, percentage: 84 },
    { name: 'Design', present: 20, total: 22, percentage: 91 },
    { name: 'Marketing', present: 16, total: 18, percentage: 89 },
    { name: 'HR', present: 10, total: 12, percentage: 83 },
    { name: 'Sales', present: 24, total: 27, percentage: 89 }
  ];

  const filteredAttendance = attendanceData.filter(record => {
    const matchesSearch = record.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = selectedDepartment === 'all' || record.department === selectedDepartment;
    return matchesSearch && matchesDepartment;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-800';
      case 'absent': return 'bg-red-100 text-red-800';
      case 'late': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <UserCheck className="h-4 w-4" />;
      case 'absent': return <UserX className="h-4 w-4" />;
      case 'late': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isAdmin={true} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Attendance Management" user={user} />
        
        <main className="flex-1 overflow-auto p-6 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Present Today</p>
                      <p className="text-3xl font-bold text-green-600">{attendanceStats.present}</p>
                    </div>
                    <div className="p-3 bg-green-100 rounded-full">
                      <UserCheck className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-sm text-gray-600">
                      {Math.round((attendanceStats.present / attendanceStats.totalEmployees) * 100)}% attendance
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Absent Today</p>
                      <p className="text-3xl font-bold text-red-600">{attendanceStats.absent}</p>
                    </div>
                    <div className="p-3 bg-red-100 rounded-full">
                      <UserX className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-sm text-gray-600">Including leaves</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Late Arrivals</p>
                      <p className="text-3xl font-bold text-yellow-600">{attendanceStats.late}</p>
                    </div>
                    <div className="p-3 bg-yellow-100 rounded-full">
                      <AlertCircle className="h-6 w-6 text-yellow-600" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-sm text-gray-600">After 9:30 AM</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Avg. Work Hours</p>
                      <p className="text-3xl font-bold text-blue-600">{attendanceStats.avgWorkHours}h</p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-full">
                      <Clock className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center text-sm">
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-green-600">+0.3h from yesterday</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="today" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="today">Today's Attendance</TabsTrigger>
                <TabsTrigger value="department">Department View</TabsTrigger>
                <TabsTrigger value="reports">Reports</TabsTrigger>
              </TabsList>

              {/* Today's Attendance */}
              <TabsContent value="today" className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Clock className="h-5 w-5" />
                          Today's Attendance
                        </CardTitle>
                        <CardDescription>
                          {format(new Date(), 'EEEE, MMMM do, yyyy')}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline">
                              <CalendarIcon className="h-4 w-4 mr-2" />
                              {format(selectedDate, 'MMM dd, yyyy')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={selectedDate}
                              onSelect={setSelectedDate}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <Button>
                          <Download className="h-4 w-4 mr-2" />
                          Export
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-4 mb-6">
                      <div className="flex-1">
                        <Label htmlFor="search">Search Employees</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            id="search"
                            placeholder="Search by name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="department">Department</Label>
                        <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                          <SelectTrigger className="w-48">
                            <Filter className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="All Departments" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Departments</SelectItem>
                            <SelectItem value="Engineering">Engineering</SelectItem>
                            <SelectItem value="Design">Design</SelectItem>
                            <SelectItem value="Marketing">Marketing</SelectItem>
                            <SelectItem value="HR">HR</SelectItem>
                            <SelectItem value="Sales">Sales</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Attendance List */}
                    <div className="space-y-4">
                      {filteredAttendance.map((record) => (
                        <div key={record.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow duration-200">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{record.name}</h4>
                                <Badge className={getStatusColor(record.status)}>
                                  <div className="flex items-center gap-1">
                                    {getStatusIcon(record.status)}
                                    {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                                  </div>
                                </Badge>
                                <Badge variant="outline">{record.department}</Badge>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                                <div>
                                  <span className="font-medium">Check In: </span>
                                  {record.checkIn}
                                </div>
                                <div>
                                  <span className="font-medium">Check Out: </span>
                                  {record.checkOut}
                                </div>
                                <div>
                                  <span className="font-medium">Total Hours: </span>
                                  {record.totalHours}
                                </div>
                                <div>
                                  <span className="font-medium">Break Time: </span>
                                  {record.breakTime}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Department View */}
              <TabsContent value="department" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Department-wise Attendance
                    </CardTitle>
                    <CardDescription>
                      Attendance breakdown by department
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {departmentStats.map((dept, index) => (
                        <div key={index} className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-lg">{dept.name}</h4>
                            <div className="text-right">
                              <p className="font-medium">{dept.present}/{dept.total}</p>
                              <p className="text-sm text-gray-600">{dept.percentage}% present</p>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div 
                              className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-300" 
                              style={{ width: `${dept.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Reports */}
              <TabsContent value="reports" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Weekly Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                          <span>Average Attendance</span>
                          <span className="font-semibold text-blue-600">87%</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                          <span>On-time Arrivals</span>
                          <span className="font-semibold text-green-600">94%</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                          <span>Late Arrivals</span>
                          <span className="font-semibold text-orange-600">6%</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                          <span>Avg. Work Hours</span>
                          <span className="font-semibold text-purple-600">8.5h</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Monthly Trends</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center p-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                        <TrendingUp className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                        <p className="text-lg font-semibold text-blue-600">Attendance Improving</p>
                        <p className="text-sm text-gray-600">+5% compared to last month</p>
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