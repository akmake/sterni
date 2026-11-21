import React from 'react';
import { MoreVertical } from 'lucide-react';
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

/**
 * ActionMenu — כפתור ⋮ אחד במקום שורת כפתורי פעולה (חוסך מקום במובייל, נגיש במקלדת).
 * items: [{ label, icon: LucideIcon, onClick, danger?: boolean, separatorBefore?: boolean, hidden?: boolean }]
 * בשימוש: TasksPage, ProjectsPage, ProjectPage.
 */
export default function ActionMenu({ items, label = 'פעולות', className = '', size = 18 }) {
    const visible = items.filter((i) => !i.hidden);
    if (!visible.length) return null;
    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label={label}
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
                    className={`shrink-0 w-9 h-9 -my-1 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:bg-slate-200 data-[state=open]:bg-slate-100 data-[state=open]:text-slate-700 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${className}`}
                >
                    <MoreVertical size={size} />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6} dir="rtl"
                className="min-w-[190px] rounded-xl p-1.5 shadow-xl border-slate-200/80"
                onClick={(e) => e.stopPropagation()}>
                {visible.map((item, i) => (
                    <React.Fragment key={item.label}>
                        {item.separatorBefore && i > 0 && <DropdownMenuSeparator className="my-1" />}
                        <DropdownMenuItem
                            onSelect={() => item.onClick?.()}
                            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[14px] cursor-pointer
                                ${item.danger ? 'text-red-600 focus:text-red-700 focus:bg-red-50' : 'text-slate-700 focus:bg-slate-100'}`}
                        >
                            {item.icon && <item.icon size={16} className={item.danger ? 'text-red-500' : 'text-slate-400'} />}
                            <span>{item.label}</span>
                        </DropdownMenuItem>
                    </React.Fragment>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
