import React, { Suspense } from 'react';
import { useInView } from 'react-intersection-observer';
import { Loader2 } from 'lucide-react';

interface LazyWidgetContainerProps {
    title: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    minHeight?: string;
}

export function LazyWidgetContainer({ title, icon, children, minHeight = "300px" }: LazyWidgetContainerProps) {
    const { ref, inView } = useInView({ 
        triggerOnce: true, 
        rootMargin: "200px 0px" // Start loading when 200px away from viewport
    });

    return (
        <div ref={ref} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col" style={{ minHeight }}>
            <div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50 shrink-0">
                {icon}
                <h3 className="font-bold text-slate-900">{title}</h3>
            </div>
            
            <div className="flex-1 p-5 relative overflow-auto">
                {inView ? (
                    <Suspense fallback={
                        <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                        </div>
                    }>
                        {children}
                    </Suspense>
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium">
                        Scrolling into view...
                    </div>
                )}
            </div>
        </div>
    );
}
