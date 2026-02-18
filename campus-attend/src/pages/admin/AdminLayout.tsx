import DashboardLayout from '../../components/DashboardLayout';
import type { NavItem } from '../../components/DashboardLayout';
import {
    LayoutDashboard,
    Users,
    GraduationCap,
} from 'lucide-react';

const NAV_ITEMS: NavItem[] = [
    { label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Users', to: '/admin/users', icon: Users },
    { label: 'Semester', to: '/admin/semester', icon: GraduationCap },
];

export default function AdminLayout() {
    return <DashboardLayout navItems={NAV_ITEMS} title="CampusAttend" />;
}
