import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Magnet, TrendingUp, Filter, Download } from 'lucide-react';
import { exportToCsv } from '../../lib/exportUtils';
import LeadModal from './LeadModal';

export default function LeadsList() {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { data: leads, isLoading } = useQuery({
        queryKey: ['leads'],
        queryFn: async () => {
            const res = await api.get('/leads');
            return res.data;
        }
    });

    if (isLoading) return <div className="p-8">Loading leads...</div>;

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Leads</h1>
                    <p className="text-slate-500 mt-1">Potential customers that need qualification.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium shadow-sm transition-colors cursor-pointer flex items-center gap-2">
                        <Filter className="w-4 h-4" /> Filter
                    </button>
                    <button 
                        onClick={() => exportToCsv('/leads', 'leads_export')}
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium shadow-sm transition-colors cursor-pointer flex items-center gap-2">
                        <Download className="w-4 h-4" /> Export CSV
                    </button>
                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors cursor-pointer">
                        Add Lead
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                {/* Stats Row */}
                {[
                    { label: "Total Active Leads", value: leads?.data?.length || 0, trend: "+12%" },
                    { label: "New Leads (Today)", value: 4, trend: "+2%" },
                    { label: "Conversion Rate", value: "24%", trend: "+5%" },
                    { label: "Uncontacted Leads", value: leads?.data?.filter((l:any)=>l.status==='new').length || 0, trend: "-1%" }
                ].map((stat, i) => (
                    <div key={i} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col gap-2">
                        <div className="text-sm font-medium text-slate-500">{stat.label}</div>
                        <div className="text-3xl font-bold text-slate-900 flex items-center justify-between">
                            {stat.value}
                            <span className="text-xs font-semibold px-2 py-1 rounded bg-emerald-50 text-emerald-600 flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" /> {stat.trend}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-sm font-medium text-slate-500">
                            <th className="py-4 px-6 font-medium">Lead Name</th>
                            <th className="py-4 px-6 font-medium">Company</th>
                            <th className="py-4 px-6 font-medium hidden md:table-cell">Status</th>
                            <th className="py-4 px-6 font-medium hidden lg:table-cell">Source</th>
                            <th className="py-4 px-6 font-medium text-right">Owner</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                        {leads?.data?.map((lead: any) => (
                            <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer">
                                <td className="py-4 px-6">
                                    <div className="font-semibold text-slate-900">{lead.first_name} {lead.last_name}</div>
                                    <div className="text-slate-500">{lead.email}</div>
                                </td>
                                <td className="py-4 px-6 text-slate-700">
                                    {lead.company || '—'}
                                </td>
                                <td className="py-4 px-6 hidden md:table-cell">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border
                                        ${lead.status === 'new' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                                          lead.status === 'contacted' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                          lead.status === 'qualified' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                          'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                        {lead.status ? lead.status.charAt(0).toUpperCase() + lead.status.slice(1) : 'New'}
                                    </span>
                                </td>
                                <td className="py-4 px-6 text-slate-600 hidden lg:table-cell uppercase text-xs tracking-wider font-medium">
                                    {lead.lead_source?.replace('_', ' ') || 'ORGANIC'}
                                </td>
                                <td className="py-4 px-6 text-right">
                                    <div className="text-slate-600">{lead.owner?.name}</div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {leads?.data?.length === 0 && (
                    <div className="text-center py-24 text-slate-500">
                        <Magnet className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        No leads to show. Bring in some new prospects!
                    </div>
                )}
            </div>

            <LeadModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    );
}
