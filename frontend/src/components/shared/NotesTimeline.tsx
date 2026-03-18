import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Send, FileText, Loader2, Pin, MessageSquare } from 'lucide-react';

interface Note {
    id: string;
    content: string;
    is_pinned: boolean;
    created_at: string;
    author: { name: string; avatar_url?: string };
}

interface NotesTimelineProps {
    moduleApiName: string;
    recordId: string;
}

export function NotesTimeline({ moduleApiName, recordId }: NotesTimelineProps) {
    const queryClient = useQueryClient();
    const [newNote, setNewNote] = useState('');
    const [isPinned, setIsPinned] = useState(false);

    const queryKey = ['notes', moduleApiName, recordId];

    const { data: notesRes, isLoading } = useQuery({
        queryKey,
        queryFn: async () => {
            const res = await api.get(`/notes?module_api_name=${moduleApiName}&record_id=${recordId}`);
            return res.data;
        }
    });

    const createNote = useMutation({
        mutationFn: async (content: string) => {
            return api.post('/notes', {
                module_api_name: moduleApiName,
                record_id: recordId,
                content,
                is_pinned: isPinned
            });
        },
        onSuccess: () => {
            setNewNote('');
            setIsPinned(false);
            queryClient.invalidateQueries({ queryKey });
        }
    });

    return (
        <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-slate-400" />
                    Internal Notes
                </h3>
            </div>
            
            <div className="flex-1 overflow-auto p-4 flex flex-col gap-4 relative bg-slate-50/30">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                    </div>
                ) : notesRes?.data?.length > 0 ? (
                    notesRes.data.map((note: Note) => (
                        <div key={note.id} className={`p-4 rounded-xl border ${note.is_pinned ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'} shadow-sm relative group`}>
                            {note.is_pinned && (
                                <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center border border-amber-200 shadow-sm">
                                    <Pin className="w-3.5 h-3.5" />
                                </div>
                            )}
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold border border-slate-300">
                                    {note.author?.name?.charAt(0) || 'U'}
                                </div>
                                <div className="font-bold text-slate-900 text-sm">{note.author?.name || 'Unknown User'}</div>
                                <div className="text-xs font-semibold text-slate-400">&bull;&nbsp; {new Date(note.created_at).toLocaleString()}</div>
                            </div>
                            <div className="text-slate-700 text-sm whitespace-pre-wrap ml-9">{note.content}</div>
                        </div>
                    ))
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
                        <div className="w-12 h-12 bg-white border border-slate-100 shadow-sm rounded-full flex items-center justify-center mb-3">
                            <MessageSquare className="w-6 h-6 text-slate-300" />
                        </div>
                        <p className="font-semibold text-[15px]">No notes yet</p>
                        <p className="text-sm mt-1">Leave a note to keep your team in the loop.</p>
                    </div>
                )}
            </div>

            <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                <div className="border border-slate-200 rounded-xl overflow-hidden focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-shadow bg-slate-50 flex flex-col">
                    <textarea 
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Write a note... @mention to notify someone"
                        className="w-full p-3 bg-transparent border-none resize-none min-h-[80px] text-sm focus:ring-0 text-slate-900 placeholder-slate-400"
                    />
                    <div className="p-2 border-t border-slate-100 bg-white flex items-center justify-between">
                        <button 
                            type="button"
                            onClick={() => setIsPinned(!isPinned)}
                            className={`p-1.5 rounded-lg border transition-colors ${
                                isPinned 
                                    ? 'bg-amber-50 text-amber-600 border-amber-200' 
                                    : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                            }`}
                            title={isPinned ? 'Unpin note' : 'Pin note to top'}
                        >
                            <Pin className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => {
                                if (newNote.trim()) createNote.mutate(newNote);
                            }}
                            disabled={!newNote.trim() || createNote.isPending}
                            className="bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-1.5"
                        >
                            {createNote.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Post Note
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
