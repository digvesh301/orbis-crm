import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { FileText, IndianRupee, CheckCircle, Clock } from 'lucide-react';

export default function QuotesList() {
    const { data: quotes, isLoading } = useQuery({
        queryKey: ['quotes'],
        queryFn: async () => {
            const res = await api.get('/quotes');
            return res.data;
        }
    });

    if (isLoading) return <div className="p-8 font-medium text-slate-500">Loading quotes...</div>;

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                        <FileText className="w-6 h-6 text-indigo-500" /> Quotes & Proposals
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Send and track pricing to your prospects.</p>
                </div>
                <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors cursor-pointer">
                    New Quote
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <th className="py-4 px-6">Quote Number & Subject</th>
                            <th className="py-4 px-6 hidden md:table-cell">Account / Contact</th>
                            <th className="py-4 px-6 hidden sm:table-cell">Status</th>
                            <th className="py-4 px-6 text-right">Total Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                        {quotes?.data?.map((quote: any) => (
                            <tr key={quote.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer">
                                <td className="py-4 px-6">
                                    <div className="font-bold text-slate-900">{quote.subject}</div>
                                    <div className="text-slate-400 font-medium text-xs mt-0.5 font-mono">
                                        {quote.quote_number}
                                        <span className="ml-2 text-slate-500">· {new Date(quote.created_at).toLocaleDateString()}</span>
                                    </div>
                                </td>
                                <td className="py-4 px-6 hidden md:table-cell">
                                    <div className="font-semibold text-slate-700">{quote.account?.name || quote.contact?.name || '—'}</div>
                                </td>
                                <td className="py-4 px-6 hidden sm:table-cell">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${
                                        quote.status === 'accepted' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                        quote.status === 'sent' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                                        quote.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                        'bg-slate-100 text-slate-600 border-slate-200'
                                    } border rounded-full text-[10px] font-bold uppercase tracking-wider`}>
                                        {quote.status === 'accepted' && <CheckCircle className="w-3 h-3" />}
                                        {quote.status === 'sent' && <Clock className="w-3 h-3" />}
                                        {quote.status || 'Draft'}
                                    </span>
                                </td>
                                <td className="py-4 px-6 text-right">
                                    <div className="font-extrabold text-slate-800 flex items-center justify-end">
                                        <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
                                        {Number(quote.total_amount || 0).toLocaleString()}
                                    </div>
                                    <div className="text-slate-400 text-xs font-semibold mt-0.5" title="Valid until">
                                        Valid: {quote.valid_until ? new Date(quote.valid_until).toLocaleDateString() : 'N/A'}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {(!quotes?.data || quotes.data.length === 0) && (
                            <tr>
                                <td colSpan={4} className="py-16 text-center text-slate-500">
                                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <FileText className="w-6 h-6 text-slate-300" />
                                    </div>
                                    <div className="font-bold text-slate-700">No quotes found</div>
                                    <div className="text-sm mt-1">Start drafting proposals for your prospective deals.</div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
