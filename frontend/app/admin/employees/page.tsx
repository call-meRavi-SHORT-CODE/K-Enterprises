'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Users, 
  Search, 
  Filter, 
  Plus,
  Edit,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Building2,
  UserCheck,
  UserX
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

export default function AdminEmployeesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedStatus, setSelectedStatus]       = useState('all');

  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [isDialogOpen, setIsDialogOpen]           = useState(false);
  const [dialogMode, setDialogMode]               = useState<'add' | 'edit'>('add');
  const [editingEmail, setEditingEmail]           = useState<string | null>(null);
  const [isSaving, setIsSaving]                   = useState(false);
  const [deletingTarget, setDeletingTarget]       = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    position: '',
    department: '',
    contact: '',
    joining_date: '',
    profile_photo: null as File | null,
  });

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

  const fetchEmployees = async () => {
    try {
      const res = await fetch(`${apiBase}/employees/`);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      }
      setLoadingEmployees(false);
    } catch (err) {
      console.error('Failed to fetch employees', err);
      setLoadingEmployees(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const departments = Array.from(new Set(employees.map((e:any) => e.department).filter(Boolean)));

  // Apply search / filter logic once so it can be reused in JSX
  const filteredEmployees = employees.filter((employee: any) => {
    const designation = (employee.position || employee.designation || '').toLowerCase();
    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         designation.includes(searchTerm.toLowerCase());
    const matchesDepartment = selectedDepartment === 'all' || employee.department === selectedDepartment;
    const matchesStatus = selectedStatus === 'all' || (employee.status || 'active') === selectedStatus;

    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target as HTMLInputElement;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData((prev) => ({ ...prev, profile_photo: file }));
  };

  const handleSubmit = async () => {
    try {
      setIsSaving(true);
      const pendingToast = toast({
        title: dialogMode === 'add' ? 'Adding employee…' : 'Saving changes…',
        duration: 60000,
      });
      let ok = false;

      if (dialogMode === 'add') {
        const fd = new FormData();
        Object.entries(formData).forEach(([key, val]) => {
          if (key === 'profile_photo') {
            if (val) fd.append('profile_photo', val as File);
          } else {
            fd.append(key, val as string);
          }
        });

        const res = await fetch(`${apiBase}/employees/`, {
          method: 'POST',
          body: fd,
        });
        ok = res.ok;
      } else if (dialogMode === 'edit' && editingEmail) {
        const payload = { ...formData } as any;
        delete payload.profile_photo; // photo handled separately
        // joining_date is immutable on backend, so omit it for edit
        delete payload.joining_date;

        const res = await fetch(`${apiBase}/employees/${encodeURIComponent(editingEmail)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        ok = res.ok;
      }

      if (!ok) throw new Error('Failed to save employee');

      pendingToast.dismiss();
      toast({
        title: dialogMode === 'add' ? 'Employee added' : 'Employee updated',
        variant: 'success',
        duration: 3000,
      });
      await fetchEmployees();
      setIsDialogOpen(false);
      setFormData({
        email: '',
        name: '',
        position: '',
        department: '',
        contact: '',
        joining_date: '',
        profile_photo: null,
      });
      setEditingEmail(null);
      setIsSaving(false);
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Failed to save employee',
        variant: 'destructive',
        duration: 3000,
      });
      setIsSaving(false);
    }
  };

  const openAddDialog = () => {
    setDialogMode('add');
    setFormData({
      email: '',
      name: '',
      position: '',
      department: '',
      contact: '',
      joining_date: '',
      profile_photo: null,
    });
    setEditingEmail(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (emp: any) => {
    setDialogMode('edit');
    setEditingEmail(emp.email);
    setFormData({
      email: emp.email,
      name: emp.name,
      position: emp.position || emp.designation || '',
      department: emp.department || '',
      contact: emp.contact || emp.phone || '',
      joining_date: emp.joining_date || emp.joiningDate || '',
      profile_photo: null,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (email: string) => {
    try {
      setDeletingTarget(email);
      const pendingToast = toast({ title: 'Deleting employee…', duration: 60000 });
      const res = await fetch(`${apiBase}/employees/${encodeURIComponent(email)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      await fetchEmployees();
      pendingToast.dismiss();
      toast({ title: 'Employee deleted', variant: 'success', duration: 3000 });
      setDeletingTarget(null);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to delete employee', variant: 'destructive', duration: 3000 });
      setDeletingTarget(null);
    }
  };

  const user = {
    name: 'Admin User',
    email: 'admin@epicallayouts.com',
  };

  const getStatusColor = (status: string) => {
    return status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isAdmin={true} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Employee Management" user={user} />
        
        <main className="flex-1 overflow-auto p-6 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Employees</p>
                      <p className="text-3xl font-bold text-blue-600">{employees.length}</p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-full">
                      <Users className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active</p>
                      <p className="text-3xl font-bold text-green-600">
                        {employees.filter(emp => emp.status === 'active').length}
                      </p>
                    </div>
                    <div className="p-3 bg-green-100 rounded-full">
                      <UserCheck className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Inactive</p>
                      <p className="text-3xl font-bold text-red-600">
                        {employees.filter(emp => emp.status === 'inactive').length}
                      </p>
                    </div>
                    <div className="p-3 bg-red-100 rounded-full">
                      <UserX className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Departments</p>
                      <p className="text-3xl font-bold text-purple-600">{departments.length}</p>
                    </div>
                    <div className="p-3 bg-purple-100 rounded-full">
                      <Building2 className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Employee Directory
                    </CardTitle>
                    <CardDescription>
                      Manage employee information and access
                    </CardDescription>
                  </div>
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={openAddDialog} className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Employee
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-xl">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          {dialogMode === 'add' ? (
                            <><Plus className="h-5 w-5" /> Add Employee</>
                          ) : (
                            <><Edit className="h-5 w-5" /> Edit Employee</>
                          )}
                        </DialogTitle>
                        <DialogDescription>
                          {dialogMode === 'add' ? 'Fill in the details below to add a new employee.' : 'Modify the fields and save to update the employee.'}
                        </DialogDescription>
                      </DialogHeader>

                      <div className="grid gap-4 py-2 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="name" className="text-right">Name</Label>
                          <Input id="name" name="name" value={formData.name} onChange={handleInputChange} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="email" className="text-right">Email</Label>
                          <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="position" className="text-right">Position</Label>
                          <Input id="position" name="position" value={formData.position} onChange={handleInputChange} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="department" className="text-right">Department</Label>
                          <Input id="department" name="department" value={formData.department} onChange={handleInputChange} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="contact" className="text-right">Contact</Label>
                          <Input id="contact" name="contact" value={formData.contact} onChange={handleInputChange} className="col-span-3" />
                        </div>
                        {dialogMode === 'add' && (
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="joining_date" className="text-right">Joining Date</Label>
                            <Input id="joining_date" name="joining_date" type="date" value={formData.joining_date} onChange={handleInputChange} className="col-span-3" />
                          </div>
                        )}
                        {dialogMode === 'add' && (
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="profile_photo" className="text-right">Profile Photo</Label>
                            <Input id="profile_photo" name="profile_photo" type="file" accept="image/*" onChange={handleFileChange} className="col-span-3" />
                          </div>
                        )}
                      </div>

                      <DialogFooter>
                        <Button onClick={handleSubmit} disabled={isSaving} className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 flex items-center gap-2">
                          {isSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                          {dialogMode === 'add' ? 'Submit' : 'Save'}
                        </Button>
                        <DialogClose asChild>
                          <Button variant="outline">Cancel</Button>
                        </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
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
                        placeholder="Search by name, email, or designation..."
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
                        {departments.map((dept) => (
                          <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Employee List */}
                {loadingEmployees ? (
                  <div className="text-center py-16 text-gray-400">Loading employees…</div>
                ) : (
                <div className="space-y-4">
                  {filteredEmployees.map((employee, idx) => (
                    <div key={employee.id ?? employee.email ?? idx} className="p-4 border rounded-lg hover:shadow-md transition-shadow duration-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={employee.avatar} />
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                              {employee.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-lg">{employee.name}</h4>
                              <Badge className={getStatusColor(employee.status)}>
                                {employee.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600">{employee.position || employee.designation}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <div className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {employee.email}
                              </div>
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {employee.contact || employee.phone}
                              </div>
                              <div className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {employee.department}
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Joined {employee.joining_date || employee.joiningDate}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(employee)}>
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Employee</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete {employee.name}? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(employee.email)} disabled={deletingTarget===employee.email} className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2">
                                  {deletingTarget===employee.email && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                )}

                {filteredEmployees.length === 0 && (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No employees found matching your criteria</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}