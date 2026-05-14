// ============================================================
// Tipos para el sistema de autenticación y permisos
// ============================================================

export interface ModulePermission {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
}

export type ModulePermissions = Record<string, ModulePermission>;

export interface AppUser {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
    role_name?: string;
    permissions?: ModulePermissions;
    avatar_color: string;
    is_active: boolean;
    last_login: string | null;
    created_at?: string;
    updated_at?: string;
}

// ============================================================
// Constantes
// ============================================================

export const MODULE_KEYS = [
    { key: 'dashboard', label: 'Dashboard', icon: 'space_dashboard' },
    { key: 'crm', label: 'CRM & Clientes', icon: 'people' },
    { key: 'quotes', label: 'Cotizaciones', icon: 'request_quote' },
    { key: 'projects', label: 'Proyectos', icon: 'engineering' },
    { key: 'inventory', label: 'Inventario', icon: 'warehouse' },
    { key: 'maintenance', label: 'Mantenimiento', icon: 'build' },
    { key: 'finance', label: 'Finanzas', icon: 'account_balance' },
    { key: 'fleet', label: 'Flotilla', icon: 'local_shipping' },
    { key: 'whatsapp', label: 'WhatsApp Mktg', icon: 'chat' },
    { key: 'team', label: 'Equipo', icon: 'forum' },
    { key: 'tasks', label: 'Tablero de Tareas', icon: 'task' },
    { key: 'settings', label: 'Configuración', icon: 'settings' },
] as const;

export const DEFAULT_PERMISSION: ModulePermission = {
    view: false,
    create: false,
    edit: false,
    delete: false,
};

export const FULL_PERMISSION: ModulePermission = {
    view: true,
    create: true,
    edit: true,
    delete: true,
};

export function buildEmptyPermissions(): ModulePermissions {
    const perms: ModulePermissions = {};
    MODULE_KEYS.forEach(m => { perms[m.key] = { ...DEFAULT_PERMISSION }; });
    return perms;
}

export function buildFullPermissions(): ModulePermissions {
    const perms: ModulePermissions = {};
    MODULE_KEYS.forEach(m => { perms[m.key] = { ...FULL_PERMISSION }; });
    return perms;
}

// ============================================================
// Validación de contraseña
// ============================================================

export const PASSWORD_RULES = [
    { key: 'length', label: 'Mínimo 8 caracteres', test: (p: string) => p.length >= 8 },
    { key: 'uppercase', label: 'Al menos 1 mayúscula', test: (p: string) => /[A-Z]/.test(p) },
    { key: 'lowercase', label: 'Al menos 1 minúscula', test: (p: string) => /[a-z]/.test(p) },
    { key: 'number', label: 'Al menos 1 número', test: (p: string) => /[0-9]/.test(p) },
    { key: 'special', label: 'Al menos 1 carácter especial (!@#$%...)', test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

export function isPasswordValid(password: string): boolean {
    return PASSWORD_RULES.every(r => r.test(password));
}

export function getPasswordStrength(password: string): number {
    return PASSWORD_RULES.filter(r => r.test(password)).length;
}

// ============================================================
// Colores para avatares
// ============================================================

export const AVATAR_COLORS = [
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e', '#ef4444', '#f97316',
    '#f59e0b', '#eab308', '#84cc16', '#22c55e',
    '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
];
