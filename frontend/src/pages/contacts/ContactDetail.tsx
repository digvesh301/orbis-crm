import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { IndianRupee, ArrowLeft, Mail, Phone, MapPin, Loader2, Plus, Clock, Briefcase } from 'lucide-react';
import { NotesTimeline } from '../../components/shared/NotesTimeline';
import { EmailComposerModal } from '../../components/shared/EmailComposerModal';

export default function ContactDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'details' | 'notes' | 'deals' | 'emails'>('details');
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

    const { data: contactRes, isLoading: loadingContact } = useQuery({
        queryKey: ['contact', id],
        queryFn: async () => {
            const res = await api.get(`/contacts/${id}`);
            return res.data;
        }
    });

    const { data: dealsRes, isLoading: loadingDeals } = useQuery({
        queryKey: ['contact-deals', id],
        queryFn: async () => {
            const res = await api.get(`/deals?contact_id=${id}`);
            return res.data;
        },
        enabled: activeTab === 'deals'
    });

    const { data: emailsRes, isLoading: loadingEmails } = useQuery({
        queryKey: ['contact-emails', id],
        queryFn: async () => {
            const res = await api.get(`/emails?linked_module=contacts&linked_record_id=${id}`);
            return res.data;
        },
        enabled: activeTab === 'emails' // Use lazy loading when tab clicks
    });

    if (loadingContact) {
        return (
            <div className="h-full flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    const contact = contactRes?.data;
    if (!contact) return <div className="p-8">Contact not found</div>;

    const initials = `${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`;

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* Header Section */}
            <div className="bg-white border-b border-slate-200 px-8 py-6 shrink-0 z-10 sticky top-0 shadow-sm">
                <button 
                    onClick={() => navigate('/contacts')}
                    className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 mb-6 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Contacts
                </button>
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-extrabold text-3xl shadow-lg shrink-0">
                        {initials}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{contact.first_name} {contact.last_name}</h1>
                            <span className="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                                {contact.status || 'Active'}
                            </span>
                        </div>
                        <p className="text-slate-600 font-medium mt-1.5 flex flex-wrap items-center gap-4 text-sm">
                            <span className="flex items-center gap-1.5"><Briefcase className="w-4 h-4 text-slate-400" /> {contact.title || 'Unknown Title'}</span>
                            <span className="flex items-center gap-1.5"><Mail className="w-4 h-4 text-slate-400" /> {contact.email}</span>
                            {contact.phone && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-slate-400" /> {contact.phone}</span>}
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                        <button className="bg-white border text-sm border-slate-200 hover:border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-bold shadow-sm transition-colors cursor-pointer">
                            Edit Contact
                        </button>
                        <button onClick={() => setIsEmailModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-sm text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-2">
                            <Mail className="w-4 h-4" /> Send Email
                        </button>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex items-center gap-8 mt-10 -mb-6">
                    {(['details', 'notes', 'deals', 'emails'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-4 px-1 text-sm font-bold capitalize border-b-2 transition-colors duration-200 ${
                                activeTab === tab 
                                    ? 'border-indigo-500 text-indigo-600' 
                                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                            }`}
                        >
                            {tab} {tab === 'deals' && dealsRes?.data && `(${dealsRes.data.length})`}
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
                                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                    <MapPin className="w-5 h-5 text-slate-400" /> Location Details
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Street Address</div>
                                        <div className="font-semibold text-slate-800">{contact.address?.street || '—'}</div>
                                    </div>
                                    <div className="pt-4 border-t border-slate-100 flex gap-8">
                                        <div className="flex-1">
                                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">City</div>
                                            <div className="font-semibold text-slate-800">{contact.address?.city || '—'}</div>
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">State / Zip</div>
                                            <div className="font-semibold text-slate-800">{contact.address?.state || '—'} {contact.address?.zip || ''}</div>
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-slate-100">
                                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Country</div>
                                        <div className="font-semibold text-slate-800">{contact.address?.country || '—'}</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-slate-900 mb-6">Account & Ownership</h3>
                                <div className="space-y-4">
                                    <div>
                                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Primary Account</div>
                                        {contact.account_id ? (
                                            <a href={`/accounts/${contact.account_id}`} className="font-bold text-indigo-600 hover:underline">View Parent Account</a>
                                        ) : (
                                            <div className="text-sm font-medium text-slate-500 italic">No account assigned</div>
                                        )}
                                    </div>
                                    <div className="pt-4 border-t border-slate-100">
                                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Contact Owner</div>
                                        <div className="font-semibold text-slate-800 flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-[10px] border border-slate-200">
                                                {contact.owner?.name?.charAt(0) || 'U'}
                                            </div>
                                            {contact.owner?.name || 'Unassigned'}
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-slate-100">
                                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Created At</div>
                                        <div className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
                                            <Clock className="w-4 h-4 text-slate-400" />
                                            {new Date(contact.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* NOTES TAB */}
                    {activeTab === 'notes' && id && (
                        <NotesTimeline moduleApiName="contacts" recordId={id} />
                    )}

                    {/* DEALS TAB */}
                    {activeTab === 'deals' && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
                            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <IndianRupee className="w-5 h-5 text-slate-400" />
                                    Active Pipeline
                                </h3>
                                <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer">
                                    <Plus className="w-4 h-4" /> New Deal
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto p-4 flex flex-col gap-3 relative">
                                {loadingDeals ? (
                                    <div className="inset-0 absolute flex items-center justify-center bg-white/50"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
                                ) : dealsRes?.data?.length > 0 ? (
                                    dealsRes.data.map((deal: any) => (
                                        <div key={deal.id} className="border border-slate-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-md transition-all bg-white flex items-center justify-between cursor-pointer" onClick={() => navigate(`/deals/${deal.id}`)}>
                                            <div>
                                                <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{deal.name}</div>
                                                <div className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-wider text-[10px]">
                                                    Close: {deal.close_date ? new Date(deal.close_date).toLocaleDateString() : 'TBD'}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-extrabold text-slate-800 text-lg flex items-center justify-end">
                                                    <IndianRupee className="w-4 h-4 text-slate-400" />
                                                    {Number(deal.amount || 0).toLocaleString()}
                                                </div>
                                                <div 
                                                    className="inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-1 uppercase tracking-wider"
                                                    style={{ backgroundColor: deal.stage?.color ? `${deal.stage.color}15` : '#f1f5f9', color: deal.stage?.color || '#475569' }}
                                                >
                                                    {deal.stage?.name || 'Open'}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
                                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                                            <IndianRupee className="w-6 h-6 text-slate-300" />
                                        </div>
                                        <p className="font-semibold text-[15px]">No related deals</p>
                                        <p className="text-sm mt-1">Start a pipeline opportunity with this contact.</p>
                                    </div>
                                )}
                            </div>
                        </div>
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
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${email.direction === 'outbound' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
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
                </div>
            </div>

            <EmailComposerModal 
                isOpen={isEmailModalOpen} 
                onClose={() => setIsEmailModalOpen(false)} 
                initialToEmail={contact.email || ''}
                linkedModule="contacts"
                linkedRecordId={id!} 
            />
        </div>
    );
}

