import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabase';
import { AppUser, ModulePermissions } from '../types/auth';

interface AuthContextType {
    user: AppUser | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
    logout: () => void;
    hasPermission: (moduleKey: string, action: 'view' | 'create' | 'edit' | 'delete') => boolean;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const STORAGE_KEY = 'nucleo_erp_user';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);

    // Rehidratar desde localStorage al montar
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as AppUser;
                setUser(parsed);
            } catch {
                localStorage.removeItem(STORAGE_KEY);
            }
        }
        setLoading(false);
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        try {
            const { data, error } = await supabase.rpc('authenticate_user', {
                p_email: email,
                p_password: password,
            });

            if (error) {
                return { success: false, message: 'Error de conexión al servidor' };
            }

            const result = data as { success: boolean; message?: string; user?: AppUser };

            if (!result.success) {
                return { success: false, message: result.message || 'Credenciales inválidas' };
            }

            const loggedUser = result.user!;
            setUser(loggedUser);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(loggedUser));
            return { success: true };
        } catch {
            return { success: false, message: 'Error inesperado al autenticar' };
        }
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    const hasPermission = useCallback((moduleKey: string, action: 'view' | 'create' | 'edit' | 'delete') => {
        if (!user || !user.permissions) return false;
        const mod = (user.permissions as ModulePermissions)[moduleKey];
        if (!mod) return false;
        return mod[action] === true;
    }, [user]);

    const refreshUser = useCallback(async () => {
        if (!user) return;
        // Recargar datos del usuario desde la BD
        const { data: userData } = await supabase
            .from('app_users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (userData) {
            const refreshed: AppUser = {
                ...userData,
                permissions: userData.permissions,
            };
            setUser(refreshed);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(refreshed));
        }
    }, [user]);

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, hasPermission, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth debe usarse dentro de un AuthProvider');
    }
    return context;
}
