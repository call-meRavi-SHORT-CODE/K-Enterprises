'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardDescription,
  CardHeader, CardTitle
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Users, Shield } from 'lucide-react';

// Admin credentials (in production, this should be in environment variables or backend)
const ADMIN_EMAIL = 'ravikrishnaj25@gmail.com';
const ADMIN_PASSWORD = 'admin123';
const DEFAULT_EMPLOYEE_PASSWORD = 'password123'; // Default password for employees

export default function SignIn() {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'employee' | 'admin'>('employee');
  const [error, setError] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const router = useRouter();

  /**
   * Call backend API (`/employees/{email}`) to make sure the employee exists
   * in the Google Sheet before allowing sign-in.
   */
  const verifyEmployeeExists = async (email: string) => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
      const res = await fetch(`${apiBase}/employees/${encodeURIComponent(email)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null; // network / server error – treat as not found
    }
  };

  const handleSignIn = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    setError('');
    
    // Basic validation
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setIsLoading(true);

    try {
      const emailLower = email.toLowerCase().trim();

      // Admin flow
      if (selectedTab === 'admin') {
        if (emailLower !== ADMIN_EMAIL.toLowerCase()) {
          throw new Error('Invalid admin email address.');
        }
        if (password !== ADMIN_PASSWORD) {
          throw new Error('Invalid password.');
        }
      }
      // Employee flow
      else {
        // Verify presence in Employee Sheet via backend
        const empData = await verifyEmployeeExists(emailLower);
        if (!empData) {
          throw new Error('Employee record not found. Please contact HR.');
        }
        
        // Simple password check (using default password for now)
        // In production, this should be handled by the backend
        if (password !== DEFAULT_EMPLOYEE_PASSWORD) {
          throw new Error('Invalid password.');
        }

        // Success → persist & redirect
        const session: any = {
          user: {
            email: emailLower,
            displayName: empData.name || emailLower.split('@')[0]
          },
          role: 'employee',
          employee: empData,
        };
        localStorage.setItem('userSession', JSON.stringify(session));
        router.push('/employee/dashboard');
        return;
      }

      // Admin success → persist & redirect
      const session: any = {
        user: {
          email: emailLower,
          displayName: emailLower.split('@')[0]
        },
        role: 'admin',
      };
      localStorage.setItem('userSession', JSON.stringify(session));
      router.push('/admin/dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* …background elements… */}

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8 animate-slide-up">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg">
              <Building2 className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            EPICAL LAYOUTS
          </h1>
          <p className="text-gray-600 mt-2">HR Management System</p>
        </div>

        <Card className="glass backdrop-blur-xl border-white/30 shadow-2xl animate-slide-up">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
            <CardDescription className="text-gray-600">
              Sign in to access your workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              defaultValue="employee"
              onValueChange={(val) => {
                setSelectedTab(val as 'employee' | 'admin');
                setError('');
                setEmail('');
                setPassword('');
              }}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="employee" className="flex items-center gap-2">
                  <Users className="h-4 w-4" /> Employee
                </TabsTrigger>
                <TabsTrigger value="admin" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Admin
                </TabsTrigger>
              </TabsList>

              <TabsContent value="employee" className="space-y-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="employee-email">Email</Label>
                    <Input
                      id="employee-email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employee-password">Password</Label>
                    <Input
                      id="employee-password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2 text-lg"
                  >
                    {isLoading
                      ? (<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Signing in…</>)
                      : 'Sign In'
                    }
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="admin" className="space-y-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">Email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="Enter admin email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-password">Password</Label>
                    <Input
                      id="admin-password"
                      type="password"
                      placeholder="Enter admin password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-pink-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2 text-lg"
                  >
                    {isLoading
                      ? (<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Signing in…</>)
                      : 'Sign In'
                    }
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {/* error message */}
            {error && (
              <p className="mt-4 text-center text-red-600 text-sm">{error}</p>
            )}

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                {selectedTab === 'admin' 
                  ? 'Admin Login' 
                  : 'Employee Login - Use your registered email'}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-sm text-gray-500 animate-fade-in">
          <p>© 2025 EPICAL LAYOUTS PVT LTD. All rights reserved.</p>
          <p className="mt-1">Secure • Professional • Efficient</p>
        </div>
      </div>
    </div>
  );
}
