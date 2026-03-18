import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
    LayoutDashboard, 
    Users, 
    Building2, 
    Magnet, 
    KanbanSquare, 
    LogOut,
    Menu,
    Bell,
    Search,
    IndianRupee,
    Settings,
    FileText,
    Package
} from 'lucide-react';
import { STORAGE_KEYS } from '../../lib/constants';

const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Leads', href: '/leads', icon: Magnet },
    { name: 'Contacts', href: '/contacts', icon: Users },
    { name: 'Accounts', href: '/accounts', icon: Building2 },
    { name: 'Products', href: '/products', icon: Package },
    { name: 'Quotes', href: '/quotes', icon: FileText },
    { name: 'Deals', href: '/deals', icon: IndianRupee },
    { name: 'Pipeline', href: '/pipeline', icon: KanbanSquare },
    { name: 'Admin', href: '/admin', icon: Users },
    { name: 'Settings', href: '/settings', icon: Settings },
];

export function AppLayout() {
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem(STORAGE_KEYS.accessToken);
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 text-slate-300 hidden md:flex flex-col border-r border-slate-800">
                <div className="h-16 flex items-center px-6 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white font-bold text-xl">
                            O
                        </div>
                        <span className="text-white font-bold text-xl tracking-tight">Orbis</span>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                    {navigation.map((item) => {
                        const isActive = location.pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
                                    isActive 
                                        ? 'bg-indigo-500/10 text-indigo-400' 
                                        : 'hover:bg-slate-800 hover:text-white'
                                }`}
                            >
                                <item.icon className={`w-5 h-5 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <button 
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Header */}
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0 z-10">
                    <div className="flex items-center flex-1 gap-4">
                        <button className="md:hidden p-2 -ml-2 text-slate-500 rounded-md hover:bg-slate-100">
                            <Menu className="w-6 h-6" />
                        </button>
                        
                        <div className="max-w-md w-full hidden sm:block relative">
                            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text"
                                placeholder="Search everything..." 
                                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition-shadow"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="p-2 text-slate-400 hover:text-slate-500 rounded-full hover:bg-slate-100 relative">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>
                        <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden">
                            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User avatar" />
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-auto bg-slate-50 relative">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

export default AppLayout;
