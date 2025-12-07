'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
    email: 'admin@epicallayouts.com'
  };

  const stats = {
    totalEmployees: 124,
    presentToday: 98,
    onLeave: 12,
    pendingApprovals: 8,
    avgWorkHours: 8.2,
    productivity: 92
  };

  const leaveRequests = [
    {
      id: 1,
      employee: 'Ravikrishna J',
      type: 'Casual Leave',
      dates: 'Feb 15-17, 2025',
      days: 3,
      reason: 'Family wedding',
      applied: '2 days ago',
      status: 'pending'
    },
    {
      id: 2,
      employee: 'Priya Sharma',
      type: 'Sick Leave',
      dates: 'Jan 28-29, 2025',
      days: 2,
      reason: 'Fever and flu symptoms',
      applied: '1 day ago',
      status: 'pending'
    },
    {
      id: 3,
      employee: 'Arjun Patel',
      type: 'Earned Leave',
      dates: 'Mar 5-12, 2025',
      days: 8,
      reason: 'Vacation with family',
      applied: '3 days ago',
      status: 'pending'
    }
  ];

  const recentActivities = [
    { action: 'New employee onboarded', user: 'Kavita Reddy', time: '2 hours ago', type: 'success' },
    { action: 'Leave approved', user: 'Raj Kumar', time: '4 hours ago', type: 'info' },
    { action: 'Timesheet submitted', user: 'Anita Singh', time: '6 hours ago', type: 'info' },
    { action: 'Document uploaded', user: 'Vikram Mehta', time: '8 hours ago', type: 'success' },
  ];

  const departmentStats = [
    { name: 'Engineering', employees: 45, present: 38, percentage: 84 },
    { name: 'Design', employees: 22, present: 20, percentage: 91 },
    { name: 'Marketing', employees: 18, present: 16, percentage: 89 },
    { name: 'HR', employees: 12, present: 10, percentage: 83 },
    { name: 'Sales', employees: 27, present: 24, percentage: 89 }
  ];

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
                  <p className="text-sm text-purple-100">EPICAL LAYOUTS</p>
                  <p className="text-xl font-semibold">PVT LTD</p>
                </div>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Employees</p>
                      <p className="text-3xl font-bold text-blue-600">{stats.totalEmployees}</p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-full">
                      <Users className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center text-sm">
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-green-600">+3 this month</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Present Today</p>
                      <p className="text-3xl font-bold text-green-600">{stats.presentToday}</p>
                    </div>
                    <div className="p-3 bg-green-100 rounded-full">
                      <UserCheck className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <Progress value={(stats.presentToday / stats.totalEmployees) * 100} className="h-2" />
                    <p className="text-sm text-gray-500 mt-1">
                      {Math.round((stats.presentToday / stats.totalEmployees) * 100)}% attendance
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">On Leave</p>
                      <p className="text-3xl font-bold text-orange-600">{stats.onLeave}</p>
                    </div>
                    <div className="p-3 bg-orange-100 rounded-full">
                      <Calendar className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center text-sm">
                    <span className="text-gray-600">Approved leaves today</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Pending Approvals</p>
                      <p className="text-3xl font-bold text-red-600">{stats.pendingApprovals}</p>
                    </div>
                    <div className="p-3 bg-red-100 rounded-full">
                      <AlertCircle className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center text-sm">
                    <span className="text-red-600">Requires attention</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pending Leave Requests */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Pending Leave Requests
                  </CardTitle>
                  <CardDescription>Review and approve employee leave applications</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {leaveRequests.map((request) => (
                      <div key={request.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow duration-200">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{request.employee}</h4>
                              <Badge variant="outline">{request.type}</Badge>
                            </div>
                            <p className="text-sm text-gray-600">{request.dates} ({request.days} days)</p>
                            <p className="text-xs text-gray-500">{request.reason}</p>
                            <p className="text-xs text-gray-400">Applied {request.applied}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" className="bg-green-600 hover:bg-green-700">
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                              Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" className="w-full mt-4">
                    View All Requests
                  </Button>
                </CardContent>
              </Card>

              {/* Department Attendance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Department Attendance
                  </CardTitle>
                  <CardDescription>Today's attendance by department</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {departmentStats.map((dept, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{dept.name}</span>
                          <span className="text-sm text-gray-600">
                            {dept.present}/{dept.employees} ({dept.percentage}%)
                          </span>
                        </div>
                        <Progress value={dept.percentage} className="h-2" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activities */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Recent Activities
                  </CardTitle>
                  <CardDescription>Latest system activities and updates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentActivities.map((activity, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className={`p-1 rounded-full ${activity.type === 'success' ? 'bg-green-100' : 'bg-blue-100'}`}>
                          <div className={`w-2 h-2 rounded-full ${activity.type === 'success' ? 'bg-green-600' : 'bg-blue-600'}`} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{activity.action}</p>
                          <p className="text-xs text-gray-500">by {activity.user}</p>
                          <p className="text-xs text-gray-400">{activity.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Performance Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Performance Overview
                  </CardTitle>
                  <CardDescription>Organization-wide metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <p className="text-2xl font-bold text-blue-600">{stats.avgWorkHours}h</p>
                        <p className="text-sm text-gray-600">Avg. Work Hours</p>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <p className="text-2xl font-bold text-green-600">{stats.productivity}%</p>
                        <p className="text-sm text-gray-600">Productivity</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">On-time Attendance</span>
                        <span className="text-sm text-gray-600">94%</span>
                      </div>
                      <Progress value={94} className="h-2" />
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Leave Utilization</span>
                        <span className="text-sm text-gray-600">67%</span>
                      </div>
                      <Progress value={67} className="h-2" />
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Employee Satisfaction</span>
                        <span className="text-sm text-gray-600">88%</span>
                      </div>
                      <Progress value={88} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Frequently used administrative functions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button variant="outline" className="h-20 flex flex-col items-center gap-2">
                    <Users className="h-6 w-6" />
                    <span className="text-sm">Add Employee</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col items-center gap-2">
                    <Calendar className="h-6 w-6" />
                    <span className="text-sm">Manage Holidays</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col items-center gap-2">
                    <FileText className="h-6 w-6" />
                    <span className="text-sm">Generate Reports</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col items-center gap-2">
                    <BarChart3 className="h-6 w-6" />
                    <span className="text-sm">View Analytics</span>
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