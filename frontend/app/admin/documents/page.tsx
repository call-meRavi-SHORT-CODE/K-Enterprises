'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  Search,
  Filter,
  Download,
  Upload,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export default function AdminDocumentsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedRequestRow, setSelectedRequestRow] = useState<number|null>(null);
  const fileInputRef = useRef<HTMLInputElement|null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUploadClick = (row:number) => {
    setSelectedRequestRow(row);
    fileInputRef.current?.click();
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0 || selectedRequestRow===null) return;
    const file = files[0];
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
    const form = new FormData();
    form.append('file', file);
    const pendingToast = toast({title:'Uploading…', duration:60000});
    try {
      setUploading(true);
      const res = await fetch(`${apiBase}/documents/${selectedRequestRow}/file`,{
        method:'POST',
        body:form
      });
      if(res.ok){
        // Optimistically update UI
        setDocumentRequests(prev=>prev.map(r=>r.row===selectedRequestRow?{...r,status:'completed',completedDate:new Date().toISOString().split('T')[0]}:r));
        pendingToast.dismiss();
        toast({title:'Document uploaded', variant:'success', duration:3000});
        // Optionally re-fetch to sync
        setSelectedRequestRow(null);
        setLoadingRequests(true);
        await fetchData();
      }else{
        pendingToast.dismiss();
        toast({title:'Upload failed', variant:'destructive', duration:4000});
      }
    }catch(err){console.error(err); toast({title:'Network error', variant:'destructive'});}finally{
      e.target.value='';
      setUploading(false);
    }
  };

  const handleExport = () => {
    // Prepare data for export
    const exportData = filteredRequests.map(request => ({
      'Employee Name': request.employee,
      'Department': request.department,
      'Document Type': request.type,
      'Purpose': request.purpose,
      'Requested Date': request.requestDate,
      'Status': request.status.charAt(0).toUpperCase() + request.status.slice(1),
      'Expected Date': request.expectedDate || 'N/A',
      'Completed Date': request.completedDate || 'N/A'
    }));

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Document Requests');

    // Generate file name with current date
    const fileName = `Document_Requests_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;

    // Save file
    XLSX.writeFile(wb, fileName);
  };

  const user = {
    name: 'Admin User',
    email: 'admin@epicallayouts.com'
  };

  type DocReqBackend = {
    row: number;
    email: string;
    document_type: string;
    reason: string;
    status: string;
    timestamp: string;
  };

  type DocReqUI = {
    id: number;
    row: number;
    employee: string;
    department: string;
    type: string;
    purpose: string;
    requestDate: string;
    status: string;
    expectedDate?: string;
    completedDate?: string;
  };

  const [documentRequests, setDocumentRequests] = useState<DocReqUI[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  const [documentStats, setDocumentStats] = useState({
    totalRequests: 0,
    pending: 0,
    completed: 0,
    inProgress: 0
  });

  const fetchData = async () => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
    try {
      setLoadingRequests(true);
      setError(null);
      const [reqRes, empRes] = await Promise.all([
        fetch(`${apiBase}/documents/`),
        fetch(`${apiBase}/employees/`),
      ]);

      if (!reqRes.ok || !empRes.ok) {
        throw new Error('Failed to fetch data from server');
      }

      const reqs: DocReqBackend[] = await reqRes.json();
      const employees: any[] = await empRes.json();

      const mapped: DocReqUI[] = reqs.map((r, idx) => {
        const emp = employees.find((e) => e.email.toLowerCase() === r.email.toLowerCase());
        return {
          id: idx + 1,
          row: r.row,
          employee: emp ? emp.name : r.email,
          department: emp ? emp.department : '',
          type: r.document_type,
          purpose: r.reason || '',
          requestDate: r.timestamp || '',
          status: r.status.toLowerCase(),
        };
      });

      setDocumentRequests(mapped);

      // Stats
      const total = mapped.length;
      const pending = mapped.filter((d) => d.status === 'pending').length;
      const completed = mapped.filter((d) => d.status === 'completed').length;
      const inProgress = mapped.filter((d) => d.status.includes('progress')).length;

      setDocumentStats({
        totalRequests: total,
        pending,
        completed,
        inProgress
      });
    } catch (err) {
      console.error(err);
      setError('Failed to load document requests. Please try again later.');
      setDocumentRequests([]);
      setDocumentStats({
        totalRequests: 0,
        pending: 0,
        completed: 0,
        inProgress: 0
      });
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredRequests = documentRequests.filter(request => {
    const matchesSearch = request.employee.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || request.status === selectedStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'in_progress': return <Clock className="h-4 w-4" />;
      default: return <XCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isAdmin={true} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Document Management" user={user} />
        
        <main className="flex-1 overflow-auto p-6 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Requests</p>
                      <p className="text-3xl font-bold text-blue-600">{documentStats.totalRequests}</p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-full">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Pending</p>
                      <p className="text-3xl font-bold text-yellow-600">{documentStats.pending}</p>
                    </div>
                    <div className="p-3 bg-yellow-100 rounded-full">
                      <Clock className="h-6 w-6 text-yellow-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">In Progress</p>
                      <p className="text-3xl font-bold text-blue-600">{documentStats.inProgress}</p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-full">
                      <Clock className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Completed</p>
                      <p className="text-3xl font-bold text-green-600">{documentStats.completed}</p>
                    </div>
                    <div className="p-3 bg-green-100 rounded-full">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="requests" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="requests">Document Requests</TabsTrigger>
                <TabsTrigger value="library">Document Library</TabsTrigger>
              </TabsList>

              {/* Document Requests */}
              <TabsContent value="requests" className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          Document Requests
                        </CardTitle>
                        <CardDescription>
                          Manage employee document requests
                        </CardDescription>
                      </div>
                      <Button onClick={handleExport} disabled={loadingRequests || filteredRequests.length === 0}>
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </div>
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
                            placeholder="Search by employee or document type..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="status">Status</Label>
                        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                          <SelectTrigger className="w-36">
                            <Filter className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="All Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Loading State */}
                    {loadingRequests && (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-500">Loading document requests...</p>
                      </div>
                    )}

                    {/* Error State */}
                    {error && (
                      <div className="text-center py-8">
                        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                        <p className="text-red-500">{error}</p>
                      </div>
                    )}

                    {/* Requests List */}
                    {!loadingRequests && !error && (
                    <div className="space-y-4">
                      {filteredRequests.map((request) => (
                        <div key={request.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow duration-200">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-lg">{request.employee}</h4>
                                <Badge className={getStatusColor(request.status)}>
                                  <div className="flex items-center gap-1">
                                    {getStatusIcon(request.status)}
                                    {request.status.replace('_', ' ').charAt(0).toUpperCase() + request.status.replace('_', ' ').slice(1)}
                                  </div>
                                </Badge>
                                <Badge variant="outline">{request.department}</Badge>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="font-medium text-gray-600">Document: </span>
                                  {request.type}
                                </div>
                                <div>
                                  <span className="font-medium text-gray-600">Purpose: </span>
                                  {request.purpose}
                                </div>
                                <div>
                                  <span className="font-medium text-gray-600">Requested: </span>
                                  {request.requestDate}
                                </div>
                              </div>
                              
                              {request.expectedDate && (
                                <div className="text-xs text-blue-600">
                                  Expected completion: {request.expectedDate}
                                </div>
                              )}
                              
                              {request.completedDate && (
                                <div className="text-xs text-green-600">
                                  Completed on: {request.completedDate}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex flex-col gap-2 ml-4">
                                {request.status !== 'completed' && (
                                  <>
                              <Button size="sm" variant="outline">
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                                    {(request.status === 'pending' || request.status === 'in_progress') && (
                                      <Button 
                                        size="sm" 
                                        className="bg-blue-600 hover:bg-blue-700" 
                                        onClick={() => handleUploadClick(request.row)} 
                                        disabled={uploading}
                                      >
                                        <Upload className="h-4 w-4 mr-1" />
                                  Upload
                                </Button>
                              )}
                                  </>
                                )}
                              </div>
                          </div>
                        </div>
                      ))}

                    {filteredRequests.length === 0 && (
                      <div className="text-center py-8">
                        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">No document requests found</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Document Library */}
              <TabsContent value="library" className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          Company Document Library
                        </CardTitle>
                        <CardDescription>
                          Manage company policies and documents
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">Document library feature coming soon</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
      {/* hidden file input */}
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
    </div>
  );
}