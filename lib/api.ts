// frontend/lib/api.ts

// Simple wrapper around the FastAPI backend.
// The base URL can be configured via NEXT_PUBLIC_API_BASE_URL env variable.

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// --------------- Timesheet -----------------

export interface TimesheetEntryInput {
  employee: string;
  date: string; // dd-mm-yyyy
  project: string;
  task_description: string;
  duration_hours: number;
  break_minutes?: number;
}

export interface BackendTimesheetEntry {
  row: number;
  employee: string;
  date: string; // dd-mm-yyyy
  project: string;
  task_description: string;
  duration_hours: number;
  break_minutes: number;
}

export async function fetchTimesheets(employee: string): Promise<BackendTimesheetEntry[]> {
  const url = `${API_BASE}/timesheets/?employee=${encodeURIComponent(employee)}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`Failed to fetch timesheets: ${res.status}`);
  }
  return res.json();
}

export async function createTimesheetEntry(
  payload: TimesheetEntryInput,
): Promise<{ row: number; status: string }> {
  const res = await fetch(`${API_BASE}/timesheets/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let msg = `status ${res.status}`;
    try {
      const data = await res.json();
      msg = data?.detail || JSON.stringify(data);
    } catch {
      const txt = await res.text();
      msg = txt;
    }
    throw new Error(`Failed to create entry: ${msg}`);
  }
  return res.json();
}

export async function fetchTimesheetsFiltered(
  params: {
    employee: string;
    start_date?: string; // dd-mm-yyyy
    end_date?: string;   // dd-mm-yyyy
  }
): Promise<BackendTimesheetEntry[]> {
  const qp = new URLSearchParams();
  qp.append('employee', params.employee);
  if (params.start_date) qp.append('start_date', params.start_date);
  if (params.end_date) qp.append('end_date', params.end_date);
  const res = await fetch(`${API_BASE}/timesheets/?${qp.toString()}`, { next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`Failed to fetch timesheets: ${res.status}`);
  }
  return res.json();
}

export async function fetchTimesheetSummary(employee: string, period: 'week' | 'month' = 'week') {
  const url = `${API_BASE}/timesheets/summary?employee=${encodeURIComponent(employee)}&period=${period}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`Failed to fetch summary: ${res.status}`);
  }
  return res.json();
}

export interface LeaveEntry {
  employee: string;
  leave_type: string;
  duration: string;
  status: string;
  applied_date: string;
}

export async function deleteTimesheetEntry(rowId: string) {
  const response = await fetch(`${API_BASE}/timesheets/${rowId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    let errorMsg = 'Failed to delete entry';
    try {
      const errorData = await response.json();
      errorMsg = errorData.detail || errorMsg;
    } catch (e) {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return response.json();
}
export async function fetchLeaves(): Promise<LeaveEntry[]> {
  const res = await fetch(`${API_BASE}/leaves/`, { next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`Failed to fetch leaves: ${res.status}`);
  }
  return res.json();
} 