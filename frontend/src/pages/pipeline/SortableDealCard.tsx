import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IndianRupee, GripVertical } from 'lucide-react';

export function SortableDealCard({ deal }: { deal: any }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: deal.id,
        data: {
            type: 'Deal',
            deal,
        },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    if (isDragging) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="bg-slate-50 border-2 border-indigo-200 border-dashed rounded-xl h-[120px] opacity-40 shadow-inner"
            />
        );
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`group relative bg-white p-4 rounded-[14px] shadow-sm border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all cursor-grab active:cursor-grabbing pb-3`}
        >
            {/* Probability Badge overlay */}
            {deal.probability !== undefined && deal.probability !== null && (
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-sm">
                        {deal.probability}% Win
                    </span>
                </div>
            )}

            <div className="absolute top-4 left-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300">
                <GripVertical size={14} />
            </div>

            <div className="font-bold text-slate-900 text-sm leading-tight mb-1 pl-4 tracking-tight group-hover:text-indigo-600 transition-colors pr-6">
                {deal.name}
            </div>
            <div className="text-[11px] font-semibold text-slate-400 mb-4 pl-4 truncate uppercase tracking-wider">
                {deal.account?.name || deal.contact?.name || 'No Entity Linked'}
            </div>

            <div className="flex items-center justify-between border-t border-slate-150 pt-3 mt-1">
                <div className="font-bold text-slate-700 flex items-center gap-0.5 text-[13px] tracking-tight">
                    <IndianRupee className="w-[14px] h-[14px] text-slate-400" />
                    {Number(deal.amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </div>
                {deal.owner && (
                    <div 
                        className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-100 to-slate-100 border border-indigo-200/50 flex items-center justify-center font-bold text-[10px] text-indigo-700 shadow-sm" 
                        title={deal.owner.name}
                    >
                        {deal.owner.name.charAt(0).toUpperCase()}
                    </div>
                )}
            </div>
            
            {/* Subtle left-side accent based on stage color instead of top bar */}
            {deal.stage?.color && (
                <div
                    className="absolute top-0 bottom-0 left-0 w-1 rounded-l-[14px] opacity-80"
                    style={{ backgroundColor: deal.stage.color }}
                />
            )}
        </div>
    );
}
