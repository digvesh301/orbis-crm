import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { IndianRupee, Loader2 } from 'lucide-react';
import {
    DndContext,
    rectIntersection,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    useDroppable,
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
import { Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

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

        const originalDeal = dealsData?.data?.find((d: any) => d.id === active.id);
        if (!originalDeal) return;

        let newStageId = null;
        
        const isOverADeal = over.data.current?.type === 'Deal';
        const isOverAColumn = over.data.current?.type === 'Column';

        if (isOverAColumn) {
            newStageId = over.id;
        } else if (isOverADeal) {
            const overDeal = localDeals.find(d => d.id === over.id);
            newStageId = overDeal?.stage?.id;
        }

        if (newStageId && newStageId !== originalDeal.stage?.id) {
            // Update UI optimistically completely to prevent snapback
            setLocalDeals(prev => {
                const arr = [...prev];
                const idx = arr.findIndex(d => d.id === active.id);
                if (idx > -1) {
                    arr[idx].stage = { ...pipelineStages.find((s:any) => s.id === newStageId) };
                }
                return arr;
            });
            // Firing the backend API request
            updateDealMutation.mutate({ dealId: active.id, newStageId });
        }
    };

    const dropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }),
    };

    // Grab the full original data reference for the floating drag overlay element
    const activeDealRef = activeId ? localDeals.find(d => d.id === activeId) : null;

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col pt-8 pb-4 bg-slate-50/40">
            <div className="px-8 pb-6 flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Deals (Opportunities)</h1>
                    <p className="text-slate-500 mt-2 text-sm font-medium">Drag and drop deals to advance them through the sales process.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="bg-slate-100/80 p-1 rounded-lg flex items-center border border-slate-200 shadow-inner">
                        <button 
                            onClick={() => window.location.href = '/deals'}
                            className="text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 px-4 py-1.5 text-sm font-bold rounded-md flex items-center gap-2 transition-colors cursor-pointer"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /> </svg>
                            List View
                        </button>
                        <button className="bg-white shadow-sm text-slate-800 px-4 py-1.5 text-sm font-bold rounded-md flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /> </svg>
                            Board View
                        </button>
                    </div>

                    <div className="h-8 w-px bg-slate-200 mx-1"></div>

                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors cursor-pointer">
                        New Deal
                    </button>
                </div>
            </div>

            <DndContext sensors={sensors} collisionDetection={rectIntersection} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
                <div className="flex-1 overflow-x-auto px-8 flex gap-5 pb-6 items-start">
                    {pipelineStages.map((stage: any, index: number) => {
                        const stageDeals = localDeals.filter((d: any) => d.stage?.id === stage.id);
                        const stageValue = stageDeals.reduce((acc: number, d: any) => acc + (Number(d.amount) || 0), 0);

                        return (
                            <Column 
                                key={stage.id} 
                                stage={stage} 
                                deals={stageDeals} 
                                stageValue={stageValue}
                                isFirst={index === 0}
                                isLast={index === pipelineStages.length - 1} 
                            />
                        );
                    })}

                    {/* Add Stage Column UI */}
                    <div className="w-[320px] shrink-0 pt-4 flex flex-col gap-4">
                        <button 
                            onClick={() => {
                                const name = prompt("Enter the name for your new Custom Pipeline Stage:");
                                if (name && name.trim()) {
                                    api.post('/pipeline', { name: name.trim(), stage_type: 'open', probability: 50 }).then(() => {
                                        queryClient.invalidateQueries({ queryKey: ['pipeline-stages'] });
                                    }).catch(err => alert(err.response?.data?.error || "Failed to create stage"));
                                }
                            }}
                            className="w-full bg-white text-indigo-600 rounded-[14px] flex items-center justify-center border-2 border-dashed border-indigo-200 hover:border-indigo-400 hover:bg-slate-50 cursor-pointer transition-colors min-h-[150px] shadow-sm font-bold tracking-tight text-[15px] gap-2"
                        >
                           <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}> <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /> </svg>
                           Create New Stage
                        </button>
                        <div className="text-center text-slate-400 text-sm font-medium px-4">
                            Scroll left and right to view all stages.
                        </div>
                    </div>
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

