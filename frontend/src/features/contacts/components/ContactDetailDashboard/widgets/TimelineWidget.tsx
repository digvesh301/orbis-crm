import { useState } from 'react';
import { MessageSquareText } from 'lucide-react';
import { NotesTimeline } from '../../../../../components/shared/NotesTimeline';

export default function TimelineWidget({ recordId, moduleApiName = "contacts" }: { recordId: string, moduleApiName?: string }) {
    const [filter, setFilter] = useState<'all' | 'notes' | 'emails' | 'calls'>('all');
    // In a fully built enterprise app, this widget would fetch a unified stream 
    // blending /notes, /emails, and /activities via API aggregation
    
    return (
        <div className="flex flex-col h-[600px] overflow-hidden">
            {/* Timeline Filter Header */}
            <div className="flex gap-2 mb-4 border-b border-slate-100 pb-4 overflow-x-auto shrink-0 scrollbar-hide">
                {(['all', 'notes', 'emails', 'calls'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                            filter === f 
                                ? 'bg-slate-900 text-white shadow-sm' 
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {/* Timeline Feed Container */}
            <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-slate-50 relative">
                <div className="absolute inset-0 p-1">
                    {filter === 'all' || filter === 'notes' ? (
                        <div className="transform scale-[0.98] origin-top h-full w-full">
                            <NotesTimeline moduleApiName={moduleApiName} recordId={recordId} />
                        </div>
                    ) : (
                         <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm border border-slate-200">
                                <MessageSquareText className="w-6 h-6 text-slate-300" />
                            </div>
                            <p className="font-semibold text-sm">No {filter} found</p>
                            <p className="text-xs mt-1 text-slate-400">Activity stream is currently empty for this filter.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
