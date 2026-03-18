import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../lib/api';
import { ArrowLeft, Loader2, Phone, Mail, PackageSearch, MessageSquareHeart, Building2, Handshake } from 'lucide-react';
import { LazyWidgetContainer } from './LazyWidgetContainer';
import React, { Suspense } from 'react';

// Lazy loading the widgets individually 
const ContactCardWidget = React.lazy(() => import('./widgets/ContactCardWidget'));
const AssociatedCompanyWidget = React.lazy(() => import('./widgets/AssociatedCompanyWidget'));
const AssociatedDealsWidget = React.lazy(() => import('./widgets/AssociatedDealsWidget'));
const RelatedProductsWidget = React.lazy(() => import('./widgets/RelatedProductsWidget'));
const TimelineWidget = React.lazy(() => import('./widgets/TimelineWidget'));
const ComposerWidget = React.lazy(() => import('./widgets/ComposerWidget'));

export default function ContactDetailDashboard() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // Fetch the core contact data
    const { data: contactRes, isLoading: loadingContact } = useQuery({
        queryKey: ['contact', id],
        queryFn: async () => {
             const res = await api.get(`/contacts/${id}`);
             return res.data;
        }
    });

    if (loadingContact) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-slate-50/50">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
                <p className="text-slate-500 font-medium animate-pulse">Loading Contact Profile...</p>
            </div>
        );
    }

    const contact = contactRes?.data;
    if (!contact) return <div className="p-8 text-center text-rose-500 font-bold">404 - Contact Profile Not Found</div>;

    const initials = `${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`;

    return (
        <div className="flex flex-col h-full bg-slate-50/50 overflow-hidden">
            {/* Global Sticky Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-5 shrink-0 z-20 shadow-sm flex items-center gap-6 sticky top-0">
                <button 
                    onClick={() => navigate('/contacts')}
                    className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-inner shrink-0 ring-4 ring-indigo-50">
                    {initials}
                </div>
                
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3 truncate">
                        {contact.first_name} {contact.last_name}
                        {contact.status === 'active' && <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>}
                    </h1>
                    <p className="text-slate-500 font-medium text-xs mt-0.5 flex items-center gap-3 truncate">
                        <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {contact.title || 'Unknown Title'}</span>
                        <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {contact.email}</span>
                        {contact.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {contact.phone}</span>}
                    </p>
                </div>

                <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-sm transition-all hidden md:block shrink-0">
                    Quick Actions
                </button>
            </div>

            {/* Dashboard Workspace */}
            <div className="flex-1 overflow-auto p-6 md:p-8">
                {/* 3-Column Responsive Grid Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1600px] mx-auto">
                    
                    {/* LEFT SIDEBAR (Basic Info, Company) */}
                    <div className="col-span-1 lg:col-span-3 space-y-6">
                        <LazyWidgetContainer title="Contact Details" minHeight="250px">
                            <ContactCardWidget contact={contact} />
                        </LazyWidgetContainer>
                        
                        <LazyWidgetContainer title="Associated Company" minHeight="200px">
                            <AssociatedCompanyWidget contact={contact} />
                        </LazyWidgetContainer>
                    </div>

                    {/* MAIN CONTENT AREA (Composer & Timeline Feed) */}
                    <div className="col-span-1 lg:col-span-6 flex flex-col h-full space-y-6">
                        <Suspense fallback={<div className="h-40 bg-white rounded-2xl border border-slate-200 animate-pulse"></div>}>
                            <ComposerWidget contactId={id!} contactEmail={contact.email} />
                        </Suspense>

                        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                    <MessageSquareHeart className="w-5 h-5 text-indigo-500" />
                                    Activity Stream
                                </h3>
                            </div>
                            <div className="flex-1 p-0 relative">
                                <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>}>
                                    <TimelineWidget recordId={id!} moduleApiName="contacts" />
                                </Suspense>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT SIDEBAR (Deals, Products, Integrations) */}
                    <div className="col-span-1 lg:col-span-3 space-y-6">
                        <LazyWidgetContainer title="Active Pipeline" icon={<Handshake className="w-4 h-4 text-emerald-500" />} minHeight="300px">
                            <AssociatedDealsWidget contactId={id!} />
                        </LazyWidgetContainer>

                        <LazyWidgetContainer title="Related Products" icon={<PackageSearch className="w-4 h-4 text-orange-500" />} minHeight="200px">
                            <RelatedProductsWidget />
                        </LazyWidgetContainer>
                    </div>

                </div>
            </div>
        </div>
    );
}
