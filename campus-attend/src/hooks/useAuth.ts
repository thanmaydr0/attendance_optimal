import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from '../context/AuthContext';

/**
 * Access the auth context.
 * Must be used inside an <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (ctx === undefined) {
        throw new Error('useAuth must be used within an <AuthProvider>');
    }
    return ctx;
}
