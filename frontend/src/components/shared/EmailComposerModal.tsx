import { useState } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface EmailComposerModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialToEmail: string;
    linkedModule: 'contacts' | 'opportunities' | 'leads' | 'accounts';
    linkedRecordId: string;
}

export function EmailComposerModal({ 
    isOpen, 
    onClose, 
    initialToEmail, 
    linkedModule, 
    linkedRecordId 
}: EmailComposerModalProps) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({
        to_email: initialToEmail,
        subject: '',
        body: '',
    });

    const mutation = useMutation({
        mutationFn: async (data: any) => {
            return api.post('/emails', {
                to_emails: [data.to_email],
                subject: data.subject,
                body_text: data.body, // currently sending plain text
                linked_module: linkedModule,
                linked_record_id: linkedRecordId,
            });
        },
        onSuccess: () => {
            // Invalidate the emails query related to this record to refresh the list
            if (linkedModule === 'contacts') {
                queryClient.invalidateQueries({ queryKey: ['contact-emails', linkedRecordId] });
            } else if (linkedModule === 'opportunities') {
                queryClient.invalidateQueries({ queryKey: ['deal-emails', linkedRecordId] });
            }
            setFormData(prev => ({ ...prev, subject: '', body: '' }));
            onClose();
        }
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl flex flex-col h-[600px] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                            <Send className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 leading-tight">Compose Email</h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-200/50 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Body */}
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">To</label>
                        <input 
                            type="email"
                            value={formData.to_email}
                            onChange={e => setFormData({ ...formData, to_email: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 font-medium transition-colors"
                            placeholder="recipient@example.com"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Subject</label>
                        <input 
                            type="text"
                            value={formData.subject}
                            onChange={e => setFormData({ ...formData, subject: e.target.value })}
                            className="w-full bg-white border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 font-medium transition-colors shadow-sm"
                            placeholder="Email subject..."
                        />
                    </div>

                    <div className="flex-1 flex flex-col">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Message</label>
                        <textarea 
                            value={formData.body}
                            onChange={e => setFormData({ ...formData, body: e.target.value })}
                            className="w-full flex-1 min-h-[200px] bg-white border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-3 font-medium transition-colors shadow-sm resize-none"
                            placeholder="Type your message here..."
                        />
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
                    >
                        Discard
                    </button>
                    <button
                        disabled={!formData.to_email || !formData.subject || mutation.isPending}
                        onClick={() => mutation.mutate(formData)}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
                    >
                        {mutation.isPending ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" /> Sending...
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4" /> Send Email
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
