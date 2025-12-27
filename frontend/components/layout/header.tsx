'use client';

import { useState } from 'react';
import { Bell, Search, LogOut, RotateCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  title: string;
  user?: {
    name: string;
    email: string;
  };
  notifications?: number;
  onRefresh?: () => Promise<void> | void;
} 

export function Header({ title, user, notifications = 0, onRefresh }: HeaderProps) {
  const router = useRouter();
  const handleSignOut = () => {
    // Clear session from localStorage
    localStorage.removeItem('userSession');
    router.push('/');
  };

  const [refreshBusy, setRefreshBusy] = useState(false);
  const handleRefresh = async () => {
    if (!onRefresh || refreshBusy) return;
    setRefreshBusy(true);
    try {
      const maybe = onRefresh();
      if (maybe && typeof (maybe as any).then === 'function') {
        await (maybe as any);
      }
    } catch (err) {
      console.error('Refresh failed', err);
    } finally {
      // short cooldown to avoid rapid repeated requests
      setTimeout(() => setRefreshBusy(false), 5000);
    }
  };

  return (
    <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500">Welcome back to your workspace</p>
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search..."
            className="w-64 pl-10"
          />
        </div>

        {/* Notifications */}
        {notifications > 0 && (
          <Button variant="outline" size="sm" className="relative">
            <Bell className="h-4 w-4" />
            <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
              {notifications}
            </Badge>
          </Button>
        )}

        {/* Optional Refresh button (shown when provided) */}
        {typeof onRefresh === 'function' && (
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshBusy} title={refreshBusy ? 'Refreshing...' : 'Refresh'}>
            <RotateCw className={`h-4 w-4 ${refreshBusy ? 'animate-spin' : ''}`} />
          </Button>
        )}

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-3">
              <div className="text-left">
                <p className="text-sm font-medium text-gray-700">{user?.name || 'User'}</p>
                <p className="text-xs text-gray-500">{user?.email || 'Loading...'}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}