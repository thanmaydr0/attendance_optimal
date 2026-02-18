import DashboardLayout from '../../components/DashboardLayout';
import type { NavItem } from '../../components/DashboardLayout';
import {
    LayoutDashboard,
    BookOpen,
    CalendarCheck,
    MessageSquare,
} from 'lucide-react';

const NAV_ITEMS: NavItem[] = [
    { label: 'Dashboard', to: '/faculty/dashboard', icon: LayoutDashboard },
    { label: 'Subjects', to: '/faculty/subjects', icon: BookOpen },
    { label: 'Attendance', to: '/faculty/attendance', icon: CalendarCheck },
    { label: 'Requests', to: '/faculty/requests', icon: MessageSquare },
];

export default function FacultyLayout() {
    return <DashboardLayout navItems={NAV_ITEMS} title="CampusAttend" />;
}
