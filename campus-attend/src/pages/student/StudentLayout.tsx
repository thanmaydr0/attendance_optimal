import DashboardLayout from '../../components/DashboardLayout';
import type { NavItem } from '../../components/DashboardLayout';
import {
    LayoutDashboard,
    Calendar,
    CalendarCheck,
    PartyPopper,
    Map,
    QrCode,
} from 'lucide-react';

const NAV_ITEMS: NavItem[] = [
    { label: 'Dashboard', to: '/student/dashboard', icon: LayoutDashboard },
    { label: 'Timetable', to: '/student/timetable', icon: Calendar },
    { label: 'Attendance', to: '/student/attendance', icon: CalendarCheck },
    { label: 'Events', to: '/student/events', icon: PartyPopper },
    { label: 'Roadmap', to: '/student/roadmap', icon: Map },
];

// Not in bottom nav, but accessible via routes:
// /student/check-in/:eventId → uses QrCode icon

export { QrCode }; // re-export for reference

export default function StudentLayout() {
    return <DashboardLayout navItems={NAV_ITEMS} title="CampusAttend" />;
}
