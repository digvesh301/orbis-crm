import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Package, IndianRupee, Tag } from 'lucide-react';

export default function ProductsList() {
    const { data: products, isLoading } = useQuery({
        queryKey: ['products'],
        queryFn: async () => {
            const res = await api.get('/products');
            return res.data;
        }
    });

    if (isLoading) return <div className="p-8 font-medium text-slate-500">Loading product catalog...</div>;

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                        <Package className="w-6 h-6 text-indigo-500" /> Products & Services
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Manage standard offerings and pricing.</p>
                </div>
                <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors cursor-pointer">
                    Add Product
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <th className="py-4 px-6">Product / SKU</th>
                            <th className="py-4 px-6 hidden sm:table-cell">Category</th>
                            <th className="py-4 px-6 text-right">Unit Price</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                        {products?.data?.map((product: any) => (
                            <tr key={product.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer">
                                <td className="py-4 px-6">
                                    <div className="font-bold text-slate-900">{product.name}</div>
                                    <div className="text-slate-400 font-medium text-xs mt-0.5 font-mono">
                                        {product.sku || 'NO-SKU'}
                                        <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                            product.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            {product.status || 'Active'}
                                        </span>
                                    </div>
                                </td>
                                <td className="py-4 px-6 hidden sm:table-cell">
                                    <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-semibold">
                                        <Tag className="w-3 h-3" /> {product.category || 'General'}
                                    </span>
                                </td>
                                <td className="py-4 px-6 text-right">
                                    <div className="font-extrabold text-slate-800 flex items-center justify-end">
                                        <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
                                        {Number(product.unit_price || 0).toLocaleString()}
                                    </div>
                                    <div className="text-slate-400 text-xs mt-0.5">/{product.unit_of_measure || 'unit'}</div>
                                </td>
                            </tr>
                        ))}
                        {(!products?.data || products.data.length === 0) && (
                            <tr>
                                <td colSpan={3} className="py-16 text-center text-slate-500">
                                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Package className="w-6 h-6 text-slate-300" />
                                    </div>
                                    <div className="font-bold text-slate-700">No products found</div>
                                    <div className="text-sm mt-1">Add items to your catalog to use them in quotes.</div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
