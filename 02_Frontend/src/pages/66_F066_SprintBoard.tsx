import { useState, useEffect } from 'react';
import { api } from '../api/client';

interface Summary {
  total_tickets: number;
  done: number;
  in_progress: number;
  pending: number;
  blocked: number;
  avg_progress_pct: number;
  sprint_name: string;
  sprint_start: string;
  sprint_end: string;
}

interface Ticket {
  ticket_id: string;
  title: string;
  status: string;
  progress_pct: number;
  owner_display: string;
  priority: string;
  source: 'sprint' | 'backlog';
}

interface Agent {
  id: string;
  display_name: string;
  role: string;
  active_ticket: string | null;
  active_ticket_title: string | null;
  completed_sessions: number;
  in_progress_sessions: number;
  timelog: Array<{
    ticket: string;
    task: string;
    duration: string;
    status: string;
    start: string;
    end: string | null;
  }>;
}

export default function SprintBoard() {
  const [activeTab, setActiveTab] = useState<'features' | 'tickets' | 'agents'>('features');
  const [refreshCounter, setRefreshCounter] = useState(10);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [features, setFeatures] = useState<any[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [summaryData, featuresData, ticketsData, agentsData] = await Promise.all([
          api.sprint.summary(),
          api.sprint.features(),
          api.sprint.tickets(),
          api.sprint.agents(),
        ]);
        setSummary(summaryData);
        setFeatures(featuresData);
        setTickets(ticketsData);
        setAgents(agentsData);
      } catch {
        // Silently fail on data fetch; UI will show empty state
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Auto-refresh countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshCounter((prev) => (prev === 1 ? 10 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const summary_data = summary as Summary | undefined;
  const features_data = (features as any[]) || [];
  const tickets_data = (tickets as Ticket[]) || [];
  const agents_data = (agents as Agent[]) || [];

  const sprintTickets = tickets_data.filter((t) => t.source === 'sprint');
  const backlogTickets = tickets_data.filter((t) => t.source === 'backlog');

  return (
    <div className="p-6 bg-white">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Sprint Board</h1>
        <p className="text-sm text-gray-500 mt-1">
          {summary_data?.sprint_name} • {summary_data?.sprint_start} to {summary_data?.sprint_end}
        </p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <KPICard label="Total" value={summary_data?.total_tickets} />
        <KPICard label="In Progress" value={summary_data?.in_progress} color="blue" />
        <KPICard label="Done" value={summary_data?.done} color="green" />
        <KPICard label="Pending" value={summary_data?.pending} color="yellow" />
        <KPICard label="Blocked" value={summary_data?.blocked} color="red" />
      </div>

      {/* Progress Bar */}
      {summary_data && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-700">Overall Progress</h3>
            <span className="text-sm font-bold text-blue-600">{summary_data.avg_progress_pct}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${summary_data.avg_progress_pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Auto-refresh indicator */}
      <div className="text-xs text-gray-500 mb-6 text-right">
        Auto-refresh in {refreshCounter}s
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {(['features', 'tickets', 'agents'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-medium text-sm transition-colors ${
              activeTab === tab
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)} ({
              tab === 'features' ? features_data.length :
              tab === 'tickets' ? sprintTickets.length :
              agents_data.length
            })
          </button>
        ))}
      </div>

      {/* Features Tab */}
      {activeTab === 'features' && (
        <div>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading features...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Ticket</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Title</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Owner</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {features_data.map((f: any, i) => (
                    <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-blue-600 font-medium">{f.ticket_id}</td>
                      <td className="px-4 py-3 text-gray-900">{f.title}</td>
                      <td className="px-4 py-3 text-gray-600">{f.owner}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={f.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{f.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tickets Tab */}
      {activeTab === 'tickets' && (
        <div>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading tickets...</div>
          ) : (
            <div>
              {/* Sprint Tickets */}
              <div className="mb-8">
                <h3 className="font-semibold text-gray-900 mb-4">Sprint Tickets ({sprintTickets.length})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Ticket</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Title</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Owner</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sprintTickets.map((t, i) => (
                        <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-blue-600 font-medium">{t.ticket_id}</td>
                          <td className="px-4 py-3 text-gray-900">{t.title}</td>
                          <td className="px-4 py-3 text-gray-600">{t.owner_display}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={t.status} />
                          </td>
                          <td className="px-4 py-3">
                            <ProgressBar percent={t.progress_pct} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Backlog Tickets */}
              {backlogTickets.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Backlog ({backlogTickets.length})</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Ticket</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Title</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Owner</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {backlogTickets.map((t, i) => (
                          <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-blue-600 font-medium">{t.ticket_id}</td>
                            <td className="px-4 py-3 text-gray-900">{t.title}</td>
                            <td className="px-4 py-3 text-gray-600">{t.owner_display}</td>
                            <td className="px-4 py-3 text-gray-500">—</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Agents Tab */}
      {activeTab === 'agents' && (
        <div>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading agents...</div>
          ) : (
            <div>
              {/* Agent Cards Grid */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                {agents_data.map((agent) => (
                  <div key={agent.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <h4 className="font-semibold text-gray-900">{agent.display_name}</h4>
                    <p className="text-xs text-gray-500 mb-3">{agent.role}</p>
                    {agent.active_ticket ? (
                      <div className="bg-blue-50 p-2 rounded text-xs mb-3">
                        <p className="text-blue-600 font-mono font-medium">{agent.active_ticket}</p>
                        <p className="text-gray-600">{agent.active_ticket_title}</p>
                      </div>
                    ) : (
                      <div className="bg-gray-50 p-2 rounded text-xs mb-3 text-gray-500 italic">Idle</div>
                    )}
                    <div className="flex gap-4 text-xs">
                      <div>
                        <p className="text-gray-500">Completed</p>
                        <p className="font-bold text-green-600">{agent.completed_sessions}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">In Progress</p>
                        <p className="font-bold text-blue-600">{agent.in_progress_sessions}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Timelogs Table */}
              <h3 className="font-semibold text-gray-900 mb-4">Timelogs</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Agent</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Ticket</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Task</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Start</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Duration</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents_data.flatMap((agent) =>
                      agent.timelog.map((entry, i) => (
                        <tr key={`${agent.id}-${i}`} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-gray-600">{agent.display_name}</td>
                          <td className="px-4 py-3 font-mono text-blue-600">{entry.ticket}</td>
                          <td className="px-4 py-3 text-gray-600">{entry.task}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{entry.start}</td>
                          <td className="px-4 py-3 font-medium text-gray-700">{entry.duration}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={entry.status} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper components
function KPICard({ label, value, color }: { label: string; value?: number; color?: string }) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    red: 'bg-red-50 border-red-200',
    default: 'bg-gray-50 border-gray-200',
  };
  const colorKey = (color || 'default') as keyof typeof colorClasses;
  const bgClass = colorClasses[colorKey] || colorClasses.default;

  return (
    <div className={`${bgClass} border rounded-lg p-4`}>
      <div className="text-xs font-medium text-gray-600 mb-2">{label}</div>
      <div className="text-2xl font-bold text-gray-900">{value ?? '-'}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    'In Progress': 'bg-blue-100 text-blue-800',
    'Done': 'bg-green-100 text-green-800',
    'Completed': 'bg-green-100 text-green-800',
    'Blocked': 'bg-red-100 text-red-800',
    'Pending': 'bg-gray-100 text-gray-800',
    'Planned': 'bg-gray-100 text-gray-800',
    'Queued': 'bg-yellow-100 text-yellow-800',
  };
  const colorClass = colors[status] || 'bg-gray-100 text-gray-800';

  return (
    <span className={`${colorClass} px-2 py-1 rounded text-xs font-semibold`}>
      {status}
    </span>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-8 text-right">{percent}%</span>
    </div>
  );
}
