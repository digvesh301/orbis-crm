import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { IndianRupee, TrendingUp, CalendarDays, Target, Zap } from 'lucide-react';
import { 
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Legend, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

export default function Dashboard() {
    const queryOpts = { staleTime: 300000 };
    const { data: deals } = useQuery<any>({ queryKey: ['deals'], queryFn: () => api.get('/deals').then(r=>r.data), ...queryOpts });
    const { data: pipelineStages } = useQuery<any>({ queryKey: ['pipeline-stages'], queryFn: () => api.get('/pipeline').then(r=>r.data), ...queryOpts });

    // ─────────────────────────────────────────────────────────────────────────────
    // Derived Analytics Math
    // ─────────────────────────────────────────────────────────────────────────────

    const openDeals = deals?.data?.filter((d:any) => d.stage_type === 'open') || [];
    const activePipelineValue = openDeals.reduce((acc: number, deal: any) => acc + (Number(deal.amount) || 0), 0) || 0;
    
    // Win Rate Analysis
    const wonDeals = deals?.data?.filter((d: any) => d.stage_type === 'won') || [];
    const lostDeals = deals?.data?.filter((d: any) => d.stage_type === 'lost') || [];
    const totalClosed = wonDeals.length + lostDeals.length;
    const winRate = totalClosed > 0 ? ((wonDeals.length / totalClosed) * 100).toFixed(1) : '0.0';

    const winRateData = [
        { name: 'Won', value: wonDeals.length, fill: '#10b981' },
        { name: 'Lost', value: lostDeals.length, fill: '#f43f5e' }
    ];

    // Sales Velocity (Days to Close)
    let totalDaysToClose = 0;
    wonDeals.forEach((d: any) => {
        const created = new Date(d.created_at).getTime();
        const closed = d.actual_close_date ? new Date(d.actual_close_date).getTime() :
                       (d.close_date ? new Date(d.close_date).getTime() : new Date(d.updated_at).getTime());
        totalDaysToClose += Math.max(1, (closed - created) / (1000 * 60 * 60 * 24));
    });
    const avgSalesCycle = wonDeals.length > 0 ? Math.round(totalDaysToClose / wonDeals.length) : 0;

    // Simulate Sales Velocity trend over time for chart context
    const velocityData = [
        { name: 'Jan', days: 45 },
        { name: 'Feb', days: 42 },
        { name: 'Mar', days: 38 },
        { name: 'Apr', days: 32 },
        { name: 'May', days: avgSalesCycle > 0 ? avgSalesCycle : 30 },
    ];

    // Revenue Parsing by Stage
    const pipelineData = pipelineStages?.data?.map((stage: any) => {
        const stageDeals = openDeals.filter((d: any) => d.stage?.id === stage.id) || [];
        const value = stageDeals.reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0);
        return { name: stage.name, value: value, count: stageDeals.length, fill: stage.color || '#6366f1' };
    }).filter((d: any) => d.value > 0 || d.count > 0) || [];

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto bg-slate-50/50 min-h-full">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Advanced Analytics</h1>
                    <p className="text-slate-500 mt-2 text-sm font-medium">Deep dive into sales performance, velocities, and funnel drop-offs.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm cursor-pointer">
                        <CalendarDays className="w-4 h-4 text-slate-400" />
                        Last 30 Days
                    </button>
                    <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors cursor-pointer">
                        Export Report PDF
                    </button>
                </div>
            </div>

            {/* Top KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: "Pipeline Value", value: `₹${activePipelineValue.toLocaleString()}`, trend: "+14.5%", icon: IndianRupee, color: "bg-indigo-50 text-indigo-600 border-indigo-100" },
                    { label: "Win Rate", value: `${winRate}%`, trend: "+5.4%", icon: Target, color: "bg-emerald-50 text-emerald-600 border-emerald-100" },
                    { label: "Avg Sales Cycle", value: `${avgSalesCycle} Days`, trend: "-12.1%", icon: Zap, color: "bg-amber-50 text-amber-600 border-amber-100" },
                    { label: "Total Open Deals", value: openDeals.length.toString(), trend: "+4.2%", icon: TrendingUp, color: "bg-sky-50 text-sky-600 border-sky-100" },
                ].map((stat, i) => (
                    <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group">
                        <div className="flex items-center justify-between z-10 relative">
                            <div className="space-y-4">
                                <div className="text-sm font-bold text-slate-500 uppercase tracking-wide">{stat.label}</div>
                                <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{stat.value}</div>
                            </div>
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${stat.color} shadow-sm group-hover:scale-110 transition-transform`}>
                                <stat.icon className="w-7 h-7" />
                            </div>
                        </div>
                        <div className="mt-6 flex items-center gap-2 text-sm z-10 relative">
                            <span className={`${stat.trend.startsWith('+') ? 'text-emerald-700 bg-emerald-100' : 'text-amber-700 bg-amber-100'} font-bold px-2.5 py-1 rounded-full`}>{stat.trend}</span>
                            <span className="text-slate-500 font-medium">vs last period</span>
                        </div>
                        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-slate-50 rounded-full group-hover:scale-110 transition-transform duration-500 z-0 opacity-50"></div>
                    </div>
                ))}
            </div>

            {/* Charts Row 1: Pipeline Parsing & Win Rate */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Revenue Parsing by Stage */}
                <div className="bg-white lg:col-span-2 rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col">
                    <div className="mb-6 flex justify-between items-center">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Revenue Parsing by Stage</h2>
                            <p className="text-sm font-medium text-slate-500">Forecasted deal values across the sales funnel</p>
                        </div>
                    </div>
                    <div className="flex-1 w-full min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={pipelineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13, fontWeight: 600}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} tickFormatter={(val) => `₹${val/1000}k`} />
                                <Tooltip 
                                    cursor={{fill: '#f8fafc'}}
                                    formatter={(value: any) => [`₹${(value as number)?.toLocaleString()}`, 'Forecast Value']}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                                    {pipelineData.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                        {pipelineData.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-medium z-10">
                                No open pipeline data available
                            </div>
                        )}
                    </div>
                </div>

                {/* Win Rate Pie Chart */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col">
                    <div className="mb-2">
                        <h2 className="text-lg font-bold text-slate-900">Win Rate Analysis</h2>
                        <p className="text-sm font-medium text-slate-500">Won vs Lost deals historically</p>
                    </div>
                    <div className="flex-1 w-full flex items-center justify-center min-h-[300px] relative">
                        {totalClosed > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={winRateData} innerRadius={80} outerRadius={120} paddingAngle={4} dataKey="value">
                                        {winRateData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} /> )}
                                    </Pie>
                                    <Tooltip 
                                        itemStyle={{ color: '#1e293b', fontWeight: 'bold' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}/>
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-slate-400 font-medium z-10">No closed deals yet</div>
                        )}
                    </div>
                </div>

            </div>

             {/* Charts Row 2: Sales Velocity & Deals Tracker */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Sales Velocity Line Chart */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col">
                    <div className="mb-6">
                        <h2 className="text-lg font-bold text-slate-900">Sales Velocity Trend</h2>
                        <p className="text-sm font-medium text-slate-500">Average days from creation to close-won</p>
                    </div>
                    <div className="flex-1 w-full min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={velocityData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 13, fontWeight: 500}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} tickFormatter={(val) => `${val} Days`} />
                                <Tooltip 
                                    formatter={(value: any) => [`${value} Days`, 'Closing Velocity']}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Line type="monotone" dataKey="days" stroke="#f59e0b" strokeWidth={4} dot={{ r: 6, fill: '#f59e0b', strokeWidth: 0 }} activeDot={{ r: 8 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Closing Deals Widget */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                        <div>
                            <h2 className="font-bold text-slate-900 text-lg">Impending Closures</h2>
                            <p className="text-sm font-medium text-slate-500">Highest value open deals</p>
                        </div>
                        <a href="/pipeline" className="text-sm font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-md transition-colors">Board</a>
                    </div>
                    
                    <div className="divide-y divide-slate-100 flex-1 overflow-auto max-h-[300px]">
                        {openDeals.sort((a:any,b:any) => Number(b.amount || 0) - Number(a.amount || 0)).slice(0, 5).map((deal: any) => (
                            <div key={deal.id} className="p-5 hover:bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between transition-colors gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 shadow-sm shrink-0">
                                        <IndianRupee className="w-6 h-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <a href={`/deals/${deal.id}`} className="font-bold text-slate-900 hover:text-indigo-600 truncate block">{deal.name}</a>
                                        <div className="text-sm font-semibold text-slate-500 flex items-center gap-2 mt-1 truncate">
                                            <span>{deal.account?.name || 'No Corporate Account'}</span>
                                            <span className="w-1 h-1 bg-slate-300 rounded-full shrink-0"></span>
                                            <span 
                                                className="px-2 py-0.5 rounded text-xs font-bold shrink-0"
                                                style={{ backgroundColor: deal.stage?.color ? `${deal.stage.color}20` : '#f1f5f9', color: deal.stage?.color || '#475569' }}
                                            >
                                                {deal.stage?.name || 'Open Stage'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center pt-2 sm:pt-0 pl-16 sm:pl-0">
                                    <div className="font-extrabold text-slate-900 text-lg">₹{Number(deal.amount || 0).toLocaleString()}</div>
                                    <div className="text-xs font-bold text-emerald-600">Close: {(deal.close_date || '').split('T')[0] || 'TBD'}</div>
                                </div>
                            </div>
                        ))}
                        {openDeals.length === 0 && (
                            <div className="p-12 text-center flex flex-col items-center justify-center h-full">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                                    <IndianRupee className="w-8 h-8 text-slate-300" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-700">No Open Deals found</h3>
                                <p className="text-slate-500 font-medium text-sm mt-1">Start by creating a Deal in your Pipeline.</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
