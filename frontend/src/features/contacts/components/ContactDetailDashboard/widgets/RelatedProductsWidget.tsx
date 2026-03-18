import { PackageSearch } from 'lucide-react';

export default function RelatedProductsWidget() {
    return (
        <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-slate-50/50 rounded-xl border border-dashed border-slate-300">
            <PackageSearch className="w-8 h-8 text-slate-300 mb-3" />
            <h4 className="text-sm font-bold text-slate-700">No Products Assigned</h4>
            <p className="text-xs font-medium text-slate-400 mt-1 max-w-[200px]">Link products purchased or interested in by this specific contact.</p>
            <button className="mt-4 px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-xs font-bold text-slate-700 hover:text-indigo-600 hover:border-indigo-300 transition-colors">
                Link Product
            </button>
        </div>
    );
}