function Column({ stage, deals, stageValue, isFirst, isLast }: { stage: any, deals: any[], stageValue: number, isFirst: boolean, isLast: boolean }) {
    const queryClient = useQueryClient();
    const { setNodeRef } = useDroppable({
        id: stage.id,
        data: { type: 'Column' }
    });

    const handleRename = () => {
        const newName = prompt("Rename stage to:", stage.name);
        if (newName && newName.trim() && newName.trim() !== stage.name) {
            api.patch(`/pipeline/${stage.id}`, { name: newName.trim() })
                .then(() => queryClient.invalidateQueries({ queryKey: ['pipeline-stages'] }))
                .catch(err => alert(err.response?.data?.error || "Failed to rename"));
        }
    };

    const handleDelete = () => {
        if (confirm(`Are you sure you want to delete the stage "${stage.name}"?`)) {
            api.delete(`/pipeline/${stage.id}`)
                .then(() => queryClient.invalidateQueries({ queryKey: ['pipeline-stages'] }))
                .catch(err => alert(err.response?.data?.error || "Cannot delete stage"));
        }
    };

    const handleMove = (direction: 'left' | 'right') => {
        const offset = direction === 'left' ? -1 : 1;
        api.patch(`/pipeline/reorder`, { 
            stages: [{ id: stage.id, position: stage.position + offset }]
        }).then(() => queryClient.invalidateQueries({ queryKey: ['pipeline-stages'] }));
    };

    return (
        <div ref={setNodeRef} className="w-[320px] shrink-0 bg-slate-100/70 rounded-[14px] flex flex-col max-h-full border border-slate-200/70 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)] overflow-hidden group">
            <div className="p-4 border-b border-transparent flex flex-col gap-1 shrink-0 z-10 sticky top-0 bg-slate-100/70 transition-colors">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {stage.color && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }}></div>}
                        <h3 onClick={handleRename} className="font-bold text-slate-900 text-[15px] tracking-tight cursor-pointer hover:text-indigo-600 transition-colors" title="Click to rename">
                            {stage.name}
                        </h3>
                        <span className="text-slate-400 text-xs font-bold ml-1">{deals.length}</span>
                    </div>
                    
                    {/* Stage Action Controls */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!isFirst && <button onClick={() => handleMove('left')} className="p-1 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-200" title="Move Left"><ChevronLeft size={14}/></button>}
                        {!isLast && <button onClick={() => handleMove('right')} className="p-1 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-200" title="Move Right"><ChevronRight size={14}/></button>}
                        {!stage.is_system && <button onClick={handleDelete} className="p-1 text-slate-400 hover:text-red-600 rounded-md hover:bg-slate-200 ml-1" title="Delete Stage"><Trash2 size={13}/></button>}
                    </div>
                </div>
                <div className="text-[13px] font-bold text-slate-500 flex items-center gap-0.5">
                    <IndianRupee className="w-3.5 h-3.5" />
                    {stageValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </div>
            </div>

            {/* The Droppable Area inside the column */}
            <div className="p-3 pt-1 flex flex-col gap-3 overflow-y-auto min-h-[150px] flex-1">
                <SortableContext id={stage.id} items={deals.map(d => d.id)} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col gap-3 flex-1 min-h-[100px]">
                        {deals.map(deal => <SortableDealCard key={deal.id} deal={deal} />)}
                        
                        {deals.length === 0 && (
                            <div className="h-full min-h-[100px] flex-1 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-[13px] font-semibold text-slate-400">
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
        <div className="bg-white p-4 rounded-[14px] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border-2 border-indigo-400 cursor-grabbing opacity-90 scale-105 transition-transform pb-3">
            {deal.probability !== undefined && deal.probability !== null && (
                <div className="absolute top-3 right-3">
                    <span className="bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-sm">
                        {deal.probability}% Win
                    </span>
                </div>
            )}
            <div className="font-bold text-slate-900 text-sm leading-tight mb-1 pl-4 tracking-tight pr-6">
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
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-100 to-slate-100 border border-indigo-200/50 flex items-center justify-center font-bold text-[10px] text-indigo-700 shadow-sm" title={deal.owner.name}>
                        {deal.owner.name.charAt(0).toUpperCase()}
                    </div>
                )}
            </div>
        </div>
    );
}
