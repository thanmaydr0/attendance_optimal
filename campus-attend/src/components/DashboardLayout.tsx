import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
    PanelLeftClose,
    PanelLeftOpen,
    LogOut,
    type LucideIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface NavItem {
    label: string;
    to: string;
    icon: LucideIcon;
}

const ROLE_COLORS: Record<string, string> = {
    student: 'bg-teal-100 text-teal-700',
    faculty: 'bg-amber-100 text-amber-700',
    club_admin: 'bg-purple-100 text-purple-700',
    admin: 'bg-red-100 text-red-700',
};

interface DashboardLayoutProps {
    navItems: NavItem[];
    title: string;
}

export default function DashboardLayout({ navItems, title }: DashboardLayoutProps) {
    const { profile, signOut } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const handleSignOut = async () => {
        try {
            await signOut();
            toast.success('Signed out');
            navigate('/login', { replace: true });
        } catch {
            toast.error('Failed to sign out');
        }
    };

    const roleLabel = profile?.role?.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ?? '';
    const roleBadge = ROLE_COLORS[profile?.role ?? ''] ?? 'bg-gray-100 text-gray-700';

    const linkBase =
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors';
    const linkActive = 'bg-indigo-50 text-indigo-700';
    const linkInactive = 'text-gray-600 hover:bg-gray-100 hover:text-gray-900';

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* ── Sidebar (desktop) ───────────────────────────── */}
            <aside
                className={`hidden md:flex flex-col border-r border-gray-200 bg-white transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-[72px]'
                    }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
                    {sidebarOpen && (
                        <span className="text-lg font-bold text-indigo-700 truncate">
                            {title}
                        </span>
                    )}
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition"
                        aria-label="Toggle sidebar"
                    >
                        {sidebarOpen ? (
                            <PanelLeftClose className="w-5 h-5" />
                        ) : (
                            <PanelLeftOpen className="w-5 h-5" />
                        )}
                    </button>
                </div>

                {/* Nav links */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end
                            className={({ isActive }) =>
                                `${linkBase} ${isActive ? linkActive : linkInactive}`
                            }
                        >
                            <item.icon className="w-5 h-5 shrink-0" />
                            {sidebarOpen && <span className="truncate">{item.label}</span>}
                        </NavLink>
                    ))}
                </nav>

                {/* User card */}
                <div className="border-t border-gray-200 p-4 space-y-3">
                    <div className="flex items-center gap-3">
                        {profile?.avatar_url ? (
                            <img
                                src={profile.avatar_url}
                                alt=""
                                className="w-9 h-9 rounded-full object-cover ring-2 ring-indigo-100"
                            />
                        ) : (
                            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                                {profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                            </div>
                        )}
                        {sidebarOpen && (
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">
                                    {profile?.full_name}
                                </p>
                                <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${roleBadge}`}>
                                    {roleLabel}
                                </span>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleSignOut}
                        className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition ${sidebarOpen ? '' : 'justify-center'
                            }`}
                    >
                        <LogOut className="w-4 h-4" />
                        {sidebarOpen && 'Sign Out'}
                    </button>
                </div>
            </aside>

            {/* ── Main content ─────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Mobile top bar */}
                <header className="md:hidden flex items-center justify-between h-14 px-4 bg-white border-b border-gray-200">
                    <span className="text-lg font-bold text-indigo-700">{title}</span>
                    <div className="flex items-center gap-2">
                        {profile?.avatar_url ? (
                            <img
                                src={profile.avatar_url}
                                alt=""
                                className="w-8 h-8 rounded-full object-cover ring-2 ring-indigo-100"
                            />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                                {profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                            </div>
                        )}
                        <button
                            onClick={handleSignOut}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition"
                            aria-label="Sign out"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto pb-20 md:pb-8">
                    <Outlet />
                </main>
            </div>

            {/* ── Bottom navigation (mobile) ───────────────────── */}
            <nav className="md:hidden fixed inset-x-0 bottom-0 bg-white border-t border-gray-200 flex items-center justify-around h-16 z-50">
                {navItems.slice(0, 5).map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end
                        className={({ isActive }) =>
                            `flex flex-col items-center gap-0.5 text-[11px] font-medium transition ${isActive ? 'text-indigo-700' : 'text-gray-400'
                            }`
                        }
                    >
                        <item.icon className="w-5 h-5" />
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>
        </div>
    );
}
