'use client';

import { useEffect, useState, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Camera } from 'lucide-react';

export default function EmployeeProfilePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>({
    name: '',
    email: '',
    phone: '',
    designation: '',
    department: '',
    joiningDate: '',
    photo: '',
  });
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [user, setUser] = useState<{name:string; email:string}>({name:'', email:''});

  useEffect(() => {
    const loadProfileData = async () => {
      if (typeof window === 'undefined') return;
      
      const session = localStorage.getItem('userSession');
      if (!session) {
        setIsLoading(false);
        return;
      }

      try {
        const parsed = JSON.parse(session);
        if (!parsed.employee) {
          setIsLoading(false);
          return;
        }

        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
        const photoUrl = `${apiBase}/employees/${encodeURIComponent(parsed.employee.email)}/photo?${Date.now()}`;
        
        // Set the basic data immediately
        const userData = {
          name: parsed.employee.name || parsed.user.displayName,
          email: parsed.employee.email,
          phone: parsed.employee.contact || '',
          designation: parsed.employee.position || '',
          department: parsed.employee.department || '',
          joiningDate: parsed.employee.joining_date || '',
          photo: photoUrl,
        };
        
        setProfileData(userData);
        setUser({ 
          name: userData.name, 
          email: userData.email 
        });

        // Load image in background
        const img = new Image();
        img.src = photoUrl;
        img.onload = () => setIsLoading(false);
        img.onerror = () => setIsLoading(false);

        // Set a maximum loading time
        setTimeout(() => setIsLoading(false), 2000);
      } catch (error) {
        console.error('Error loading profile:', error);
        setIsLoading(false);
      }
    };
    
    loadProfileData();
  }, []);

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profileData?.email) return;
    
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
    setIsUploadingPhoto(true);
    
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await fetch(`${apiBase}/employees/${encodeURIComponent(profileData.email)}/photo`, {
        method: 'PUT',
        body: fd,
      });
      
      if (!res.ok) throw new Error('Upload failed');
      
      const newPhotoUrl = `${apiBase}/employees/${encodeURIComponent(profileData.email)}/photo?${Date.now()}`;
      setProfileData(prev => ({ ...prev, photo: newPhotoUrl }));
      toast({ title: 'Profile photo updated', variant: 'success', duration: 2000 });
    } catch (err) {
      console.error(err);
      toast({ title: 'Failed to update photo', variant: 'destructive', duration: 2000 });
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="My Profile" user={user} />
        
        <main className="flex-1 overflow-auto p-6 custom-scrollbar">
          <div className="max-w-6xl mx-auto space-y-6">
            <Card className="shadow-lg border bg-white overflow-hidden">
              <CardHeader className="border-b bg-gray-50/50">
                <CardTitle className="text-2xl font-bold text-gray-900">
                  Profile Information
                </CardTitle>
              </CardHeader>

              <CardContent className="pt-6 pb-8">
                <div className="grid lg:grid-cols-4 md:grid-cols-3 gap-10 items-start">
                  {/* Avatar + basic meta */}
                  <div className="flex flex-col items-center text-center md:col-span-1">
                    <div className="relative">
                      {isLoading ? (
                        <Skeleton className="h-40 w-40 rounded-full" />
                      ) : (
                        <Avatar className="h-40 w-40 border-4 border-white shadow-lg">
                          <AvatarImage src={profileData?.photo} className="object-cover object-center" />
                          {isUploadingPhoto && (
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-full">
                              <div className="w-6 h-6 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                            </div>
                          )}
                          <AvatarFallback className="text-4xl bg-gray-200 text-gray-600">
                            {profileData?.name?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <Button 
                        size="icon" 
                        disabled={isUploadingPhoto || isLoading} 
                        onClick={handleCameraClick} 
                        className="absolute bottom-2 right-2 rounded-full h-10 w-10 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={handlePhotoSelected}
                      />
                    </div>
                    <div className="mt-4 space-y-1">
                      {isLoading ? (
                        <>
                          <Skeleton className="h-6 w-32 mx-auto" />
                          <Skeleton className="h-4 w-24 mx-auto" />
                          <Skeleton className="h-4 w-20 mx-auto" />
                        </>
                      ) : (
                        <>
                          <h2 className="text-xl font-semibold">{profileData?.name}</h2>
                          <p className="text-sm text-gray-600">{profileData?.designation}</p>
                          <p className="text-sm text-gray-500">{profileData?.department}</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Detail grid */}
                  <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6">
                    {[
                      { label: "Full Name", value: profileData?.name },
                      { label: "Email Address", value: profileData?.email },
                      { label: "Contact Number", value: profileData?.phone || '—' },
                      { label: "Designation", value: profileData?.designation },
                      { label: "Department", value: profileData?.department },
                      { label: "Joining Date", value: profileData?.joiningDate }
                    ].map((field) => (
                      <div key={field.label}>
                        <p className="text-sm text-gray-500 mb-1">{field.label}</p>
                        {isLoading ? (
                          <Skeleton className="h-6 w-32" />
                        ) : (
                          <p className="font-medium text-gray-900">
                            {field.value}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}