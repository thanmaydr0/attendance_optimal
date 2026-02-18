import {
    createContext,
    useState,
    useEffect,
    useCallback,
    type ReactNode,
} from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../api/supabase';
import type { Profile } from '../types/database';

// ── Context value shape ─────────────────────────────────────
export interface AuthContextValue {
    user: User | null;
    profile: Profile | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (
        email: string,
        password: string,
        meta?: { full_name?: string; role?: string },
    ) => Promise<void>;
    signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
    undefined,
);

// ── Helper: fetch profile row ───────────────────────────────
async function fetchProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, phone_whatsapp, department, semester, avatar_url, email, created_at')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('Failed to fetch profile:', error.message);
        return null;
    }
    return data;
}

// ── Provider ────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    // Bootstrap: check for an existing session on mount
    useEffect(() => {
        const init = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (session?.user) {
                setUser(session.user);
                const p = await fetchProfile(session.user.id);
                setProfile(p);
            }
            setLoading(false);
        };

        init();

        // Stay reactive to auth changes (login / logout / token refresh)
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user) {
                setUser(session.user);
                const p = await fetchProfile(session.user.id);
                setProfile(p);
            } else {
                setUser(null);
                setProfile(null);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // ── signIn ────────────────────────────────────────────────
    const signIn = useCallback(async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        // onAuthStateChange will handle setting user + profile
    }, []);

    // ── signUp ────────────────────────────────────────────────
    const signUp = useCallback(
        async (
            email: string,
            password: string,
            meta?: { full_name?: string; role?: string },
        ) => {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: meta?.full_name ?? '',
                        role: meta?.role ?? 'student',
                    },
                },
            });
            if (error) throw error;
            // The DB trigger (handle_new_user) auto-inserts the profile row.
            // onAuthStateChange will hydrate state once the session is live.
        },
        [],
    );

    // ── signOut ───────────────────────────────────────────────
    const signOut = useCallback(async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        setUser(null);
        setProfile(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}
