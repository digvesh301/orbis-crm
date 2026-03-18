import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { IndianRupee, Loader2 } from 'lucide-react';
import {
    DndContext,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableDealCard } from './SortableDealCard';
import DealModal from '../deals/DealModal';

export default function PipelineBoard() {
    const queryClient = useQueryClient();
    const [activeId, setActiveId] = useState<string | null>(null);
    const [localDeals, setLocalDeals] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const { data: stagesData, isLoading: loadingStages } = useQuery({
        queryKey: ['pipeline-stages'],
        queryFn: async () => {
            const res = await api.get('/pipeline');
            return res.data;
        }
    });

    const { data: dealsData, isLoading: loadingDeals } = useQuery({
        queryKey: ['deals'],
        queryFn: async () => {
            const res = await api.get('/deals');
            return res.data;
        }
    });

    // Sync remote data into local state so we can do immediate optimistic UI updates
    useEffect(() => {
        if (dealsData?.data) {
            setLocalDeals(dealsData.data);
        }
    }, [dealsData]);

    const updateDealMutation = useMutation({
        mutationFn: async ({ dealId, newStageId }: { dealId: string, newStageId: string }) => {
            await api.patch(`/deals/${dealId}`, { stage_id: newStageId });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deals'] })
    });

    if (loadingStages || loadingDeals) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    const pipelineStages = stagesData?.data || [];

    // DnD Handlers
    const handleDragStart = (event: any) => {
        setActiveId(event.active.id);
    };

    const handleDragOver = (event: any) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        if (activeId === overId) return;

        const isActiveADeal = active.data.current?.type === 'Deal';
        const isOverADeal = over.data.current?.type === 'Deal';
        const isOverAColumn = over.data.current?.type === 'Column';

        if (!isActiveADeal) return;

        setLocalDeals((deals) => {
            const activeIndex = deals.findIndex(d => d.id === activeId);
            
            // scenario 1: Hovering over another deal within lists
            if (isOverADeal) {
                const overIndex = deals.findIndex(d => d.id === overId);
                if (deals[activeIndex].stage?.id !== deals[overIndex].stage?.id) {
                    const newDeals = [...deals];
                    newDeals[activeIndex] = {
                        ...newDeals[activeIndex],
                        stage: { ...pipelineStages.find((s:any) => s.id === deals[overIndex].stage?.id) }
                    };
                    return arrayMove(newDeals, activeIndex, overIndex);
                }
                return arrayMove(deals, activeIndex, overIndex);
            }

            // scenario 2: Hovering over empty column space
            if (isOverAColumn) {
                const newDeals = [...deals];
                newDeals[activeIndex] = {
                    ...newDeals[activeIndex],
                    stage: { ...pipelineStages.find((s:any) => s.id === overId) }
                };
                return newDeals;
            }

            return deals;
        });
    };

    const handleDragEnd = (event: any) => {
        setActiveId(null);
        const { active, over } = event;
        if (!over) return;

        const activeDeal = localDeals.find(d => d.id === active.id);
        const originalDeal = dealsData?.data?.find((d: any) => d.id === active.id);

        if (activeDeal && originalDeal && activeDeal.stage?.id !== originalDeal.stage?.id) {
            // Firing the backend API request
            updateDealMutation.mutate({ dealId: activeDeal.id, newStageId: activeDeal.stage.id });
        }
    };

    const dropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }),
    };

    // Grab the full original data reference for the floating drag overlay element
    const activeDealRef = activeId ? localDeals.find(d => d.id === activeId) : null;

    return (
        <div className="h-full flex flex-col pt-8 pb-4 bg-slate-50/50">
            <div className="px-8 pb-6 flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Pipeline Board</h1>
                    <p className="text-slate-500 mt-2 text-sm font-medium">Drag and drop deals to advance them through the sales process.</p>
                </div>
                <div className="flex gap-2">
                    <a href="/deals" className="bg-white border border-slate-200 px-4 py-2 rounded-lg font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300">Switch to List View</a>
                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold shadow-sm transition">
                        New Deal
                    </button>
                </div>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
                <div className="flex-1 overflow-x-auto px-8 flex gap-6 pb-6 items-start h-[calc(100vh-140px)] hide-scrollbar">
                    {pipelineStages.map((stage: any) => {
                        const stageDeals = localDeals.filter((d: any) => d.stage?.id === stage.id);
                        const stageValue = stageDeals.reduce((acc: number, d: any) => acc + (Number(d.amount) || 0), 0);

                        return (
                            <Column key={stage.id} stage={stage} deals={stageDeals} stageValue={stageValue} />
                        );
                    })}
                </div>

                <DragOverlay dropAnimation={dropAnimation}>
                    {activeDealRef ? <OverlayCard deal={activeDealRef} /> : null}
                </DragOverlay>
            </DndContext>

            <DealModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    );
}

// ─── Subcomponents ─────────────────────────────────────────────────────────────

function Column({ stage, deals, stageValue }: { stage: any, deals: any[], stageValue: number }) {
    // This allows the entire column to be a drop target when empty
    const { setNodeRef } = SortableContext({ items: deals.map(d => d.id), strategy: verticalListSortingStrategy, ...( { id: stage.id, data: { type: 'Column' } } as any ) });

    return (
        <div className="w-[340px] shrink-0 bg-slate-200/50 rounded-2xl flex flex-col max-h-full border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200/60 flex flex-col gap-2 bg-slate-100/90 backdrop-blur shrink-0 z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        {stage.color && <div className="w-3 h-3 rounded-full shadow-inner" style={{ backgroundColor: stage.color }}></div>}
                        <h3 className="font-bold text-slate-800 tracking-tight">{stage.name}</h3>
                    </div>
                    <span className="text-slate-500 text-xs font-bold bg-slate-200 px-2.5 py-1 rounded-full">{deals.length}</span>
                </div>
                <div className="text-sm font-bold text-slate-500 pl-5 flex items-center gap-0.5">
                    <IndianRupee className="w-3.5 h-3.5" />
                    {stageValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </div>
            </div>

            {/* The Droppable Area inside the column */}
            <div className="p-3 flex flex-col gap-3 overflow-y-auto min-h-[150px] flex-1">
                <SortableContext items={deals.map(d => d.id)} strategy={verticalListSortingStrategy}>
                    <div ref={setNodeRef} className="flex flex-col gap-3 flex-1">
                        {deals.map(deal => <SortableDealCard key={deal.id} deal={deal} />)}
                        
                        {deals.length === 0 && (
                            <div className="h-full flex-1 border-2 border-dashed border-slate-300/60 rounded-xl flex items-center justify-center text-sm font-semibold text-slate-400">
                                Drop Deal Here
                            </div>
                        )}
                    </div>
                </SortableContext>
            </div>
        </div>
    );
}

// Visual clone shown during dragging
function OverlayCard({ deal }: { deal: any }) {
    return (
        <div className="bg-white p-4 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] border-2 border-indigo-400 cursor-grabbing opacity-90 scale-105 transition-transform">
            <div className="font-bold text-slate-900 leading-tight mb-1">{deal.name}</div>
            <div className="text-xs font-semibold text-slate-500 mb-4">{deal.account?.name || deal.contact?.name || 'No Associated Contact'}</div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <div className="font-bold text-slate-800 flex items-center gap-0.5 text-sm">
                    <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
                    {Number(deal.amount || 0).toLocaleString()}
                </div>
                {deal.owner && (
                    <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-600 shadow-sm" title={deal.owner.name}>
                        {deal.owner.name.charAt(0)}
                    </div>
                )}
            </div>
        </div>
    );
}
