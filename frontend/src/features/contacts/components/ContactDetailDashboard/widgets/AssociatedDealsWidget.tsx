import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../../lib/api';
import { useNavigate } from 'react-router-dom';
import { Handshake, ChevronRight, Loader2 } from 'lucide-react';
import { usePermissions } from '../../../../../hooks/usePermissions';

export default function AssociatedDealsWidget({ contactId }: { contactId: string }) {
    const navigate = useNavigate();
    const { canRead } = usePermissions();

    const { data: dealsRes, isLoading } = useQuery({
        queryKey: ['contact-deals-widget', contactId],
        queryFn: async () => {
            const res = await api.get(`/deals?contact_id=${contactId}`);
            return res.data;
        },
        enabled: canRead
    });

    if (!canRead) return <div className="text-center p-4 text-rose-500 text-sm font-bold bg-rose-50 rounded-lg">Permission Denied</div>;

    if (isLoading) return <div className="flex items-center justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>;

    const deals = dealsRes?.data || [];

    if (deals.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center py-6">
                 <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mb-3 border border-slate-100">
                    <Handshake className="w-5 h-5 text-slate-300" />
                </div>
                <p className="font-semibold text-sm">No Active Pipeline</p>
                <button className="mt-3 text-indigo-600 text-sm font-bold hover:underline">Create Deal</button>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {deals.slice(0, 3).map((deal: any) => (
                <div 
                    key={deal.id} 
                    onClick={() => navigate(`/deals/${deal.id}`)}
                    className="group border border-slate-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-md transition-all bg-white cursor-pointer flex justify-between items-center"
                >
                    <div className="flex-1 min-w-0 pr-4">
                        <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">{deal.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                            <span 
                                className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                                style={{ backgroundColor: deal.stage?.color ? `${deal.stage.color}15` : '#f1f5f9', color: deal.stage?.color || '#475569' }}
                            >
                                {deal.stage?.name || 'Open'}
                            </span>
                            <span className="text-xs font-semibold text-slate-400">
                                {deal.close_date ? new Date(deal.close_date).toLocaleDateString() : 'TBD'}
                            </span>
                        </div>
                    </div>
                    <div className="text-right flex items-center gap-2">
                        <div className="font-extrabold text-slate-800 items-center justify-end text-sm">
                            ₹{Number(deal.amount || 0).toLocaleString()}
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                    </div>
                </div>
            ))}
            
            {deals.length > 3 && (
                <button className="w-full text-center py-2 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors uppercase tracking-wider">
                    View All {deals.length} Deals
                </button>
            )}
        </div>
    );
}
