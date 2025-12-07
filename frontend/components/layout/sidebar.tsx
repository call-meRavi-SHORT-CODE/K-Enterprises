'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  Home, 
  User, 
  Clock, 
  Calendar, 
  FileText, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Users,
  BarChart3,
  Shield,
  Building2,
  FolderOpen,
  Bell
} from 'lucide-react';

interface SidebarProps {
  isAdmin?: boolean;
}

export function Sidebar({ isAdmin = false }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const employeeNavItems = [
    { href: '/employee/dashboard', icon: Home, label: 'Dashboard' },
    { href: '/employee/profile', icon: User, label: 'Profile' },
    { href: '/employee/timesheet', icon: Clock, label: 'Timesheet' },
    { href: '/employee/leave', icon: Calendar, label: 'Leave Management' },
    { href: '/employee/documents', icon: FileText, label: 'Documents' },
    { href: '/employee/payslips', icon: FolderOpen, label: 'Payslips' },
  ];

  const adminNavItems = [
    { href: '/admin/dashboard', icon: Home, label: 'Dashboard' },
    { href: '/admin/employees', icon: Users, label: 'Employees' },
    { href: '/admin/attendance', icon: Clock, label: 'Attendance' },
    { href: '/admin/leave', icon: Calendar, label: 'Leave Requests' },
    { href: '/admin/documents', icon: FileText, label: 'Documents' },
    { href: '/admin/reports', icon: BarChart3, label: 'Reports' },
  ];

  const navItems = isAdmin ? adminNavItems : employeeNavItems;

  return (
    <div className={cn(
      "h-screen bg-white border-r flex flex-col transition-all duration-300 shadow-lg",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg">EPICAL</h2>
                <p className="text-xs text-gray-500">LAYOUTS</p>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="p-2"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Role Badge */}
      <div className="p-4">
        {!collapsed && (
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium",
            isAdmin 
              ? "bg-purple-100 text-purple-800" 
              : "bg-blue-100 text-blue-800"
          )}>
            <Shield className="h-4 w-4" />
            {isAdmin ? 'Administrator' : 'Employee'}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div className={cn(
                collapsed ? "flex items-center justify-center px-3 py-3 rounded-lg transition-all duration-200 group" : "flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group",
                isActive 
                  ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md" 
                  : "text-gray-700 hover:bg-gray-100"
              )}>
                <item.icon className={cn(
                  collapsed ? "h-10 w-10" : "h-5 w-5",
                  "transition-transform duration-200",
                  isActive ? "text-white" : "text-gray-500 group-hover:text-gray-700"
                )} />
                {!collapsed && (
                  <span className="font-medium">{item.label}</span>
                )}
                {!collapsed && isActive && (
                  <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t space-y-2">
        <Button 
          variant="ghost" 
          className={cn(
            "w-full justify-start gap-3 text-gray-700 hover:text-red-600 hover:bg-red-50",
            collapsed && "px-2"
          )}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span>Sign Out</span>}
        </Button>
      </div>
    </div>
  );
}