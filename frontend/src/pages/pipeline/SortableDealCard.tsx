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
            className="group relative bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-300 transition-all cursor-grab active:cursor-grabbing pb-3"
        >
            <div className="absolute top-4 left-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300">
                <GripVertical size={14} />
            </div>

            <div className="font-bold text-slate-800 leading-tight mb-1 group-hover:text-indigo-600 pl-4">{deal.name}</div>
            <div className="text-xs font-semibold text-slate-400 mb-4 pl-4 truncate">{deal.account?.name || deal.contact?.name || 'No Associated Contact'}</div>

            <div className="flex items-center justify-between border-t border-slate-100/80 pt-3 mt-1">
                <div className="font-bold text-slate-700 flex items-center gap-0.5 text-sm">
                    <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
                    {Number(deal.amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </div>
                {deal.owner && (
                    <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-600 shadow-sm" title={deal.owner.name}>
                        {deal.owner.name.charAt(0)}
                    </div>
                )}
            </div>
            
            {/* Top accent color bar */}
            {deal.stage?.color && (
                <div
                    className="absolute top-0 left-0 right-0 h-1 rounded-t-xl opacity-60"
                    style={{ backgroundColor: deal.stage.color }}
                />
            )}
        </div>
    );
}
