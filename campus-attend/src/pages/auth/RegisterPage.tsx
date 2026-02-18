import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Loader2,
    GraduationCap,
    Mail,
    Lock,
    User,
    Phone,
    Building2,
    BookOpen,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';

const ROLES = ['student', 'faculty', 'club_admin', 'admin'] as const;

const DEPARTMENTS = [
    'Computer Science',
    'Electronics',
    'Mechanical',
    'Civil',
    'Electrical',
    'Information Science',
    'Biotechnology',
    'Chemical',
    'Aerospace',
    'Other',
];

interface FormErrors {
    fullName?: string;
    email?: string;
    phone?: string;
    password?: string;
    confirmPassword?: string;
    role?: string;
    department?: string;
    semester?: string;
}

export default function RegisterPage() {
    const { signUp } = useAuth();
    const navigate = useNavigate();

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState<string>('student');
    const [department, setDepartment] = useState('');
    const [semester, setSemester] = useState('');
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});

    // ── Client-side validation ──────────────────────────────
    const validate = (): boolean => {
        const e: FormErrors = {};

        if (!fullName.trim()) e.fullName = 'Full name is required';
        if (!email.trim()) e.email = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            e.email = 'Enter a valid email address';

        if (phone && !/^\+?\d{7,15}$/.test(phone.replace(/[\s-]/g, '')))
            e.phone = 'Enter a valid phone number';

        if (!password) e.password = 'Password is required';
        else if (password.length < 6) e.password = 'Must be at least 6 characters';

        if (password !== confirmPassword)
            e.confirmPassword = 'Passwords do not match';

        if (!role) e.role = 'Select a role';

        if (role === 'student') {
            if (!department) e.department = 'Department is required for students';
            if (!semester) e.semester = 'Semester is required';
            else if (Number(semester) < 1 || Number(semester) > 10)
                e.semester = 'Semester must be 1–10';
        }

        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (ev: FormEvent) => {
        ev.preventDefault();
        if (!validate()) return;

        setLoading(true);
        try {
            await signUp(email, password, {
                full_name: fullName.trim(),
                role,
            });

            toast.success('Account created! Please sign in.');
            navigate('/login', { replace: true });
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : 'Sign-up failed. Please try again.';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    // ── Shared input class ──────────────────────────────────
    const inputBase =
        'block w-full rounded-lg border py-2.5 pl-10 pr-3 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition sm:text-sm';
    const inputOk = `${inputBase} border-gray-300`;
    const inputErr = `${inputBase} border-red-400 ring-1 ring-red-400`;

    const selectBase =
        'block w-full rounded-lg border py-2.5 pl-10 pr-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition sm:text-sm appearance-none bg-white';

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-teal-50 px-4 py-12">
            <div className="w-full max-w-lg bg-white shadow-xl rounded-2xl p-8 sm:p-10 space-y-8">
                {/* Logo / header */}
                <div className="text-center space-y-2">
                    <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-700">
                        <GraduationCap className="w-9 h-9" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                        Create your account
                    </h1>
                    <p className="text-sm text-gray-500">
                        Join CampusAttend to manage your attendance
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Full Name */}
                    <div>
                        <label htmlFor="reg-name" className="block text-sm font-medium text-gray-700 mb-1">
                            Full Name
                        </label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                            <input
                                id="reg-name"
                                type="text"
                                autoComplete="name"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className={errors.fullName ? inputErr : inputOk}
                                placeholder="John Doe"
                            />
                        </div>
                        {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName}</p>}
                    </div>

                    {/* Email */}
                    <div>
                        <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1">
                            Email address
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                            <input
                                id="reg-email"
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={errors.email ? inputErr : inputOk}
                                placeholder="you@example.com"
                            />
                        </div>
                        {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
                    </div>

                    {/* Phone (WhatsApp) */}
                    <div>
                        <label htmlFor="reg-phone" className="block text-sm font-medium text-gray-700 mb-1">
                            Phone (WhatsApp)
                            <span className="text-gray-400 font-normal"> — optional</span>
                        </label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                            <input
                                id="reg-phone"
                                type="tel"
                                autoComplete="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className={errors.phone ? inputErr : inputOk}
                                placeholder="+91 98765 43210"
                            />
                        </div>
                        {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
                    </div>

                    {/* Password + Confirm — side by side on sm+ */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="reg-pass" className="block text-sm font-medium text-gray-700 mb-1">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                                <input
                                    id="reg-pass"
                                    type="password"
                                    autoComplete="new-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={errors.password ? inputErr : inputOk}
                                    placeholder="••••••••"
                                />
                            </div>
                            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
                        </div>

                        <div>
                            <label htmlFor="reg-confirm" className="block text-sm font-medium text-gray-700 mb-1">
                                Confirm Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                                <input
                                    id="reg-confirm"
                                    type="password"
                                    autoComplete="new-password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className={errors.confirmPassword ? inputErr : inputOk}
                                    placeholder="••••••••"
                                />
                            </div>
                            {errors.confirmPassword && (
                                <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>
                            )}
                        </div>
                    </div>

                    {/* Role */}
                    <div>
                        <label htmlFor="reg-role" className="block text-sm font-medium text-gray-700 mb-1">
                            Role
                        </label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                            <select
                                id="reg-role"
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                className={`${errors.role ? inputErr : selectBase} ${errors.role ? '' : 'border-gray-300'}`}
                            >
                                {ROLES.map((r) => (
                                    <option key={r} value={r}>
                                        {r.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {errors.role && <p className="mt-1 text-xs text-red-500">{errors.role}</p>}
                    </div>

                    {/* Department & Semester (students only) */}
                    {role === 'student' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="reg-dept" className="block text-sm font-medium text-gray-700 mb-1">
                                    Department
                                </label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                                    <select
                                        id="reg-dept"
                                        value={department}
                                        onChange={(e) => setDepartment(e.target.value)}
                                        className={`${errors.department ? inputErr : selectBase} ${errors.department ? '' : 'border-gray-300'}`}
                                    >
                                        <option value="">Select…</option>
                                        {DEPARTMENTS.map((d) => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>
                                {errors.department && (
                                    <p className="mt-1 text-xs text-red-500">{errors.department}</p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="reg-sem" className="block text-sm font-medium text-gray-700 mb-1">
                                    Semester
                                </label>
                                <div className="relative">
                                    <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                                    <input
                                        id="reg-sem"
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={semester}
                                        onChange={(e) => setSemester(e.target.value)}
                                        className={errors.semester ? inputErr : inputOk}
                                        placeholder="1–10"
                                    />
                                </div>
                                {errors.semester && (
                                    <p className="mt-1 text-xs text-red-500">{errors.semester}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed transition mt-2"
                    >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {loading ? 'Creating account…' : 'Create Account'}
                    </button>
                </form>

                {/* Footer link */}
                <p className="text-center text-sm text-gray-500">
                    Already have an account?{' '}
                    <Link
                        to="/login"
                        className="font-semibold text-teal-600 hover:text-teal-500 transition"
                    >
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}
