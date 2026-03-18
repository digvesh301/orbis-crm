import { useState } from 'react';
import { PencilLine, Mail, PhoneCall, Paperclip, Send } from 'lucide-react';
import { EmailComposerModal } from '../../../../../components/shared/EmailComposerModal';

export default function ComposerWidget({ contactId, contactEmail }: { contactId: string, contactEmail?: string }) {
    const [mode, setMode] = useState<'note' | 'email' | 'call'>('note');
    const [noteBody, setNoteBody] = useState('');
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

    const handleSaveNote = async () => {
        // Mock save logic, usually connected via Mutation hook
        if (!noteBody.trim()) return;
        console.log("Saving Note:", noteBody);
        setNoteBody('');
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
            <div className="flex bg-slate-50 border-b border-slate-200 px-4">
                <button onClick={() => setMode('note')} className={`py-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${mode === 'note' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                    <PencilLine className="w-4 h-4" /> Note
                </button>
                <button onClick={() => setIsEmailModalOpen(true)} className={`py-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors border-transparent text-slate-500 hover:text-slate-800`}>
                    <Mail className="w-4 h-4" /> Email
                </button>
                <button onClick={() => setMode('call')} className={`py-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${mode === 'call' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                    <PhoneCall className="w-4 h-4" /> Log Call
                </button>
            </div>

            <div className="p-4">
                <textarea 
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    placeholder="Start typing to leave a note... Use @ to tag colleagues."
                    className="w-full min-h-[100px] text-sm resize-none focus:outline-none placeholder:text-slate-400 font-medium text-slate-700 bg-transparent"
                />
                
                <div className="flex items-center justify-between mt-4">
                    <div className="flex gap-2">
                        <button className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg transition-colors">
                            <Paperclip className="w-4 h-4" />
                        </button>
                    </div>
                    <button 
                        onClick={handleSaveNote}
                        disabled={!noteBody.trim()}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
                    >
                        Save Note <Send className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            <EmailComposerModal 
                isOpen={isEmailModalOpen} 
                onClose={() => setIsEmailModalOpen(false)} 
                initialToEmail={contactEmail || ''}
                linkedModule="contacts"
                linkedRecordId={contactId} 
            />
        </div>
    );
}
