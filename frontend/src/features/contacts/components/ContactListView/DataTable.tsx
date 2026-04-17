import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  SortingState,
  ColumnDef,
} from '@tanstack/react-table';
import { ArrowUpDown, CheckSquare, Square } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ColumnPreference } from '../../api/preferences.api';
import { useMemo, useState, useEffect } from 'react';

interface DataTableProps {
    data: any[];
    columns: ColumnPreference[];
    sortState: { field: string; direction: 'asc' | 'desc' } | null;
    onSortChange: (sort: { field: string; direction: 'asc' | 'desc' }) => void;
    onRowSelectionChange?: (selectedIds: string[]) => void;
}

export default function DataTable({ data, columns: prefColumns, sortState, onSortChange, onRowSelectionChange }: DataTableProps) {
    const navigate = useNavigate();
    const [rowSelection, setRowSelection] = useState({});

    // Notify parent on row selection change
    useEffect(() => {
        if (onRowSelectionChange) {
            const selectedIds = Object.keys(rowSelection).map(index => data[parseInt(index)]?.id).filter(Boolean);
            onRowSelectionChange(selectedIds);
        }
    }, [rowSelection, data, onRowSelectionChange]);

    const visibleCols = useMemo(() => {
        return [...prefColumns]
            .filter(c => c.isVisible)
            .sort((a, b) => a.order - b.order);
    }, [prefColumns]);

    const tableColumns = useMemo<ColumnDef<any>[]>(() => {
        const cols: ColumnDef<any>[] = [
            {
                id: 'select',
                header: ({ table }) => (
                    <div className="px-1 flex items-center h-full w-full justify-center" onClick={(e) => { e.stopPropagation(); table.toggleAllRowsSelected(); }}>
                        {table.getIsAllRowsSelected() ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600 cursor-pointer" />
                        ) : (
                            <Square className="w-4 h-4 text-slate-300 cursor-pointer hover:text-slate-400" />
                        )}
                    </div>
                ),
                cell: ({ row }) => (
                    <div className="px-1 flex items-center h-full w-full justify-center" onClick={(e) => { e.stopPropagation(); row.toggleSelected(); }}>
                        {row.getIsSelected() ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600 cursor-pointer" />
                        ) : (
                            <Square className="w-4 h-4 text-slate-300 cursor-pointer hover:text-slate-400" />
                        )}
                    </div>
                ),
                enableSorting: false,
                size: 48,
            },
        ];

        visibleCols.forEach(prefCol => {
            cols.push({
                accessorKey: prefCol.id,
                header: prefCol.label,
                enableSorting: prefCol.id !== 'actions', // don't sort actions
                cell: (info) => {
                    const row = info.row.original;
                    const val = info.getValue() as any;

                    if (prefCol.id === 'name') {
                        const fullName = `${row.first_name || ''} ${row.last_name || ''}`.trim();
                        // Generate a hash-based color
                        const hash = Array.from(fullName).reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
                        const hue = Math.abs(hash % 360);
                        const initials = (row.first_name?.[0] || '') + (row.last_name?.[0] || '');
                        
                        return (
                            <div className="flex items-center gap-3 w-full">
                                <div 
                                    className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-sm shadow-sm border border-black/5"
                                    style={{
                                        backgroundColor: `hsl(${hue}, 85%, 95%)`,
                                        color: `hsl(${hue}, 80%, 35%)`
                                    }}
                                >
                                    {initials || '?'}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                                        {fullName || 'Unnamed Record'}
                                    </div>
                                    <div className="text-[13px] text-slate-500 truncate">{row.email || 'No email provided'}</div>
                                </div>
                            </div>
                        );
                    }
                    if (prefCol.id === 'owner') {
                        return (
                            <div className="flex flex-col justify-center min-w-0">
                                <span className="text-slate-700 font-medium truncate text-sm">{row.owner?.name || 'Unassigned'}</span>
                                {row.owner && <span className="text-[12px] text-slate-400 truncate hidden sm:block">Owner</span>}
                            </div>
                        );
                    }
                    if (prefCol.id === 'city') {
                        return (
                             <span className="text-slate-600 text-sm truncate block">
                                 {row.address?.city || '—'}
                             </span>
                        );
                    }
                    if (prefCol.id === 'phone') {
                        return (
                            <span className="text-slate-600 text-sm whitespace-nowrap">
                                {val || '—'}
                            </span>
                        );
                    }
                    if (prefCol.id === 'title') {
                        return (
                            <span className="text-slate-600 text-sm font-medium truncate block">
                                {val || '—'}
                            </span>
                        );
                    }
                    if (prefCol.id === 'status' || prefCol.id === 'module') {
                         return (
                             <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                 {val || '—'}
                             </span>
                         );
                    }
                    return <span className="text-slate-700 text-sm truncate block">{val || '—'}</span>;
                }
            });
        });
        return cols;
    }, [visibleCols]);

    // Map custom sortState to Tanstack SortingState
    const sorting: SortingState = useMemo(() => {
        if (!sortState) return [];
        return [{ id: sortState.field, desc: sortState.direction === 'desc' }];
    }, [sortState]);

    const table = useReactTable({
        data,
        columns: tableColumns,
        state: {
            sorting,
            rowSelection,
        },
        enableRowSelection: true,
        onRowSelectionChange: setRowSelection,
        onSortingChange: (updater) => {
            if (typeof updater === 'function') {
                const newSorting = updater(sorting);
                if (newSorting.length > 0) {
                    onSortChange({ field: newSorting[0].id, direction: newSorting[0].desc ? 'desc' : 'asc' });
                }
            }
        },
        getCoreRowModel: getCoreRowModel(),
        manualSorting: true, // We handle sorting in the parent component via API
    });

    return (
        <div className="w-full h-full relative overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
                    {table.getHeaderGroups().map(headerGroup => (
                        <tr key={headerGroup.id}>
                            {headerGroup.headers.map(header => (
                                <th 
                                    key={header.id} 
                                    onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                                    className={`py-3.5 px-4 text-xs font-bold text-slate-600 uppercase tracking-wider ${header.column.getCanSort() ? 'cursor-pointer hover:bg-slate-200/50 group' : ''} transition-colors select-none`}
                                    style={{ width: header.column.getSize() !== 150 ? header.column.getSize() : 'auto' }}
                                >
                                    <div className="flex items-center gap-1.5">
                                        {flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                        )}
                                        {header.column.getCanSort() && (
                                            <ArrowUpDown className={`w-3.5 h-3.5 ${header.column.getIsSorted() ? 'text-indigo-600 w-4 h-4' : 'text-slate-300 group-hover:text-slate-500'}`} />
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                    {table.getRowModel().rows.map(row => (
                        <tr 
                            key={row.id} 
                            onClick={() => navigate(`/contacts/${row.original.id}`)}
                            className={`hover:bg-slate-50 transition-all group cursor-pointer ${row.getIsSelected() ? 'bg-indigo-50/40 hover:bg-indigo-50/60' : ''}`}
                        >
                            {row.getVisibleCells().map(cell => (
                                <td key={cell.id} className="py-3 px-4 first:py-3 align-middle" style={{ width: cell.column.getSize() !== 150 ? cell.column.getSize() : 'auto' }}>
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
