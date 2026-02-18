import DashboardLayout from '../../components/DashboardLayout';
import type { NavItem } from '../../components/DashboardLayout';
import {
    LayoutDashboard,
    PartyPopper,
    Users,
} from 'lucide-react';

const NAV_ITEMS: NavItem[] = [
    { label: 'Dashboard', to: '/club/dashboard', icon: LayoutDashboard },
    { label: 'Events', to: '/club/events', icon: PartyPopper },
    { label: 'Attendees', to: '/club/attendees', icon: Users },
];

export default function ClubLayout() {
    return <DashboardLayout navItems={NAV_ITEMS} title="CampusAttend" />;
}
