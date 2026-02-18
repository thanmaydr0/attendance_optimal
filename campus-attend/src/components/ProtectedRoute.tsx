import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
    role?: string;
    children: React.ReactNode;
}

export default function ProtectedRoute({ role, children }: ProtectedRouteProps) {
    const { user, profile, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (role && profile && profile.role !== role) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
                <div className="bg-white shadow-lg rounded-2xl p-10 max-w-sm space-y-4">
                    <div className="text-5xl">🚫</div>
                    <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
                    <p className="text-sm text-gray-500">
                        You don&apos;t have permission to view this page. Your role is{' '}
                        <span className="font-semibold text-indigo-700">{profile.role}</span>.
                    </p>
                    <a
                        href={`/${profile.role === 'club_admin' ? 'club' : profile.role}/dashboard`}
                        className="inline-block mt-2 text-sm font-semibold text-teal-600 hover:text-teal-500 transition"
                    >
                        Go to your dashboard →
                    </a>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
