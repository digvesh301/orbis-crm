import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { IndianRupee, ArrowLeft, Mail, FileText, Clock, Loader2, Plus } from 'lucide-react';
import { NotesTimeline } from '../../components/shared/NotesTimeline';
import { EmailComposerModal } from '../../components/shared/EmailComposerModal';

export default function DealDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'details' | 'notes' | 'emails' | 'quotes'>('details');
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

    const { data: dealRes, isLoading: loadingDeal } = useQuery({
        queryKey: ['deal', id],
        queryFn: async () => {
            const res = await api.get(`/deals/${id}`);
            return res.data;
        }
    });

    const { data: emailsRes, isLoading: loadingEmails } = useQuery({
        queryKey: ['deal-emails', id],
        queryFn: async () => {
            const res = await api.get(`/emails?linked_module=deals&linked_record_id=${id}`);
            return res.data;
        },
        enabled: activeTab === 'emails'
    });

    const { data: quotesRes, isLoading: loadingQuotes } = useQuery({
        queryKey: ['deal-quotes', id],
        queryFn: async () => {
            const res = await api.get(`/quotes?opportunity_id=${id}`);
            return res.data;
        },
        enabled: activeTab === 'quotes'
    });

    if (loadingDeal) {
        return (
            <div className="h-full flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    const deal = dealRes?.data;
    if (!deal) return <div className="p-8">Deal not found</div>;

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* Header Section */}
            <div className="bg-white border-b border-slate-200 px-8 py-6 shrink-0 z-10 sticky top-0">
                <button 
                    onClick={() => navigate('/deals')}
                    className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 mb-4 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Deals
                </button>
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{deal.name}</h1>
                            <span 
                                className="px-3 py-1 rounded-full text-xs font-bold border"
                                style={{ 
                                    backgroundColor: deal.stage?.color ? `${deal.stage.color}15` : '#f1f5f9', 
                                    color: deal.stage?.color || '#475569',
                                    borderColor: deal.stage?.color ? `${deal.stage.color}40` : '#cbd5e1'
                                }}
                            >
                                {deal.stage?.name || 'Unknown Stage'}
                            </span>
                        </div>
                        <p className="text-slate-500 font-medium mt-1 flex items-center gap-2">
                            {deal.account?.name || deal.contact?.name || 'No Associated Account'}
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-6 bg-slate-50 border border-slate-100 p-4 rounded-xl shadow-inner">
                        <div>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Deal Value</div>
                            <div className="text-2xl font-black text-slate-800 flex items-center gap-1">
                                <IndianRupee className="w-5 h-5 text-emerald-500" />
                                {Number(deal.amount || 0).toLocaleString()}
                            </div>
                        </div>
                        <div className="w-px h-10 bg-slate-200"></div>
                        <div>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Close Date</div>
                            <div className="text-lg font-bold text-slate-700 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-slate-400" />
                                {deal.close_date ? new Date(deal.close_date).toLocaleDateString() : 'TBD'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex items-center gap-8 mt-10 -mb-6">
                    {(['details', 'notes', 'emails', 'quotes'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-4 px-1 text-sm font-bold capitalize border-b-2 transition-colors duration-200 ${
                                activeTab === tab 
                                    ? 'border-indigo-500 text-indigo-600' 
                                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Section */}
            <div className="flex-1 overflow-auto p-8 relative">
                <div className="max-w-4xl mx-auto">
                    
                    {/* DETAILS TAB */}
                    {activeTab === 'details' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-slate-900 mb-6">Pipeline Details</h3>
                                <div className="space-y-4">
                                    <div>
                                        <div className="text-sm font-bold text-slate-500 mb-1">Probability</div>
                                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                            <div className="bg-indigo-500 h-2.5 rounded-full shadow" style={{ width: `${deal.probability || 0}%` }}></div>
                                        </div>
                                        <div className="text-xs font-bold text-indigo-600 mt-1">{deal.probability || 0}% Probability</div>
                                    </div>
                                    <div className="pt-4 border-t border-slate-100">
                                        <div className="text-sm font-bold text-slate-500 mb-1">Expected Revenue</div>
                                        <div className="font-semibold text-slate-800 flex items-center gap-0.5">
                                            <IndianRupee className="w-4 h-4 text-slate-400" />
                                            {Number((deal.amount || 0) * ((deal.probability||0)/100)).toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-slate-100">
                                        <div className="text-sm font-bold text-slate-500 mb-1">Lead Source</div>
                                        <div className="font-semibold text-slate-800 capitalize">{deal.source || 'Unknown'}</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-slate-900 mb-6">Key Information</h3>
                                <div className="space-y-4">
                                    <div>
                                        <div className="text-sm font-bold text-slate-500 mb-1">Deal Owner</div>
                                        <div className="font-semibold text-slate-800 flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs">
                                                {deal.owner?.name?.charAt(0) || 'U'}
                                            </div>
                                            {deal.owner?.name || 'Unassigned'}
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-slate-100">
                                        <div className="text-sm font-bold text-slate-500 mb-1">Created At</div>
                                        <div className="font-semibold text-slate-800 flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-slate-400" />
                                            {new Date(deal.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-slate-100">
                                        <div className="text-sm font-bold text-slate-500 mb-1">Description / Notes</div>
                                        <div className="text-slate-600 text-sm">{deal.description || 'No description provided.'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* NOTES TAB */}
                    {activeTab === 'notes' && id && (
                        <NotesTimeline moduleApiName="deals" recordId={id} />
                    )}

                    {/* EMAILS TAB */}
                    {activeTab === 'emails' && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
                            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Mail className="w-5 h-5 text-slate-400" />
                                    Communication History
                                </h3>
                                <button onClick={() => setIsEmailModalOpen(true)} className="bg-white border border-slate-200 hover:border-indigo-300 text-indigo-600 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer">
                                    <Plus className="w-4 h-4" /> Send Email
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto p-4 flex flex-col gap-3 relative">
                                {loadingEmails ? (
                                    <div className="inset-0 absolute flex items-center justify-center bg-white/50"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
                                ) : emailsRes?.data?.length > 0 ? (
                                    emailsRes.data.map((email: any) => (
                                        <div key={email.id} className="border border-slate-200 rounded-xl p-4 hover:border-indigo-300 transition-colors bg-white shadow-sm overflow-hidden">
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="font-bold text-slate-900 text-md truncate pr-4">{email.subject || '(No Subject)'}</div>
                                                <div className="text-xs font-semibold text-slate-400 whitespace-nowrap bg-slate-100 px-2 py-1 rounded">
                                                    {new Date(email.created_at).toLocaleString()}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${email.direction === 'outbound' ? 'bg-sky-50 text-sky-600 border-sky-100' : 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100'}`}>
                                                    {email.direction}
                                                </span>
                                                <span className="text-xs font-semibold text-slate-500 truncate flex-1 md:flex-none">
                                                    To: {email.to_emails?.join(', ') || 'Unknown'}
                                                </span>
                                            </div>
                                            <div className="text-sm text-slate-600 line-clamp-2 max-w-[800px] leading-relaxed">
                                                {email.body_text || email.body_html?.replace(/<[^>]*>?/gm, '') || '(No content)'}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
                                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                                            <Mail className="w-6 h-6 text-slate-300" />
                                        </div>
                                        <p className="font-semibold text-[15px]">No emails logged</p>
                                        <p className="text-sm mt-1">Send an email to track your communication here.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* QUOTES TAB */}
                    {activeTab === 'quotes' && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
                            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-slate-400" />
                                    Related Quotes
                                </h3>
                                <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer">
                                    <Plus className="w-4 h-4" /> Create Quote
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto p-4 flex flex-col gap-3 relative">
                                {loadingQuotes ? (
                                    <div className="inset-0 absolute flex items-center justify-center bg-white/50"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
                                ) : quotesRes?.data?.length > 0 ? (
                                    quotesRes.data.map((quote: any) => (
                                        <div key={quote.id} className="border border-slate-200 rounded-xl p-4 hover:border-indigo-300 transition-colors bg-white shadow-sm flex items-center justify-between">
                                            <div>
                                                <div className="font-bold text-slate-900 flex items-center gap-2">
                                                    {quote.quote_number} - {quote.subject}
                                                </div>
                                                <div className="text-sm font-semibold text-slate-500 flex items-center gap-2 mt-1">
                                                    <span>{new Date(quote.created_at).toLocaleDateString()}</span>
                                                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                    <span className="capitalize">{quote.status}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-extrabold text-slate-800 text-lg flex items-center justify-end gap-1">
                                                    <IndianRupee className="w-4 h-4 text-slate-400" />
                                                    {Number(quote.total_amount || 0).toLocaleString()}
                                                </div>
                                                <a href={`/quotes/${quote.id}`} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 mt-1 inline-block">View PDF</a>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
                                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                                            <FileText className="w-6 h-6 text-slate-300" />
                                        </div>
                                        <p className="font-semibold text-[15px]">No quotes generated</p>
                                        <p className="text-sm mt-1">Send your first pricing proposal for this deal.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </div>

            <EmailComposerModal 
                isOpen={isEmailModalOpen} 
                onClose={() => setIsEmailModalOpen(false)} 
                initialToEmail={deal.contact?.email || ''}
                linkedModule="opportunities"
                linkedRecordId={id!} 
            />
        </div>
    );
}
