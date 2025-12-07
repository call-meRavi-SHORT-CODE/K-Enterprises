'use client';

import { useState, useEffect } from 'react';
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
import { Progress } from '@/components/ui/progress';
import { 
  Clock, 
  Play, 
  Pause, 
  Square as Stop, 
  Plus, 
  CalendarIcon, 
  Timer, 
  BarChart3, 
  TrendingUp,
  Edit,
  Trash2,
  Save,
  X,
  CheckCircle,
  AlertCircle,
  Download,
  Filter,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Coffee,
  MapPin
} from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths, isSameDay, getDay, startOfDay } from 'date-fns';
// Backend helpers
import { fetchTimesheets, createTimesheetEntry,deleteTimesheetEntry } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

interface TimeEntry {
  id: string;
  date: string;
  project: string;
  task: string;
  description: string;
  startTime: string;
  endTime?: string;
  duration: number; // in minutes
  status: 'running' | 'completed' | 'pending_approval' | 'approved';
  isManual: boolean;
  breakTime?: number; // in minutes
}

interface Project {
  id: string;
  name: string;
  client: string;
  color: string;
  isActive: boolean;
}

interface DayData {
  date: Date;
  entries: TimeEntry[];
  totalTime: number;
  status: 'present' | 'absent' | 'weekend' | 'holiday';
  checkIn?: string;
  checkOut?: string;
  breakTime?: number;
}

