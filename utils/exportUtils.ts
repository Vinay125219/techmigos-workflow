import type { Project, Task, Profile } from '@/types/database';

export interface AnalyticsData {
  projects: Project[];
  tasks: Task[];
  profiles: Profile[];
  dateRange: { start: Date; end: Date };
}

// Overload 1: Generic array export with custom filename
export function exportToCSV<T extends Record<string, unknown>>(data: T[], filename: string): void;
// Overload 2: Analytics data export with type specifier
export function exportToCSV(data: AnalyticsData, type: 'projects' | 'tasks' | 'summary'): void;
// Implementation
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[] | AnalyticsData,
  typeOrFilename: 'projects' | 'tasks' | 'summary' | string
): void {
  // Check if it's an array (generic export) or AnalyticsData
  if (Array.isArray(data)) {
    // Generic array export
    const csvContent = generateGenericCSV(data);
    const filename = typeOrFilename.endsWith('.csv') ? typeOrFilename : `${typeOrFilename}.csv`;
    downloadFile(csvContent, filename, 'text/csv');
    return;
  }

  // Analytics data export
  let csvContent = '';
  let filename = '';

  if (typeOrFilename === 'projects') {
    csvContent = generateProjectsCSV(data.projects);
    filename = `projects-report-${formatDateForFilename(new Date())}.csv`;
  } else if (typeOrFilename === 'tasks') {
    csvContent = generateTasksCSV(data.tasks);
    filename = `tasks-report-${formatDateForFilename(new Date())}.csv`;
  } else {
    csvContent = generateSummaryCSV(data);
    filename = `analytics-summary-${formatDateForFilename(new Date())}.csv`;
  }

  downloadFile(csvContent, filename, 'text/csv');
}

function generateGenericCSV<T extends Record<string, unknown>>(data: T[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const rows = data.map(item =>
    headers.map(header => escapeCsvValue(String(item[header] ?? ''))).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

function generateProjectsCSV(projects: Project[]): string {
  const headers = ['Name', 'Description', 'Category', 'Status', 'Priority', 'Progress', 'Start Date', 'End Date', 'Tasks', 'Completed Tasks'];
  const rows = projects.map(p => [
    escapeCsvValue(p.name),
    escapeCsvValue(p.description || ''),
    escapeCsvValue(p.category || ''),
    p.status,
    p.priority,
    `${p.progress}%`,
    p.start_date || '',
    p.end_date || '',
    p.task_count?.toString() || '0',
    p.completed_tasks?.toString() || '0',
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

function generateTasksCSV(tasks: Task[]): string {
  const headers = ['Title', 'Description', 'Status', 'Priority', 'Difficulty', 'Deadline', 'Estimated Hours', 'Skills', 'Assignee', 'Project'];
  const rows = tasks.map(t => [
    escapeCsvValue(t.title),
    escapeCsvValue(t.description || ''),
    t.status,
    t.priority,
    t.difficulty || '',
    t.deadline || '',
    t.estimated_hours?.toString() || '',
    escapeCsvValue(t.skills?.join('; ') || ''),
    escapeCsvValue(t.assignee?.full_name || 'Unassigned'),
    escapeCsvValue(t.project?.name || 'No Project'),
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

function generateSummaryCSV(data: AnalyticsData): string {
  const { projects, tasks } = data;

  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => p.status === 'active').length;
  const completedProjects = projects.filter(p => p.status === 'completed').length;

  const totalTasks = tasks.length;
  const openTasks = tasks.filter(t => t.status === 'open').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
  const reviewTasks = tasks.filter(t => t.status === 'review').length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;

  const avgProgress = projects.length > 0
    ? Math.round(projects.reduce((acc, p) => acc + p.progress, 0) / projects.length)
    : 0;

  const lines = [
    'Analytics Summary Report',
    `Generated: ${new Date().toLocaleDateString()}`,
    '',
    'Project Statistics',
    `Total Projects,${totalProjects}`,
    `Active Projects,${activeProjects}`,
    `Completed Projects,${completedProjects}`,
    `Average Progress,${avgProgress}%`,
    '',
    'Task Statistics',
    `Total Tasks,${totalTasks}`,
    `Open Tasks,${openTasks}`,
    `In Progress,${inProgressTasks}`,
    `In Review,${reviewTasks}`,
    `Completed Tasks,${completedTasks}`,
    `Completion Rate,${totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%`,
  ];

  return lines.join('\n');
}

export function exportToPDF(data: AnalyticsData): void {
  // Create a printable HTML document
  const html = generatePDFHTML(data);
  const printWindow = window.open('', '_blank');

  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

function generatePDFHTML(data: AnalyticsData): string {
  const { projects, tasks } = data;

  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => p.status === 'active').length;
  const completedProjects = projects.filter(p => p.status === 'completed').length;

  const totalTasks = tasks.length;
  const openTasks = tasks.filter(t => t.status === 'open').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;

  const avgProgress = projects.length > 0
    ? Math.round(projects.reduce((acc, p) => acc + p.progress, 0) / projects.length)
    : 0;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Analytics Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
        h1 { color: #1a1a2e; border-bottom: 2px solid #4361ee; padding-bottom: 10px; }
        h2 { color: #4361ee; margin-top: 30px; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-value { font-size: 32px; font-weight: bold; color: #4361ee; }
        .stat-label { color: #666; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background: #4361ee; color: white; }
        tr:nth-child(even) { background: #f8f9fa; }
        .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <h1>Analytics Report</h1>
      <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
      
      <h2>Summary</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${totalProjects}</div>
          <div class="stat-label">Total Projects</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${activeProjects}</div>
          <div class="stat-label">Active Projects</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalTasks}</div>
          <div class="stat-label">Total Tasks</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${avgProgress}%</div>
          <div class="stat-label">Avg Progress</div>
        </div>
      </div>

      <h2>Projects Overview</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Progress</th>
            <th>Tasks</th>
          </tr>
        </thead>
        <tbody>
          ${projects.slice(0, 10).map(p => `
            <tr>
              <td>${escapeHtml(p.name)}</td>
              <td>${p.status}</td>
              <td>${p.priority}</td>
              <td>${p.progress}%</td>
              <td>${p.task_count || 0}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h2>Task Distribution</h2>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Count</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Open</td><td>${openTasks}</td><td>${totalTasks > 0 ? Math.round((openTasks / totalTasks) * 100) : 0}%</td></tr>
          <tr><td>In Progress</td><td>${inProgressTasks}</td><td>${totalTasks > 0 ? Math.round((inProgressTasks / totalTasks) * 100) : 0}%</td></tr>
          <tr><td>Completed</td><td>${completedTasks}</td><td>${totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%</td></tr>
        </tbody>
      </table>

      <div class="footer">
        <p>This report was automatically generated by the Project Management System</p>
      </div>
    </body>
    </html>
  `;
}

function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateForFilename(date: Date): string {
  return date.toISOString().split('T')[0];
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
