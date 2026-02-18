import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, GraduationCap, Mail, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';

const ROLE_DASHBOARDS: Record<string, string> = {
    student: '/student/dashboard',
    faculty: '/faculty/dashboard',
    club_admin: '/club/dashboard',
    admin: '/admin/dashboard',
};

export default function LoginPage() {
    const { signIn, profile } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (!email || !password) {
            toast.error('Please fill in all fields');
            return;
        }

        setLoading(true);
        try {
            await signIn(email, password);

            // Small delay to let onAuthStateChange hydrate the profile
            await new Promise((r) => setTimeout(r, 400));

            // The profile may already be set by now,
            // but we also handle the case where it isn't yet.
            const dest = profile?.role
                ? ROLE_DASHBOARDS[profile.role] ?? '/student/dashboard'
                : '/student/dashboard';

            toast.success('Welcome back!');
            navigate(dest, { replace: true });
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : 'Sign-in failed. Please try again.';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-teal-50 px-4">
            {/* ── Card ──────────────────────────────────────────── */}
            <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8 sm:p-10 space-y-8">
                {/* Logo / header */}
                <div className="text-center space-y-2">
                    <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-700">
                        <GraduationCap className="w-9 h-9" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                        CampusAttend
                    </h1>
                    <p className="text-sm text-gray-500">
                        Sign in to your account
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Email */}
                    <div>
                        <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">
                            Email address
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                            <input
                                id="login-email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="block w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition sm:text-sm"
                                placeholder="you@example.com"
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div>
                        <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">
                            Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                            <input
                                id="login-password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition sm:text-sm"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed transition"
                    >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {loading ? 'Signing in…' : 'Sign In'}
                    </button>
                </form>

                {/* Footer link */}
                <p className="text-center text-sm text-gray-500">
                    Don&apos;t have an account?{' '}
                    <Link
                        to="/register"
                        className="font-semibold text-teal-600 hover:text-teal-500 transition"
                    >
                        Create an account
                    </Link>
                </p>
            </div>
        </div>
    );
}
