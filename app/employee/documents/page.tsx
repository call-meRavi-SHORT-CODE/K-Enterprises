'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { Sidebar } from '@/components/layout/sidebar';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  Download, 
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  Eye
} from 'lucide-react';

export default function DocumentsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [requestType, setRequestType] = useState('');
  const [requestReason, setRequestReason] = useState('');

  // (Payslip tab removed)
   
  const [user, setUser] = useState<{name:string; email:string; avatar?:string}>({name:'', email:''});

  // Load user session from localStorage (set during sign-in)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const session = localStorage.getItem('userSession');
    if (session) {
      const parsed = JSON.parse(session);
      if (parsed.employee) {
        setUser({
          name: parsed.employee.name || parsed.user.displayName,
          email: parsed.employee.email,
          avatar: parsed.employee.photo_url,
        });
      } else {
        setUser({
          name: parsed.user.displayName,
          email: parsed.user.email,
        });
      }
    }
  }, []);

  const documentCategories = [
    'Bonafide Certificate',
    'IT Filing Proof',
    'Salary Certificate',
    'Experience Letter',
    'Employment Verification',
    'Tax Documents',
    'Insurance Documents'
  ];

  const [documents, setDocuments] = useState<Array<{
    id: string;
    name: string;
    type: string;
    size: string;
    created: string;
    modified: string;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch documents from Drive
  useEffect(() => {
    if (!user.email) return;
    
    const fetchDocuments = async () => {
      setIsLoading(true);
      setError(null);
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
      
      try {
        console.log('Fetching documents for:', user.email);
        const res = await fetch(`${apiBase}/employee/documents/${encodeURIComponent(user.email)}`);
        console.log('Response status:', res.status);
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          console.error('Error response:', errorData);
          throw new Error(errorData.detail || `Failed to fetch documents (${res.status})`);
        }
        
        const data = await res.json();
        console.log('Documents received:', data);
        
        setDocuments(data.map((doc: any) => {
          console.log('Processing document:', doc.name);
          return {
            ...doc,
            size: formatFileSize(parseInt(doc.size)),
            created: new Date(doc.created).toLocaleDateString(),
            modified: new Date(doc.modified).toLocaleDateString()
          };
        }));
      } catch (err: any) {
        console.error('Error fetching documents:', err);
        setError(err.message || 'Failed to load documents');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, [user.email]);

  // Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Filter documents based on search and category
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || getDocumentCategory(doc.type) === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Helper to determine document category from MIME type
  const getDocumentCategory = (mimeType: string): string => {
    if (mimeType.includes('pdf')) return 'PDF';
    if (mimeType.includes('spreadsheet')) return 'Spreadsheet';
    if (mimeType.includes('document')) return 'Document';
    if (mimeType.includes('image')) return 'Image';
    return 'Other';
  };

  type DocReq = {
    row: number;
    email: string;
    document_type: string;
    reason: string;
    status: string;
    timestamp: string;
    // Optional fields returned by backend on certain statuses
    expectedDate?: string;
    completedDate?: string;
    rejectionReason?: string;
  };

  const [requests, setRequests] = useState<DocReq[]>([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqError, setReqError] = useState<string | null>(null);

  // Fetch existing document requests for this user
  useEffect(() => {
    if (!user.email) return;
    const fetchRequests = async () => {
      setReqLoading(true);
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
      try {
        const res = await fetch(`${apiBase}/documents/`);
        if (!res.ok) {
          // FastAPI’s HTTPException(detail=...) is returned as {"detail": "..."}
          const { detail } = await res.json().catch(() => ({}));
          throw new Error(detail || `Request failed (${res.status})`);
        }
        const data: DocReq[] = await res.json();
        setRequests(data.filter(r => r.email.toLowerCase() === user.email.toLowerCase()));
      } catch (err: any) {
        console.error(err);
        setReqError(err.message || 'Error');
      } finally {
        setReqLoading(false);
      }
    };
    fetchRequests();
  }, [user.email]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleDocumentRequest = async () => {
    if (!requestType || !requestReason) return;
    setIsSubmitting(true);
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
    const pending = toast({ title: 'Submitting request…', duration: 60000 });
    try {
      const payload = {
        email: user.email,
        document_type: requestType,
        reason: requestReason,
      };
      const res = await fetch(`${apiBase}/documents/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        pending.dismiss();
        toast({ title: 'Failed to submit', variant: 'destructive', duration: 4000 });
      } else {
        pending.dismiss();
        toast({ title: 'Request submitted', variant: 'success', duration: 4000 });
        // refresh list
        const res2 = await fetch(`${apiBase}/documents/`);
        if (res2.ok) {
          const data: DocReq[] = await res2.json();
          setRequests(data.filter(r=>r.email.toLowerCase()===user.email.toLowerCase()));
        }
        // reset form
        setRequestType('');
        setRequestReason('');
      }
    } catch (err) {
      pending.dismiss();
      toast({ title: 'Network error', variant: 'destructive', duration: 4000 });
    }
    setIsSubmitting(false);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Document Management" user={user} />
        
        <main className="flex-1 overflow-auto p-6 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Documents</p>
                      <p className="text-3xl font-bold text-blue-600">{documents.length}</p>
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
                      <p className="text-sm font-medium text-gray-600">Pending Requests</p>
                      <p className="text-3xl font-bold text-yellow-600">
                        {requests.filter(req => req.status.toLowerCase() === 'pending').length}
                      </p>
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
                      <p className="text-sm font-medium text-gray-600">Approved</p>
                      <p className="text-3xl font-bold text-green-600">
                        {requests.filter(req => req.status.toLowerCase() === 'approved').length}
                      </p>
                    </div>
                    <div className="p-3 bg-green-100 rounded-full">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Storage-used card removed */}
            </div>

            <Tabs defaultValue="documents" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="documents">My Documents</TabsTrigger>
                <TabsTrigger value="request">Request Document</TabsTrigger>
                <TabsTrigger value="history">Request History</TabsTrigger>
              </TabsList>

              {/* Payslip tab removed */}

              {/* My Documents */}
              <TabsContent value="documents" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      My Documents
                    </CardTitle>
                    <CardDescription>
                      View and manage your personal documents
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Search and Filter */}
                    <div className="flex flex-col sm:flex-row gap-4 mb-6">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search documents..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger className="w-full sm:w-48">
                          <Filter className="h-4 w-4 mr-2" />
                          <SelectValue placeholder="Filter by category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          <SelectItem value="PDF">PDF</SelectItem>
                          <SelectItem value="Spreadsheet">Spreadsheet</SelectItem>
                          <SelectItem value="Document">Document</SelectItem>
                          <SelectItem value="Image">Image</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Document List */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle>My Documents</CardTitle>
                          <div className="flex gap-4">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <Input
                                placeholder="Search documents..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 w-64"
                              />
                            </div>
                            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="Category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                <SelectItem value="PDF">PDF</SelectItem>
                                <SelectItem value="Spreadsheet">Spreadsheet</SelectItem>
                                <SelectItem value="Document">Document</SelectItem>
                                <SelectItem value="Image">Image</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent>
                        {isLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                          </div>
                        ) : error ? (
                          <div className="text-center py-8 text-red-600">
                            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                            <p>{error}</p>
                          </div>
                        ) : filteredDocuments.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            <FileText className="h-8 w-8 mx-auto mb-2" />
                            <p>No documents found</p>
                          </div>
                        ) : (
                          <div className="divide-y">
                            {filteredDocuments.map((doc) => (
                              <div key={doc.id} className="py-4 flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                  <FileText className="h-6 w-6 text-blue-600" />
                                  <div>
                                    <p className="font-medium">{doc.name}</p>
                                    <p className="text-sm text-gray-500">
                                      {getDocumentCategory(doc.type)} • {doc.size} • Modified: {doc.modified}
                                    </p>
                                  </div>
                                </div>
                                <div>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => {
                                      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
                                      const downloadUrl = `${apiBase}/employee/documents/${user.email}/${doc.id}/download`;
                                      
                                      // Create a temporary link element
                                      const link = document.createElement('a');
                                      link.href = downloadUrl;
                                      link.download = doc.name; // Set the download filename
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                    }}
                                  >
                                    <Download className="h-4 w-4 mr-1" />
                                    Download
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Request Document */}
              <TabsContent value="request" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Request New Document
                    </CardTitle>
                    <CardDescription>
                      Submit a request for official documents from HR
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="document-type">Document Type</Label>
                      <Select value={requestType} onValueChange={setRequestType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select document type" />
                        </SelectTrigger>
                        <SelectContent>
                          {documentCategories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="purpose">Purpose/Reason</Label>
                      <Textarea
                        id="purpose"
                        placeholder="Please specify the purpose for requesting this document..."
                        value={requestReason}
                        onChange={(e) => setRequestReason(e.target.value)}
                        rows={4}
                      />
                    </div>

                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium text-blue-800 mb-2">Processing Information</h4>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>• Standard processing time: 3-5 business days</li>
                        <li>• You will receive an email notification once processed</li>
                        <li>• Documents will be available for download from this portal</li>
                        <li>• For urgent requests, please contact HR directly</li>
                      </ul>
                    </div>

                    <Button 
                      onClick={handleDocumentRequest}
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                      disabled={!requestType || !requestReason || isSubmitting}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Submit Document Request
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Request History */}
              <TabsContent value="history" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Request History
                    </CardTitle>
                    <CardDescription>
                      Track the status of your document requests
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {reqLoading && <p>Loading…</p>}
                      {reqError && <p className="text-red-600">{reqError}</p>}
                      {!reqLoading && requests.map((request, idx) => (
                        <div key={request.row} className="p-4 border rounded-lg hover:shadow-md transition-shadow duration-200">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{request.document_type}</h4>
                                <Badge className={getStatusColor(request.status)}>
                                  <div className="flex items-center gap-1">
                                    {getStatusIcon(request.status)}
                                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                  </div>
                                </Badge>
                              </div>
                              {request.reason && <p className="text-sm text-gray-600">Purpose: {request.reason}</p>}
                              <p className="text-xs text-gray-500">
                                Requested on: {request.timestamp?.split(' ')[0] || ''}
                              </p>
                              {request.expectedDate && request.status === 'pending' && (
                                <p className="text-xs text-blue-600">
                                  Expected completion: {request.expectedDate}
                                </p>
                              )}
                              {request.completedDate && request.status === 'approved' && (
                                <p className="text-xs text-green-600">
                                  Completed on: {request.completedDate}
                                </p>
                              )}
                              {request.rejectionReason && request.status === 'rejected' && (
                                <div className="p-2 bg-red-50 rounded border-l-4 border-red-200">
                                  <p className="text-sm text-red-800">
                                    <strong>Reason:</strong> {request.rejectionReason}
                                  </p>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              {request.status === 'approved' && (
                                <Button size="sm" variant="outline">
                                  <Download className="h-4 w-4 mr-1" />
                                  Download
                                </Button>
                              )}
                              {request.status === 'pending' && (
                                <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Cancel
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}