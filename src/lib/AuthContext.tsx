import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    ReactNode,
    useMemo
} from 'react';

import { supabase, getAuthedClient } from './supabase';
import { AppUser, ModulePermissions } from '../types/auth';

interface AuthContextType {
    user: AppUser | null;
    loading: boolean;

    login: (
        email: string,
        password: string
    ) => Promise<{ success: boolean; message?: string }>;

    logout: () => void;

    hasPermission: (
        moduleKey: string,
        action: 'view' | 'create' | 'edit' | 'delete'
    ) => boolean;

    refreshUser: () => Promise<void>;

    db: ReturnType<typeof getAuthedClient>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'nucleo_erp_user';
const TOKEN_KEY = 'nucleo_erp_token';

export function AuthProvider({ children }: { children: ReactNode }) {

    const [user, setUser] = useState<AppUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    /**
     * Cliente autenticado dinámicamente
     */
    const db = useMemo(() => {
        if (!token) return supabase;
        return getAuthedClient(token);
    }, [token]);

    /**
     * Restaurar sesión
     */
    useEffect(() => {
        try {
            const storedUser = localStorage.getItem(STORAGE_KEY);
            const storedToken = localStorage.getItem(TOKEN_KEY);

            if (storedUser && storedToken) {
                setUser(JSON.parse(storedUser) as AppUser);
                setToken(storedToken);
            }
        } catch {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(TOKEN_KEY);
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Login
     */
    const login = useCallback(async (
        email: string,
        password: string
    ) => {

        try {

            const { data, error } = await supabase.rpc(
                'authenticate_user',
                {
                    p_email: email,
                    p_password: password,
                }
            );

            if (error) {
                return {
                    success: false,
                    message: 'Error de conexión al servidor'
                };
            }

            const result = data as {
                success: boolean;
                message?: string;
                user?: AppUser;
                token?: string;
            };

            if (!result.success || !result.user || !result.token) {
                return {
                    success: false,
                    message: result.message || 'Credenciales inválidas'
                };
            }

            /**
             * Guardar sesión
             */
            setUser(result.user);
            setToken(result.token);

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(result.user)
            );

            localStorage.setItem(
                TOKEN_KEY,
                result.token
            );

            return { success: true };

        } catch {

            return {
                success: false,
                message: 'Error inesperado al autenticar'
            };

        }

    }, []);

    /**
     * Logout
     */
    const logout = useCallback(() => {

        setUser(null);
        setToken(null);

        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(TOKEN_KEY);

    }, []);

    /**
     * Permisos frontend (solo UI)
     */
    const hasPermission = useCallback((
        moduleKey: string,
        action: 'view' | 'create' | 'edit' | 'delete'
    ) => {

        if (!user?.permissions) return false;

        const perms = user.permissions as ModulePermissions;

        let mod = perms[moduleKey];

        /**
         * Compatibilidad legacy
         */
        if (!mod && moduleKey === 'tasks') {
            mod = perms['team'];
        }

        if (!mod) return false;

        return mod[action] === true;

    }, [user]);

    /**
     * Refresca usuario
     */
    const refreshUser = useCallback(async () => {

        if (!user) return;

        const { data: userData, error } = await db
            .from('app_users')
            .select(`
                *,
                app_roles (
                    permissions
                )
            `)
            .eq('id', user.id)
            .single();

        if (error || !userData) return;

        const refreshed: AppUser = {
            ...userData,
            permissions: userData.app_roles?.permissions || {}
        };

        setUser(refreshed);

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(refreshed)
        );

    }, [db, user]);

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                login,
                logout,
                hasPermission,
                refreshUser,
                db
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {

    const context = useContext(AuthContext);

    if (!context) {
        throw new Error(
            'useAuth debe usarse dentro de un AuthProvider'
        );
    }

    return context;
}
