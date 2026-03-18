import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { IndianRupee, Layers, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { exportToCsv } from '../../lib/exportUtils';
import DealDetail from './DealDetail';
import DealModal from './DealModal';

function DealsList() {
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const { data: deals, isLoading } = useQuery({
        queryKey: ['deals'],
        queryFn: async () => {
            const res = await api.get('/deals');
            return res.data;
        }
    });

    if (isLoading) return <div className="p-8">Loading deals...</div>;

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Deals (Opportunities)</h1>
                    <p className="text-slate-500 mt-1">Manage active sales, track revenue and negotiate with prospects.</p>
                </div>
                <div className="flex items-center gap-3">
                    <a href="/pipeline" className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2 cursor-pointer">
                        <Layers className="w-4 h-4" /> Kanban Board
                    </a>
                    <button 
                        onClick={() => exportToCsv('/deals', 'deals_export')}
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium shadow-sm transition-colors cursor-pointer flex items-center gap-2">
                        <Download className="w-4 h-4" /> Export CSV
                    </button>
                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors cursor-pointer">
                        Create Deal
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-sm font-medium text-slate-500">
                            <th className="py-4 px-6 font-medium">Deal Name</th>
                            <th className="py-4 px-6 font-medium">Amount</th>
                            <th className="py-4 px-6 font-medium hidden md:table-cell">Stage</th>
                            <th className="py-4 px-6 font-medium hidden lg:table-cell">Close Date</th>
                            <th className="py-4 px-6 font-medium text-right">Owner</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                        {deals?.data?.map((deal: any) => (
                            <tr key={deal.id} onClick={() => navigate(`/deals/${deal.id}`)} className="hover:bg-slate-50/50 transition-colors group cursor-pointer">
                                <td className="py-4 px-6">
                                    <div className="font-semibold text-slate-900">{deal.name}</div>
                                    <div className="text-slate-500">{deal.account?.name || deal.contact?.name || '—'}</div>
                                </td>
                                <td className="py-4 px-6">
                                    <div className="font-bold text-slate-800 flex items-center gap-1">
                                        <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
                                        {Number(deal.amount || 0).toLocaleString()}
                                    </div>
                                    <div className="text-slate-400 text-xs mt-0.5">Prob: {deal.probability || 0}%</div>
                                </td>
                                <td className="py-4 px-6 hidden md:table-cell">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border
                                        ${deal.stage_type === 'won' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                          deal.stage_type === 'lost' ? 'bg-red-50 text-red-700 border-red-200' :
                                          'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                        {deal.stage_type === 'won' && <CheckCircle2 className="w-3.5 h-3.5" />}
                                        {deal.stage_type === 'lost' && <AlertCircle className="w-3.5 h-3.5" />}
                                        {deal.stage?.name || 'Open'}
                                    </span>
                                </td>
                                <td className="py-4 px-6 text-slate-600 hidden lg:table-cell">
                                    {deal.close_date ? new Date(deal.close_date).toLocaleDateString() : '—'}
                                </td>
                                <td className="py-4 px-6 text-right">
                                    <div className="text-slate-600">{deal.owner?.name}</div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {deals?.data?.length === 0 && (
                    <div className="text-center py-24 text-slate-500">
                        <IndianRupee className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        No deals yet. Start closing some business!
                    </div>
                )}
            </div>

            <DealModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    );
}

export default function DealsRouter() {
    return (
        <Routes>
            <Route path="/" element={<DealsList />} />
            <Route path="/:id" element={<DealDetail />} />
        </Routes>
    );
}
