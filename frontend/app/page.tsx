'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardDescription,
  CardHeader, CardTitle
} from '@/components/ui/card';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';


// Admin credentials (in production, this should be in environment variables or backend)
const ADMIN_EMAIL = 'admin@kokilaenterprises.com';
const ADMIN_PASSWORD = 'admin123';


export default function SignIn() {
  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();



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

      // Admin-only flow
      if (emailLower !== ADMIN_EMAIL.toLowerCase()) {
        throw new Error('Invalid admin email address.');
      }
      if (password !== ADMIN_PASSWORD) {
        throw new Error('Invalid password.');
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
          {/* Enhanced Logo Container */}
          <div className="flex justify-center mb-8">
  <div className="relative group">
    
    {/* Outer green glow */}
    <div className="absolute inset-0 rounded-full bg-green-400/40 blur-xl group-hover:blur-2xl transition-all duration-300"></div>

      
      {/* Inner glass circle */}
      <div className="rounded-full bg-white/50 backdrop-blur-md p-5 flex items-center justify-center">
        
        {/* Logo image */}
        <img
          src="/favicon.png"
          alt="Kokila Enterprises Logo"
          className="h-24 w-24 object-contain drop-shadow-md transition-transform duration-300 group-hover:scale-110"
        />
      </div>
    
  </div>
</div>








          
          {/* Company Name with enhanced styling */}
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold text-gray-800 drop-shadow-sm">
              KOKILA ENTERPRISES
            </h1>
            <div className="flex items-center justify-center gap-2">
              <div className="h-px w-12 bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
              <p className="text-gray-600 font-medium tracking-wide">Inventory Management</p>
              <div className="h-px w-12 bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
            </div>
          </div>
        </div>

        <Card className="glass backdrop-blur-xl border-white/30 shadow-2xl animate-slide-up">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
            <CardDescription className="text-gray-600">
              Sign in to access your workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter admin password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
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

            {/* error message */}
            {error && (
              <p className="mt-4 text-center text-red-600 text-sm">{error}</p>
            )}

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">Admin Login</p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-sm text-gray-500 animate-fade-in">
          <p>© 2024 KOKILA ENTERPRISES All rights reserved.</p>
          <p className="mt-1">Freshness In Everycup</p>
        </div>
      </div>
    </div>
  );
}