export default function TimesheetPage() {
  const [currentTimer, setCurrentTimer] = useState({
    isRunning: false,
    project: '',
    task: '',
    description: '',
    startTime: '',
    elapsed: 0 // in seconds
  });

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [showAddEntry, setShowAddEntry] = useState(false);

  const [user, setUser] = useState<{ name: string; email: string }>({ name: '', email: '' });

  // Load session on mount
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

  // Projects are populated dynamically; provide sensible defaults if none yet
  const defaultProjects: Project[] = [
    { id: 'mobile-app', name: 'Mobile App', client: '', color: '#10B981', isActive: true },
    { id: 'frontend', name: 'Frontend Development', client: '', color: '#3B82F6', isActive: true },
    { id: 'backend', name: 'Backend API', client: '', color: '#8B5CF6', isActive: true },
    { id: 'devops', name: 'DevOps / Deployment', client: '', color: '#F59E0B', isActive: true },
    { id: 'website', name: 'Website Redesign', client: '', color: '#EF4444', isActive: true },
  ];

  const [projects, setProjects] = useState<Project[]>(defaultProjects);

  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);

  const [newEntry, setNewEntry] = useState({
    project: '',
    task: '',
    description: '',
    startTime: '',
    endTime: '',
    breakTime: '0'
  });

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (currentTimer.isRunning) {
      interval = setInterval(() => {
        setCurrentTimer(prev => ({ ...prev, elapsed: prev.elapsed + 1 }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [currentTimer.isRunning]);

  // -----------------------------------------------------------------------
  // Helper to fetch & map backend rows → local TimeEntry model
  // -----------------------------------------------------------------------
  const loadData = async () => {
    try {
      const backend = await fetchTimesheets(user.email);

      const mapped: TimeEntry[] = backend.map((item) => {
        const [d, m, y] = item.date.split('-');
        const isoDate = `${y}-${m}-${d}`; // yyyy-MM-dd for UI
        return {
          id: item.row.toString(),
          date: isoDate,
          project: item.project,
          task: item.task_description,
          description: item.task_description,
          startTime: '',
          endTime: '',
          duration: Math.round(item.duration_hours * 60),
          status: 'completed',
          isManual: true,
          breakTime: item.break_minutes ?? 0,
        };
      });

      setTimeEntries(mapped);

      // Build dynamic project palette from existing entries
      const unique = Array.from(new Set(mapped.map((m) => m.project)));
      const palette = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#84CC16', '#F472B6', '#0EA5E9'];

      const dynamicProjects = unique.map((name, idx) => ({
        id: `${idx + 1}`,
        name,
        color: palette[idx % palette.length],
        client: '',
        isActive: true,
      }));

      // If no dynamic projects (i.e. brand-new user with no entries), keep defaults
      setProjects(dynamicProjects.length ? dynamicProjects : defaultProjects);
    } catch (err) {
      console.error('Failed to load timesheets', err);
    }
  };

  // Initial load
  useEffect(() => {
    if (user.email) {
      loadData();
    }
  }, [user.email]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const startTimer = () => {
    if (!currentTimer.project || !currentTimer.task) {
      toast({ title: 'Validation', description: 'Please select a project and enter a task description', variant: 'destructive' });
      return;
    }
    
    setCurrentTimer(prev => ({
      ...prev,
      isRunning: true,
      startTime: format(new Date(), 'HH:mm'),
      elapsed: 0
    }));
  };

  const pauseTimer = () => {
    setCurrentTimer(prev => ({ ...prev, isRunning: false }));
  };

  const stopTimer = async () => {
    if (currentTimer.elapsed === 0) return;

    if (!user.email) {
      toast({ title: 'Error', description: 'User session missing', variant: 'destructive' });
      return;
    }
    const durationMinutes = Math.floor(currentTimer.elapsed / 60);

    const payload = {
      employee: user.email,
      date: format(new Date(), 'yyyy-MM-dd'),
      project: currentTimer.project,
      task_description: currentTimer.task,
      duration_hours: durationMinutes / 60,
      break_minutes: 0,
    };

    try {
      await createTimesheetEntry(payload);
      await loadData();
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to save entry', variant: 'destructive' });
    }
 
    setCurrentTimer({
      isRunning: false,
      project: '',
      task: '',
      description: '',
      startTime: '',
      elapsed: 0
    });
  };

  const addManualEntry = async () => {
    if (!newEntry.project || !newEntry.task || !newEntry.startTime || !newEntry.endTime) {
      toast({ title: 'Validation', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    if (!user.email) {
      toast({ title: 'Error', description: 'User session missing', variant: 'destructive' });
      return;
    }
    const start = new Date(`${format(selectedDate, 'yyyy-MM-dd')}T${newEntry.startTime}`);
    const end = new Date(`${format(selectedDate, 'yyyy-MM-dd')}T${newEntry.endTime}`);
    const duration = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));

    if (duration <= 0) {
      toast({ title: 'Validation', description: 'End time must be after start time', variant: 'destructive' });
      return;
    }

    // Add new project to project list if not already present
    if (newEntry.project && !projects.some(p => p.name === newEntry.project)) {
      setProjects(prev => [
        ...prev,
        {
          id: `${prev.length + 1}`,
          name: newEntry.project,
          client: '',
          color: '#6B7280', // default gray, or you can randomize
          isActive: true,
        },
      ]);
    }

    // Persist to backend
    const payload = {
      employee: user.email,
      date: format(selectedDate, 'yyyy-MM-dd'),
      project: newEntry.project,
      task_description: newEntry.task,
      duration_hours: duration / 60,
      break_minutes: parseInt(newEntry.breakTime) || 0,
    };

    try {
      await createTimesheetEntry(payload);
      await loadData();
      toast({ title: 'Success', description: 'Time entry added', });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to save entry', variant: 'destructive' });
    }

    setNewEntry({
      project: '',
      task: '',
      description: '',
      startTime: '',
      endTime: '',
      breakTime: '0'
    });
    setShowAddEntry(false);
  };

  // Delete a single entry by id (UI and backend)
  const deleteEntry = async (id: string) => {
    const originalEntries = [...timeEntries];
    // Optimistically update the UI
    setTimeEntries(prev => prev.filter(entry => entry.id !== id));
    try {
      await deleteTimesheetEntry(id);
      toast({
        title: 'Success',
        description: 'Time entry deleted.',
        variant: 'success',
      });
      // Optionally reload all data to ensure consistency
      // await loadData();
    } catch (error) {
      console.error('Failed to delete time entry:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete entry. Reverting changes.',
        variant: 'destructive',
      });
      // Revert UI change on failure
      setTimeEntries(originalEntries);
    }
  };

  // Delete a project (UI and backend)
  const deleteProject = async (projectName: string) => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
    const pending = toast({ title: 'Deleting project…', duration: 60000 });
    try {
      const res = await fetch(`${apiBase}/projects/${encodeURIComponent(projectName)}`, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) {
        const errMsg = await res.text();
        pending.dismiss && pending.dismiss();
        toast({ title: 'Failed to delete project', description: errMsg, variant: 'destructive', duration: 4000 });
        return;
      }
      // Reload data from backend after deletion
      await loadData();
      // Mark project as inactive instead of removing, to preserve color for old entries
      setProjects(prev => prev.map(p => p.name === projectName ? { ...p, isActive: false } : p));
      pending.dismiss && pending.dismiss();
      toast({ title: 'Project deleted', description: `${projectName} and its timesheet entries removed.`, variant: 'success', duration: 4000 });
    } catch (err) {
      pending.dismiss && pending.dismiss();
      toast({ title: 'Network error', description: 'Failed to delete project on server', variant: 'destructive', duration: 4000 });
    }
  };

  const getProjectColor = (projectName: string) => {
    const project = projects.find(p => p.name === projectName);
    return project?.color || '#6B7280';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'pending_approval': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDayData = (date: Date): DayData => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayEntries = timeEntries.filter(entry => entry.date === dateStr);
    const totalTime = dayEntries.reduce((total, entry) => total + entry.duration, 0);
    const totalBreakTime = dayEntries.reduce((total, entry) => total + (entry.breakTime || 0), 0);
    
    const dayOfWeek = getDay(date);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    let status: 'present' | 'absent' | 'weekend' | 'holiday' = 'absent';
    if (isWeekend) {
      status = 'weekend';
    } else if (totalTime > 0) {
      status = 'present';
    }

    const checkIn = dayEntries.length > 0 ? dayEntries[0].startTime : undefined;
    const checkOut = dayEntries.length > 0 && dayEntries[dayEntries.length - 1].endTime ? dayEntries[dayEntries.length - 1].endTime : undefined;

    return {
      date,
      entries: dayEntries,
      totalTime,
      status,
      checkIn,
      checkOut,
      breakTime: totalBreakTime
    };
  };

  const getWeekDays = (weekStart: Date) => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  };

  const getMonthDays = (monthStart: Date) => {
    const start = startOfMonth(monthStart);
    const end = endOfMonth(monthStart);
    const startWeek = startOfWeek(start, { weekStartsOn: 1 });
    const endWeek = endOfWeek(end, { weekStartsOn: 1 });
    
    const days = [];
    let current = startWeek;
    while (current <= endWeek) {
      days.push(current);
      current = addDays(current, 1);
    }
    return days;
  };

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = getWeekDays(weekStart);
  const monthDays = getMonthDays(currentMonth);

  const weekTotal = weekDays.reduce((total, day) => {
    const dayData = getDayData(day);
    return total + dayData.totalTime;
  }, 0);

  const monthTotal = monthDays.reduce((total, day) => {
    const dayData = getDayData(day);
    return total + dayData.totalTime;
  }, 0);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Timesheet Management" user={user} />
        
        <main className="flex-1 overflow-auto p-6 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Live Timer Section */}
            <Card className={`${currentTimer.isRunning ? 'bg-gradient-to-r from-green-50 to-blue-50 border-green-200' : 'bg-gray-50'} transition-all duration-300`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${currentTimer.isRunning ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <Timer className={`h-5 w-5 ${currentTimer.isRunning ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div className="flex items-center gap-4">
                      <Select 
                        value={currentTimer.project} 
                        onValueChange={(value) => setCurrentTimer(prev => ({ ...prev, project: value }))}
                        disabled={currentTimer.isRunning}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.filter(p => p.isActive).map((project) => (
                            <SelectItem key={project.id} value={project.name}>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: project.color }}
                                />
                                {project.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Input
                        placeholder="What are you working on?"
                        value={currentTimer.task}
                        onChange={(e) => setCurrentTimer(prev => ({ ...prev, task: e.target.value }))}
                        disabled={currentTimer.isRunning}
                        className="w-64"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${currentTimer.isRunning ? 'text-green-600' : 'text-gray-400'}`}>
                        {formatTime(currentTimer.elapsed)}
                      </p>
                    </div>
                    
                    <div className="flex gap-2">
                      {!currentTimer.isRunning ? (
                        <Button onClick={startTimer} size="sm" className="bg-green-600 hover:bg-green-700">
                          <Play className="h-4 w-4 mr-1" />
                          Start
                        </Button>
                      ) : (
                        <>
                          <Button onClick={pauseTimer} size="sm" variant="outline">
                            <Pause className="h-4 w-4 mr-1" />
                            Pause
                          </Button>
                          <Button onClick={stopTimer} size="sm" className="bg-red-600 hover:bg-red-700">
                            <Stop className="h-4 w-4 mr-1" />
                            Stop
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Calendar Navigation */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewMode('week')}
                        className={viewMode === 'week' ? 'bg-blue-100 text-blue-700' : ''}
                      >
                        Week
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewMode('month')}
                        className={viewMode === 'month' ? 'bg-blue-100 text-blue-700' : ''}
                      >
                        Month
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (viewMode === 'week') {
                            setCurrentWeek(addWeeks(currentWeek, -1));
                          } else {
                            setCurrentMonth(addMonths(currentMonth, -1));
                          }
                        }}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      
                      <h3 className="text-lg font-semibold min-w-48 text-center">
                        {viewMode === 'week' 
                          ? `${format(weekStart, 'MMM dd')} - ${format(addDays(weekStart, 6), 'MMM dd, yyyy')}`
                          : format(currentMonth, 'MMMM yyyy')
                        }
                      </h3>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (viewMode === 'week') {
                            setCurrentWeek(addWeeks(currentWeek, 1));
                          } else {
                            setCurrentMonth(addMonths(currentMonth, 1));
                          }
                        }}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCurrentWeek(new Date());
                        setCurrentMonth(new Date());
                      }}
                    >
                      Today
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                {viewMode === 'week' ? (
                  /* Weekly View */
                  <div className="space-y-4">
                    {/* Week Header */}
                    <div className="grid grid-cols-8 gap-4 pb-2 border-b">
                      <div className="text-sm font-medium text-gray-500"></div>
                      {weekDays.map((day) => (
                        <div key={format(day, 'yyyy-MM-dd')} className="text-center">
                          <div className="text-sm font-medium text-gray-700">
                            {format(day, 'EEE')}
                          </div>
                          <div className={`text-lg font-semibold ${isSameDay(day, new Date()) ? 'text-blue-600' : 'text-gray-900'}`}>
                            {format(day, 'd')}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Time Slots */}
                    {/* Time Grid: 8:00 - 18:00, 30min slots, project blocks */}
                    <div className="relative w-full bg-white rounded-lg shadow-sm border" style={{ minHeight: '420px', overflow: 'hidden' }}>
                      <div className="flex flex-row w-full h-full">
                        {/* Time labels column */}
                        <div className="flex flex-col items-end pr-2 pt-2" style={{ width: '48px', minWidth: '48px' }}>
                          {Array.from({ length: 11 }, (_, i) => 8 + i).map((hour) => (
                            <div key={hour} className="h-9 flex items-start justify-end text-xs text-gray-400" style={{ height: '36px' }}>
                              {`${hour.toString().padStart(2, '0')}:00`}
                            </div>
                          ))}
                        </div>
                        {/* Calendar grid */}
                        <div className="grid grid-cols-7 gap-2 relative z-10 flex-1" style={{ minHeight: '420px' }}>
                          {weekDays.map((day, colIdx) => {
                            const dayData = getDayData(day);
                            return (
                              <div key={format(day, 'yyyy-MM-dd')} className="relative h-full" style={{ minHeight: '420px' }}>
                                {/* Project entries as absolute blocks */}
                                {dayData.entries.map((entry) => {
                                  let [sh, sm] = entry.startTime ? entry.startTime.split(':').map(Number) : [8, 0];
                                  let [eh, em] = entry.endTime ? entry.endTime.split(':').map(Number) : [sh, sm + 30];
                                  if (em >= 60) { eh += Math.floor(em / 60); em = em % 60; }
                                  const startMin = (sh * 60 + sm) - 8 * 60;
                                  const endMin = (eh * 60 + em) - 8 * 60;
                                  const top = Math.max(0, (startMin / 600) * 100);
                                  const height = Math.max(8, ((endMin - startMin) / 600) * 100);
                                  return (
                                    <div
                                      key={entry.id}
                                      className={`absolute left-1 right-1 rounded shadow-md text-xs text-white px-2 py-1 cursor-pointer ${isSameDay(day, selectedDate) ? 'ring-2 ring-blue-400' : ''}`}
                                      style={{
                                        backgroundColor: getProjectColor(entry.project),
                                        top: `${top}%`,
                                        height: `${height}%`,
                                        zIndex: 2,
                                        minHeight: '28px',
                                        opacity: isSameDay(day, selectedDate) ? 1 : 0.85,
                                      }}
                                      onClick={() => {
                                        setSelectedDate(day);
                                        setEditingEntry(entry.id);
                                      }}
                                    >
                                      <div className="font-semibold truncate">{entry.project}</div>
                                      <div className="truncate opacity-90">{entry.task}</div>
                                      <div className="text-[11px] mt-1 font-mono bg-white/80 text-gray-800 px-1 py-0.5 rounded shadow-sm w-fit">
                                        {entry.startTime && entry.endTime ? `${entry.startTime} - ${entry.endTime}` : ''}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      {/* Edit Entry Modal */}
                      {editingEntry && (() => {
                        const entry = timeEntries.find(e => e.id === editingEntry);
                        if (!entry) return null;
                        return (
                          <Card className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                              <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">Edit Time Entry</h3>
                                <Button variant="ghost" size="sm" onClick={() => setEditingEntry(null)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="space-y-4">
                                <div>
                                  <Label>Project</Label>
                                  <Input type="text" value={entry.project} readOnly className="bg-gray-100" />
                                </div>
                                <div>
                                  <Label>Task</Label>
                                  <Input type="text" value={entry.task} readOnly className="bg-gray-100" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>Start Time</Label>
                                    <Input type="time" value={entry.startTime} readOnly className="bg-gray-100" />
                                  </div>
                                  <div>
                                    <Label>End Time</Label>
                                    <Input type="time" value={entry.endTime} readOnly className="bg-gray-100" />
                                  </div>
                                </div>
                                <div className="flex gap-2 pt-4">
                                  <Button variant="destructive" onClick={() => { deleteEntry(entry.id); setEditingEntry(null); }} className="flex-1">
                                    <Trash2 className="h-4 w-4 mr-2" /> Delete Entry
                                  </Button>
                                  <Button variant="outline" onClick={() => setEditingEntry(null)} className="flex-1">
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </Card>
                        );
                      })()}
                    </div>

                    {/* Week Summary */}
                    <div className="grid grid-cols-8 gap-4 pt-4 border-t">
                      <div className="text-sm font-medium text-gray-700">Total</div>
                      {weekDays.map((day) => {
                        const dayData = getDayData(day);
                        return (
                          <div key={format(day, 'yyyy-MM-dd')} className="text-center">
                            <div className="text-sm font-semibold">
                              {formatDuration(dayData.totalTime)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {dayData.entries.length} entries
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Monthly View */
                  <div className="space-y-4">
                    {/* Month Header */}
                    <div className="grid grid-cols-7 gap-2">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                        <div key={day} className="text-center text-sm font-medium text-gray-700 py-2">
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Month Days */}
                    <div className="grid grid-cols-7 gap-2">
                      {monthDays.map((day) => {
                        const dayData = getDayData(day);
                        const isCurrentMonth = format(day, 'MM') === format(currentMonth, 'MM');
                        const isToday = isSameDay(day, new Date());
                        const isSelected = isSameDay(day, selectedDate);

                        return (
                          <div
                            key={format(day, 'yyyy-MM-dd')}
                            className={`
                              min-h-24 p-2 border rounded cursor-pointer transition-all duration-200
                              ${isCurrentMonth ? 'bg-white' : 'bg-gray-50 text-gray-400'}
                              ${isToday ? 'ring-2 ring-blue-400' : ''}
                              ${isSelected ? 'ring-2 ring-purple-400' : ''}
                              ${dayData.status === 'present' ? 'bg-green-50 border-green-200' : ''}
                              ${dayData.status === 'weekend' ? 'bg-gray-100' : ''}
                              hover:shadow-md
                            `}
                            onClick={() => setSelectedDate(day)}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className={`text-sm font-medium ${isToday ? 'text-blue-600' : ''}`}>
                                {format(day, 'd')}
                              </span>
                              {dayData.status === 'present' && (
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              )}
                            </div>
                            {dayData.totalTime > 0 && (
                              <div className="space-y-1">
                                <div className="text-xs font-semibold text-green-600">
                                  {formatDuration(dayData.totalTime)}
                                </div>
                                {dayData.checkIn && (
                                  <div className="text-xs text-gray-600">
                                    {dayData.checkIn} - {dayData.checkOut || 'Running'}
                                  </div>
                                )}
                              </div>
                            )}
                            {dayData.entries.slice(0, 2).map((entry) => (
                              <div
                                key={entry.id}
                                className="text-xs p-1 rounded mb-1 text-white"
                                style={{ backgroundColor: getProjectColor(entry.project) }}
                              >
                                <div className="truncate">{entry.project}</div>
                              </div>
                            ))}
                            {dayData.entries.length > 2 && (
                              <div className="text-xs text-gray-500">
                                +{dayData.entries.length - 2} more
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
      
    </CardContent>
  </Card>

            {/* Selected Day Details */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarIcon className="h-5 w-5" />
                      {format(selectedDate, 'EEEE, MMMM do, yyyy')}
                    </CardTitle>
                    <CardDescription>
                      {(() => {
                        const dayData = getDayData(selectedDate);
                        return `${formatDuration(dayData.totalTime)} • ${dayData.entries.length} entries`;
                      })()}
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => setShowAddEntry(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Entry
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent>
                {(() => {
                  const dayData = getDayData(selectedDate);
                  
                  if (dayData.entries.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">No time entries for this day</p>
                        <Button
                          onClick={() => setShowAddEntry(true)}
                          variant="outline"
                          className="mt-4"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add First Entry
                        </Button>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {/* Day Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-blue-50 rounded-lg">
                        <div className="text-center">
                          <div className="text-sm text-gray-600">Check In</div>
                          <div className="text-lg font-semibold text-blue-600">
                            {dayData.checkIn || '-'}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm text-gray-600">Check Out</div>
                          <div className="text-lg font-semibold text-blue-600">
                            {dayData.checkOut || 'Running'}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm text-gray-600">Total Time</div>
                          <div className="text-lg font-semibold text-green-600">
                            {formatDuration(dayData.totalTime)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm text-gray-600">Break Time</div>
                          <div className="text-lg font-semibold text-orange-600">
                            {formatDuration(dayData.breakTime || 0)}
                          </div>
                        </div>
                      </div>

                      {/* Time Entries */}
                      <div className="space-y-3">
                        {dayData.entries.map((entry) => (
                          <div key={entry.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow duration-200">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <div 
                                  className="w-4 h-4 rounded-full mt-1" 
                                  style={{ backgroundColor: getProjectColor(entry.project) }}
                                />
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium">{entry.project}</h4>
                                    <Badge className={getStatusColor(entry.status)}>
                                      {entry.status.replace('_', ' ')}
                                    </Badge>
                                    {entry.isManual && (
                                      <Badge variant="outline">Manual</Badge>
                                    )}
                                  </div>
                                  <p className="text-sm font-medium text-gray-700">{entry.task}</p>
                                  <p className="text-xs text-gray-500">{entry.description}</p>
                                  <div className="flex items-center gap-4 text-xs text-gray-400">
                                    {entry.startTime && entry.endTime ? (
                                      <span className="font-semibold text-blue-600">{entry.startTime} - {entry.endTime}</span>
                                    ) : (
                                      <span>{entry.startTime || ''}{entry.endTime ? ` - ${entry.endTime}` : ''}</span>
                                    )}
                                    {entry.breakTime && entry.breakTime > 0 && (
                                      <span className="flex items-center gap-1">
                                        <Coffee className="h-3 w-3" />
                                        {formatDuration(entry.breakTime)} break
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right min-w-[90px] flex flex-col items-end justify-between h-full">
                                {/* Show only time range, not duration */}
                                {entry.startTime && entry.endTime && (
                                  <span className="font-semibold text-blue-600 text-base font-mono bg-gray-100 px-2 py-0.5 rounded shadow-sm">{entry.startTime} - {entry.endTime}</span>
                                )}
                                <div className="flex gap-1 mt-2">
                                  <Button size="sm" variant="outline">
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => deleteEntry(entry.id)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Add Entry Modal */}
            {showAddEntry && (
              <Card className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Add Time Entry</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAddEntry(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <Label>Project</Label>
                      <div className="flex gap-2">
                        <Select
                          value={newEntry.project}
                          onValueChange={value => setNewEntry(prev => ({ ...prev, project: value }))}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select previous project" />
                          </SelectTrigger>
                          <SelectContent>
                            {projects.filter(p => p.isActive).map((project) => (
                              <SelectItem key={project.id} value={project.name}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: project.color }}
                                  />
                                  {project.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="text"
                          placeholder="Or enter new project"
                          value={newEntry.project}
                          onChange={e => setNewEntry(prev => ({ ...prev, project: e.target.value }))}
                          className="flex-1"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Task</Label>
                      <Input
                        placeholder="What did you work on?"
                        value={newEntry.task}
                        onChange={(e) => setNewEntry(prev => ({ ...prev, task: e.target.value }))}
                      />
                    </div>

                    <div>
                      <Label>Description</Label>
                      <Textarea
                        placeholder="Add details..."
                        value={newEntry.description}
                        onChange={(e) => setNewEntry(prev => ({ ...prev, description: e.target.value }))}
                        rows={2}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Start Time</Label>
                        <Input
                          type="time"
                          value={newEntry.startTime}
                          onChange={(e) => setNewEntry(prev => ({ ...prev, startTime: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>End Time</Label>
                        <Input
                          type="time"
                          value={newEntry.endTime}
                          onChange={(e) => setNewEntry(prev => ({ ...prev, endTime: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Break Time (minutes)</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={newEntry.breakTime}
                        onChange={(e) => setNewEntry(prev => ({ ...prev, breakTime: e.target.value }))}
                      />
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button onClick={addManualEntry} className="flex-1">
                        <Save className="h-4 w-4 mr-2" />
                        Save Entry
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowAddEntry(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">This Week</p>
                      <p className="text-2xl font-bold text-blue-600">{formatDuration(weekTotal)}</p>
                    </div>
                    <BarChart3 className="h-8 w-8 text-blue-600" />
                  </div>
                  <Progress value={(weekTotal / (40 * 60)) * 100} className="mt-2" />
                  <p className="text-xs text-gray-500 mt-1">
                    {Math.round((weekTotal / (40 * 60)) * 100)}% of 40h target
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">This Month</p>
                      <p className="text-2xl font-bold text-green-600">{formatDuration(monthTotal)}</p>
                    </div>
                    <CalendarIcon className="h-8 w-8 text-green-600" />
                  </div>
                  <Progress value={(monthTotal / (160 * 60)) * 100} className="mt-2" />
                  <p className="text-xs text-gray-500 mt-1">
                    {Math.round((monthTotal / (160 * 60)) * 100)}% of 160h target
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Daily Average</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {formatDuration(Math.floor(weekTotal / 7))}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-purple-600" />
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    Based on this week's data
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}