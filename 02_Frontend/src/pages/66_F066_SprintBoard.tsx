import { useState, useEffect } from 'react';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { FreshnessIndicator } from '../components/erp/FreshnessIndicator';

// Type definitions
interface KPI {
  total: number;
  in_progress: number;
  done: number;
  blocked: number;
  percent_complete: number;
  timestamp: string;
}

interface Feature {
  ticket: string;
  owner: string;
  status: string;
  created_at: string;
  file: string;
}

interface Ticket {
  ticket_id: string;
  owner: string;
  status: string;
  progress?: number;
}

interface Timelog {
  ticket: string;
  task: string;
  start: string;
  end?: string;
  duration: string;
  status: string;
}

// Main Component
export default function SprintBoard() {
  const [activeTab, setActiveTab] = useState<'features' | 'tickets' | 'agents'>('features');
  const [refreshCounter, setRefreshCounter] = useState(10);
  const [summary, setSummary] = useState<KPI | null>(null);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [tickets, setTickets] = useState<{ sprint: Ticket[]; backlog: Ticket[] }>({
    sprint: [],
    backlog: [],
  });
  const [agents, setAgents] = useState<Record<string, Timelog[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token') || '';
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const [summaryRes, featuresRes, ticketsRes, agentsRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/api/sprint/summary`, { headers }),
        fetch(`${import.meta.env.VITE_API_URL}/api/sprint/features`, { headers }),
        fetch(`${import.meta.env.VITE_API_URL}/api/sprint/tickets`, { headers }),
        fetch(`${import.meta.env.VITE_API_URL}/api/sprint/agents`, { headers }),
      ]);

      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (featuresRes.ok) setFeatures((await featuresRes.json()).features || []);
      if (ticketsRes.ok) setTickets(await ticketsRes.json());
      if (agentsRes.ok) setAgents((await agentsRes.json()).agents || {});
    } catch (err) {
      setError(`Failed to fetch sprint data: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh on mount and every 10 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshCounter((prev) => (prev === 0 ? 10 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !summary) {
    return (
      <ProtectedRoute requiredRole="isource_admin">
        <div className="p-6 flex items-center justify-center min-h-screen">
          <div className="text-gray-600">Loading sprint board...</div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="isource_admin">
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Sprint Board</h1>
              <p className="text-sm text-gray-600 mt-1">Real-time sprint execution dashboard</p>
            </div>
            <FreshnessIndicator erp_source_ids={[]} />
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
              {error}
            </div>
          )}

          {/* KPI Strip */}
          {summary && (
            <div className="grid grid-cols-5 gap-4 mb-8">
              <KPICard label="Total" value={summary.total} />
              <KPICard label="In Progress" value={summary.in_progress} color="blue" />
              <KPICard label="Done" value={summary.done} color="green" />
              <KPICard label="Blocked" value={summary.blocked} color="red" />
              <div className="bg-white p-4 rounded-lg border border-gray-200 flex flex-col justify-center">
                <div className="text-sm text-gray-600">Refresh in</div>
                <div className="text-2xl font-mono font-bold text-gray-900">{refreshCounter}s</div>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {summary && (
            <div className="mb-8 bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Sprint Progress</span>
                <span className="text-sm font-bold text-gray-900">{summary.percent_complete}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-gradient-to-r from-blue-500 to-green-500 h-4 rounded-full transition-all duration-500"
                  style={{ width: `${summary.percent_complete}%` }}
                />
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200 flex">
              {(['features', 'tickets', 'agents'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'features' && <FeaturesTab features={features} />}
              {activeTab === 'tickets' && <TicketsTab tickets={tickets} />}
              {activeTab === 'agents' && <AgentsTab agents={agents} />}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

// KPI Card Component
function KPICard({
  label,
  value,
  color,
}: {
  label: string;
  value?: number;
  color?: 'blue' | 'green' | 'red';
}) {
  const colorClass =
    color === 'blue'
      ? 'bg-blue-50 border-blue-200'
      : color === 'green'
        ? 'bg-green-50 border-green-200'
        : color === 'red'
          ? 'bg-red-50 border-red-200'
          : 'bg-gray-50 border-gray-200';

  const textColor =
    color === 'blue'
      ? 'text-blue-600'
      : color === 'green'
        ? 'text-green-600'
        : color === 'red'
          ? 'text-red-600'
          : 'text-gray-600';

  return (
    <div className={`${colorClass} p-4 rounded-lg border`}>
      <div className="text-sm text-gray-600 font-medium">{label}</div>
      <div className={`text-3xl font-bold ${textColor} mt-2`}>{value ?? '-'}</div>
    </div>
  );
}

// Features Tab
function FeaturesTab({ features }: { features: Feature[] }) {
  if (features.length === 0) {
    return <div className="text-center text-gray-500 py-8">No features in sprint</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Created</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Ticket</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Owner</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
          </tr>
        </thead>
        <tbody>
          {features.map((feature) => (
            <tr key={feature.file} className="border-b border-gray-200 hover:bg-gray-50">
              <td className="px-4 py-3 text-sm text-gray-600">{feature.created_at}</td>
              <td className="px-4 py-3 text-sm font-mono font-bold text-blue-600">
                {feature.ticket}
              </td>
              <td className="px-4 py-3 text-sm text-gray-700">{feature.owner}</td>
              <td className="px-4 py-3 text-sm">
                <StatusBadge status={feature.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Tickets Tab
function TicketsTab({ tickets }: { tickets: { sprint: Ticket[]; backlog: Ticket[] } }) {
  const allTickets = [...tickets.sprint, ...tickets.backlog];

  if (allTickets.length === 0) {
    return <div className="text-center text-gray-500 py-8">No tickets in sprint</div>;
  }

  return (
    <div>
      <h3 className="font-bold text-lg mb-4 text-gray-900">Sprint Tickets</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Ticket</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Owner</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Progress</th>
            </tr>
          </thead>
          <tbody>
            {allTickets.map((ticket) => (
              <tr key={ticket.ticket_id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-mono font-bold text-blue-600">
                  {ticket.ticket_id}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{ticket.owner || '-'}</td>
                <td className="px-4 py-3 text-sm">
                  <StatusBadge status={ticket.status} />
                </td>
                <td className="px-4 py-3 text-sm">
                  <ProgressBar percent={ticket.progress || 0} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Agents Tab
function AgentsTab({ agents }: { agents: Record<string, Timelog[]> }) {
  const agentList = Object.entries(agents);

  if (agentList.length === 0) {
    return <div className="text-center text-gray-500 py-8">No agent timelogs</div>;
  }

  return (
    <div>
      <h3 className="font-bold text-lg mb-6 text-gray-900">Agent Workload</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {agentList.map(([agentId, timelogs]) => (
          <AgentCard key={agentId} agentId={agentId} timelogs={timelogs} />
        ))}
      </div>

      <h3 className="font-bold text-lg mb-4 text-gray-900">Timelogs</h3>
      <div className="overflow-x-auto">
        <TimelognTable agents={agents} />
      </div>
    </div>
  );
}

// Agent Card Component
function AgentCard({ agentId, timelogs }: { agentId: string; timelogs: Timelog[] }) {
  const currentWork = timelogs[0];
  const totalHours = timelogs
    .reduce((sum, t) => {
      const match = (t.duration || '0').match(/(\d+)/);
      return sum + (match ? parseInt(match[1]) : 0);
    }, 0);

  return (
    <div className="border border-gray-200 p-4 rounded-lg bg-white hover:shadow-md transition-shadow">
      <h4 className="font-bold text-sm text-gray-900 mb-2">{agentId}</h4>
      <div className="text-xs text-gray-600 space-y-2">
        <div>
          {currentWork ? (
            <>
              <div className="font-medium text-gray-700">Current Work</div>
              <div className="text-gray-600">{currentWork.ticket}: {currentWork.task}</div>
            </>
          ) : (
            <div className="text-gray-500 italic">Idle</div>
          )}
        </div>
        <div className="border-t border-gray-200 pt-2">
          <div className="font-medium text-gray-700">Total Hours</div>
          <div className="text-gray-600">{totalHours}h</div>
        </div>
      </div>
    </div>
  );
}

// Timelog Table Component
function TimelognTable({ agents }: { agents: Record<string, Timelog[]> }) {
  const allLogs = Object.entries(agents).flatMap(([agentId, logs]) =>
    logs.map((log) => ({ agentId, ...log }))
  );

  if (allLogs.length === 0) {
    return <div className="text-center text-gray-500 py-8">No timelogs</div>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-200">
          <th className="px-4 py-3 text-left font-semibold text-gray-700">Agent</th>
          <th className="px-4 py-3 text-left font-semibold text-gray-700">Ticket</th>
          <th className="px-4 py-3 text-left font-semibold text-gray-700">Task</th>
          <th className="px-4 py-3 text-left font-semibold text-gray-700">Duration</th>
          <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
        </tr>
      </thead>
      <tbody>
        {allLogs.map((log, i) => (
          <tr key={`${log.agentId}-${i}`} className="border-b border-gray-200 hover:bg-gray-50">
            <td className="px-4 py-3 font-mono text-gray-700">{log.agentId}</td>
            <td className="px-4 py-3 font-mono font-bold text-blue-600">{log.ticket}</td>
            <td className="px-4 py-3 text-gray-600">{log.task}</td>
            <td className="px-4 py-3 text-gray-600">{log.duration}</td>
            <td className="px-4 py-3">
              <StatusBadge status={log.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    'In Progress': 'bg-blue-100 text-blue-800',
    'Done': 'bg-green-100 text-green-800',
    'Blocked': 'bg-red-100 text-red-800',
    'Planned': 'bg-gray-100 text-gray-800',
    'in_progress': 'bg-blue-100 text-blue-800',
    'done': 'bg-green-100 text-green-800',
    'blocked': 'bg-red-100 text-red-800',
    'backlog': 'bg-gray-100 text-gray-800',
    'completed': 'bg-green-100 text-green-800',
  };

  const style = styles[status] || styles['Planned'];

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${style}`}>
      {status}
    </span>
  );
}

// Progress Bar Component
function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
      <div
        className="bg-gradient-to-r from-blue-500 to-blue-600 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white transition-all duration-300"
        style={{ width: `${Math.max(percent, 5)}%` }}
      >
        {percent > 10 && `${percent}%`}
      </div>
    </div>
  );
}
