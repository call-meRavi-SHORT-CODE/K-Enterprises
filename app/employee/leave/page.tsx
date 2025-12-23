'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { 
  Calendar as CalendarIcon, 
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  TrendingUp
} from 'lucide-react';
import { format, parse, differenceInCalendarDays, isValid } from 'date-fns';

export default function LeavePage() {
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [leaveType, setLeaveType] = useState('');
  const [reason, setReason] = useState('');

  // Retrieve the logged-in user from the session (set during sign-in)
  const [user, setUser] = useState<{ name: string; email: string }>({ name: '', email: '' });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const session = localStorage.getItem('userSession');
    if (session) {
      const parsed = JSON.parse(session);
      setUser({
        name: parsed.employee?.name || parsed.user.displayName || '',
        email: parsed.employee?.email || parsed.user.email || '',
      });
    }
  }, []);

  const LEAVE_QUOTA: Record<string, number> = {
    casual: 12,
    sick: 12,
    earned: 20,
    maternity: 180,
    paternity: 15,
  };

  type LeaveReq = {
    row: number;
    employee: string;
    leave_type: string;
    from_date: string;
    to_date: string;
    duration: string;
    applied_date: string;
    reason: string;
    status: string;
  };

  const [leaves, setLeaves] = useState<LeaveReq[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [leavesError, setLeavesError] = useState<string | null>(null);

  const [leaveBalance, setLeaveBalance] = useState<Record<string,{used:number,total:number,remaining:number}>>({});

  // ------------------------------------------------------------------
  // Public holidays (fetched from backend `/holidays/` endpoint)
  // ------------------------------------------------------------------


  const [holidays, setHolidays] = useState<any[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [holidaysError, setHolidaysError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHolidays = async () => {
      setHolidaysLoading(true);
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
      try {
        const res = await fetch(`${apiBase}/holidays/`);
        if (!res.ok) throw new Error('Failed to fetch holidays');
        const data = await res.json();
        setHolidays(data);
      } catch (err: any) {
        console.error(err);
        setHolidaysError(err.message || 'Error fetching holidays');
      } finally {
        setHolidaysLoading(false);
      }
    };
    fetchHolidays();
  }, []);

  // Prepare Date objects for calendar modifiers using fetched holidays
  const holidayDates: Date[] = holidays.map((h) => {
    try {
      return parse(h.date, 'dd-MM-yyyy', new Date());
    } catch {
      return null as unknown as Date;
    }
  }).filter(Boolean);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'denied':
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'denied':
      case 'rejected':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  useEffect(() => {
    if (!user.email) return;
    const fetchLeaves = async () => {
      setLeavesLoading(true);
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
      try {
        const res = await fetch(`${apiBase}/leaves/`);
        if (!res.ok) throw new Error('Failed to fetch leaves');
        const data: LeaveReq[] = await res.json();
        const myLeaves = data.filter((l) => l.employee.toLowerCase() === user.email.toLowerCase());
        setLeaves(myLeaves);

        // Compute used days only for accepted leaves
        const used: Record<string, number> = {};
        myLeaves.filter((l) => l.status.toLowerCase() === 'accepted').forEach((l) => {
          const key = l.leave_type.toLowerCase();
          const days = parseInt(l.duration) || differenceInCalendarDays(new Date(l.to_date), new Date(l.from_date)) + 1;
          used[key] = (used[key] || 0) + days;
        });

        const balance: Record<string,{used:number,total:number,remaining:number}> = {};
        Object.entries(LEAVE_QUOTA).forEach(([key,total]) => {
          const u = used[key] || 0;
          balance[key] = { used:u, total, remaining: Math.max(total - u, 0) };
        });
        setLeaveBalance(balance);
      } catch (err: any) {
        console.error(err);
        setLeavesError(err.message || 'Error fetching leaves');
      } finally {
        setLeavesLoading(false);
      }
    };
    fetchLeaves();
  }, [user.email]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitLeave = async () => {
    if (!leaveType || !dateFrom || !dateTo || !reason) return;
    if (leaveBalance[leaveType]?.remaining === 0) return;
    setIsSubmitting(true);
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
    const pending = toast({ title: 'Submitting leave…', duration: 60000 });
    try {
      // Backend expects ISO 8601 date strings (yyyy-MM-dd)
      const toISO = (d: Date) => format(d, 'yyyy-MM-dd');
      const days = differenceInCalendarDays(dateTo, dateFrom) + 1;
      const payload = {
        employee: user.email,
        leave_type: leaveType,
        from_date: toISO(dateFrom),
        to_date: toISO(dateTo),
        duration: String(days),
        applied_date: toISO(new Date()),
        reason,
        status: 'Pending',
      } as any;
      const res = await fetch(`${apiBase}/leaves/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        console.error('Failed to submit leave');
        pending.dismiss();
        toast({ title: 'Failed to submit leave', variant: 'destructive', duration: 4000 });
      } else {
        // Reset form
        setLeaveType('');
        setDateFrom(undefined);
        setDateTo(undefined);
        setReason('');
        pending.dismiss();
        toast({ title: 'Leave application submitted', variant: 'success', duration: 4000 });

        // refresh leaves list
        const data: LeaveReq[] = await res.json(); // actual endpoint returns {row,status}, so instead refetch
        // fetchLeaves(); (reuse function via inline)
        const refresh = async () => {
          const res2 = await fetch(`${apiBase}/leaves/`);
          if (res2.ok) {
            const ls: LeaveReq[] = await res2.json();
            setLeaves(ls.filter(l=>l.employee.toLowerCase()===user.email.toLowerCase()));
          }
        };
        refresh();
      }
    } catch (err) {
      console.error(err);
      pending.dismiss();
      toast({ title: 'Network error', variant: 'destructive', duration: 4000 });
    }
    setIsSubmitting(false);
  };

  // Helper to safely parse date strings from backend (dd-mm-yyyy or yyyy-mm-dd)
  const parseDateStr = (s: string): Date => {
    if (!s) return new Date(NaN);
    // Detect yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const d = new Date(s);
      if (isValid(d)) return d;
    }
    // Fallback dd-mm-yyyy
    const d = parse(s, 'dd-MM-yyyy', new Date());
    return isValid(d) ? d : new Date(NaN);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Leave Management" user={user} />
        
        <main className="flex-1 overflow-auto p-6 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Leave Balance Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(leaveBalance).map(([key, balance]) => (
                <Card key={key} className="hover:shadow-lg transition-shadow duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold capitalize">{key.replace(/([A-Z])/g, ' $1')} Leave</h3>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        {balance.remaining} left
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Used: {balance.used}</span>
                        <span>Total: {balance.total}</span>
                      </div>
                      <Progress 
                        value={(balance.used / balance.total) * 100} 
                        className="h-2"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Tabs defaultValue="apply" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="apply">Apply Leave</TabsTrigger>
                <TabsTrigger value="history">Leave History</TabsTrigger>
                <TabsTrigger value="calendar">Calendar View</TabsTrigger>
                <TabsTrigger value="holidays">Holidays</TabsTrigger>
              </TabsList>

              {/* Apply Leave */}
              <TabsContent value="apply" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Apply for Leave
                    </CardTitle>
                    <CardDescription>
                      Submit a new leave application
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Leave Type</Label>
                        <Select value={leaveType} onValueChange={setLeaveType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select leave type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="casual">Casual Leave</SelectItem>
                            <SelectItem value="sick">Sick Leave</SelectItem>
                            <SelectItem value="earned">Earned Leave</SelectItem>
                            <SelectItem value="maternity">Maternity Leave</SelectItem>
                            <SelectItem value="paternity">Paternity Leave</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Available Balance</Label>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          {leaveType && leaveBalance[leaveType as keyof typeof leaveBalance] ? (
                            <p className="font-medium">
                              {leaveBalance[leaveType as keyof typeof leaveBalance].remaining} days remaining
                            </p>
                          ) : (
                            <p className="text-gray-500">Select leave type to see balance</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>From Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {dateFrom ? format(dateFrom, 'PPP') : 'Select start date'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={dateFrom}
                              onSelect={setDateFrom}
                              disabled={(date) => date < new Date()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <Label>To Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {dateTo ? format(dateTo, 'PPP') : 'Select end date'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={dateTo}
                              onSelect={setDateTo}
                              disabled={(date) => date < (dateFrom || new Date())}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {dateFrom && dateTo && (
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <p className="text-sm font-medium text-blue-800">
                          Total Days: {Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24)) + 1}
                        </p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Reason for Leave</Label>
                      <Textarea
                        placeholder="Please provide a reason for your leave application..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={4}
                      />
                    </div>

                    <Button 
                      onClick={handleSubmitLeave}
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                      disabled={!leaveType || !dateFrom || !dateTo || !reason || isSubmitting || (leaveBalance[leaveType]?.remaining===0)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Submit Leave Application
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Leave History */}
              <TabsContent value="history" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Leave History
                    </CardTitle>
                    <CardDescription>
                      Your previous leave applications and their status
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {leavesLoading && <p>Loading…</p>}
                      {leavesError && <p className="text-red-600">{leavesError}</p>}
                      {!leavesLoading && leaves.map((request, idx) => {
                        const fromDt = parseDateStr(request.from_date);
                        const toDt = parseDateStr(request.to_date);
                        const appliedDt = parseDateStr(request.applied_date);
                        const days = parseInt(request.duration) || (isValid(fromDt) && isValid(toDt) ? differenceInCalendarDays(toDt, fromDt) + 1 : 0);
                        return (
                        <div key={idx} className="p-4 border rounded-lg hover:shadow-md transition-shadow duration-200">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{request.leave_type.charAt(0).toUpperCase()+request.leave_type.slice(1)} Leave</h4>
                                <Badge className={getStatusColor(request.status.toLowerCase())}>
                                  <div className="flex items-center gap-1">
                                    {getStatusIcon(request.status.toLowerCase())}
                                    {request.status.charAt(0).toUpperCase()+request.status.slice(1)}
                                  </div>
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600">
                                {isValid(fromDt) && isValid(toDt)
                                  ? `${format(fromDt, 'MMM dd, yyyy')} - ${format(toDt, 'MMM dd, yyyy')}`
                                  : request.from_date + ' - ' + request.to_date}
                              </p>
                              {request.reason && <p className="text-sm text-gray-500">{request.reason}</p>}
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{days} days</p>
                              {isValid(appliedDt) && <p className="text-xs text-gray-500">Applied: {format(appliedDt, 'MMM dd')}</p>}
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Calendar View */}
              <TabsContent value="calendar" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarIcon className="h-5 w-5" />
                      Leave Calendar
                    </CardTitle>
                    <CardDescription>
                      Visual representation of your leaves and company holidays
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2">
                        <Calendar
                          mode="single"
                          className="rounded-md border w-full"
                          classNames={{
                            months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                            month: "space-y-4",
                            caption: "flex justify-center pt-1 relative items-center",
                            caption_label: "text-sm font-medium",
                            nav: "space-x-1 flex items-center",
                            nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                            table: "w-full border-collapse space-y-1",
                            head_row: "flex",
                            head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                            row: "flex w-full mt-2",
                            cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                            day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
                          }}
                          modifiers={{ companyHoliday: holidayDates }}
                          modifiersClassNames={{ companyHoliday: 'bg-blue-200 text-blue-900' }}
                        />
                      </div>
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold mb-2">Legend</h4>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 bg-green-200 rounded"></div>
                              <span className="text-sm">Approved Leave</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 bg-yellow-200 rounded"></div>
                              <span className="text-sm">Pending Leave</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 bg-blue-200 rounded"></div>
                              <span className="text-sm">Company Holiday</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Holidays */}
              <TabsContent value="holidays" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarIcon className="h-5 w-5" />
                      Company Holidays {new Date().getFullYear()}
                    </CardTitle>
                    <CardDescription>
                      Official holidays and observances
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {holidaysLoading && <p>Loading holidays…</p>}
                      {holidaysError && (
                        <p className="text-red-600">{holidaysError}</p>
                      )}
                      {!holidaysLoading && !holidaysError && holidays.length === 0 && (
                        <p>No holidays found.</p>
                      )}
                      {!holidaysLoading && !holidaysError && holidays.map((holiday, index) => {
                        const dateObj = parse(holiday.date, 'dd-MM-yyyy', new Date());
                        return (
                        <div key={index} className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                          <div>
                            <h4 className="font-medium">{holiday.name}</h4>
                            <p className="text-sm text-gray-600">{holiday.type}</p>
                          </div>
                          <div className="text-right">
                              <p className="font-medium">{format(dateObj, 'MMM dd, yyyy')}</p>
                              <p className="text-sm text-gray-500">{holiday.day || format(dateObj, 'EEEE')}</p>
                            </div>
                          </div>
                        );
                      })}
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