import re

with open('src/pages/Settings/SystemSettings.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove RolesTab from Tabs
content = re.sub(r"\{\s*key:\s*'roles',\s*label:\s*'Roles',\s*icon:\s*'shield_person'\s*\},\n\s*", "", content)
content = re.sub(r"\{\s*activeTab\s*===\s*'roles'\s*&&\s*<RolesTab\s*/>\s*\}\n\s*", "", content)

# 2. Update Types in UsuariosTab
content = content.replace("useState<(AppUser & { role?: AppRole })[]>([])", "useState<AppUser[]>([])")
content = content.replace(", rolesRes] = await Promise.all([", "] = await Promise.all([")
content = content.replace("supabase.from('app_users').select('*, role:app_roles(*)').order('full_name'),\n            supabase.from('app_roles').select('*').order('name'),", "supabase.from('app_users').select('*').order('full_name'),")

# 3. Update Form State
content = content.replace(
    "const [form, setForm] = useState({ full_name: '', email: '', password: '', role_id: '', avatar_color: '#6366f1', phone: '' });",
    "const [form, setForm] = useState({ full_name: '', email: '', password: '', permissions: buildEmptyPermissions(), avatar_color: '#6366f1', phone: '' });"
)

content = content.replace(
    "setForm({ full_name: u.full_name, email: u.email, password: '', role_id: u.role_id || '', avatar_color: u.avatar_color || '#6366f1', phone: u.phone || '' });",
    "const merged = { ...buildEmptyPermissions(), ...(u.permissions || {}) };\n        setForm({ full_name: u.full_name, email: u.email, password: '', permissions: merged as any, avatar_color: u.avatar_color || '#6366f1', phone: u.phone || '' });"
)

content = content.replace(
    "setForm({ full_name: '', email: '', password: '', role_id: roles[0]?.id || '', avatar_color: '#6366f1', phone: '' });",
    "setForm({ full_name: '', email: '', password: '', permissions: buildEmptyPermissions(), avatar_color: '#6366f1', phone: '' });"
)

content = content.replace(
    "setForm(f => ({ ...f, role_id: roles[0]?.id || '' }));",
    "setForm(f => ({ ...f, permissions: buildEmptyPermissions() }));"
)

# 4. Update the save logic in handleCreateUser
payload_update = """const { error } = await supabase.from('app_users').update({
                full_name: form.full_name.trim(),
                email: form.email.trim().toLowerCase(),
                permissions: form.permissions,
                avatar_color: form.avatar_color,
                phone: form.phone.trim() || null,
            }).eq('id', editingUser.id);"""
content = re.sub(
    r"const \{ error \} = await supabase.from\('app_users'\).update\(\{.*?\}\).eq\('id', editingUser.id\);",
    payload_update,
    content,
    flags=re.DOTALL
)

create_call = """const { data } = await supabase.rpc('create_app_user', {
                p_full_name: form.full_name.trim(),
                p_email: form.email.trim().toLowerCase(),
                p_password: form.password,
                p_permissions: form.permissions,
                p_avatar_color: form.avatar_color,
                p_phone: form.phone.trim() || null,
            });"""
content = re.sub(
    r"const \{ data \} = await supabase\.rpc\('create_app_user',\s*\{.*?p_phone:.*?\n\s+\}\);",
    create_call,
    content,
    flags=re.DOTALL
)

# 5. Remove 'const [roles, setRoles]'
content = re.sub(r"const \[roles, setRoles\] = useState<AppRole\[\]>\(\[\]\);\n\s*", "", content)
content = re.sub(r"setRoles\(rolesRes\.data \|\| \[\]\);\n\s*", "", content)

# 6. Replace Role Select input with Permissions Matrix in User Form
# find the role select block
role_select = """<div>
                            <label className={labelClass}>Rol</label>
                            <select value={form.role_id} onChange={e => setForm({ ...form, role_id: e.target.value })} className={inputClass}>
                                <option value="">Sin rol</option>
                                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        </div>"""

content = content.replace(role_select, "")

# Find the end of user grid and insert matrix
matrix_code = """
                    {/* Permissions Matrix */}
                    <div className="col-span-full mt-4">
                        <h5 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Matriz de Permisos Individuales</h5>
                        <div className="rounded-xl border border-slate-200/60 bg-white/50 overflow-hidden dark:border-slate-800/60 dark:bg-slate-900/50">
                            <table className="w-full text-sm">
                                <thead className="border-b border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/50">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-500">Módulo</th>
                                        <th className="px-3 py-3 text-center font-semibold text-slate-500 w-20">Ver</th>
                                        <th className="px-3 py-3 text-center font-semibold text-slate-500 w-20">Crear</th>
                                        <th className="px-3 py-3 text-center font-semibold text-slate-500 w-20">Editar</th>
                                        <th className="px-3 py-3 text-center font-semibold text-slate-500 w-20">Eliminar</th>
                                        <th className="px-3 py-3 text-center font-semibold text-slate-500 w-20">Todo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {MODULE_KEYS.map(m => {
                                        const p = (form.permissions as any)[m.key] || { view: false, create: false, edit: false, delete: false };
                                        const allChecked = p.view && p.create && p.edit && p.delete;
                                        
                                        const togglePerm = (moduleKey: string, action: 'view' | 'create' | 'edit' | 'delete') => {
                                            setForm(prev => {
                                                const perms = { ...prev.permissions } as any;
                                                const mod = { ...(perms[moduleKey] || { view: false, create: false, edit: false, delete: false }) };
                                                mod[action] = !mod[action];
                                                if (action === 'view' && !mod[action]) {
                                                    mod.create = false; mod.edit = false; mod.delete = false;
                                                }
                                                if (action !== 'view' && mod[action]) { mod.view = true; }
                                                perms[moduleKey] = mod;
                                                return { ...prev, permissions: perms };
                                            });
                                        };
                                        const selectAllForModule = (moduleKey: string, value: boolean) => {
                                            setForm(prev => {
                                                const perms = { ...prev.permissions } as any;
                                                perms[moduleKey] = { view: value, create: value, edit: value, delete: value };
                                                return { ...prev, permissions: perms };
                                            });
                                        };
                                        return (
                                            <tr key={m.key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-[18px] text-slate-400">{m.icon}</span>
                                                        <span className="font-medium text-slate-700 dark:text-slate-300">{m.label}</span>
                                                    </div>
                                                </td>
                                                {(['view', 'create', 'edit', 'delete'] as const).map(action => (
                                                    <td key={action} className="px-3 py-3 text-center">
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); togglePerm(m.key, action); }}
                                                            className={`h-6 w-6 rounded-md border-2 transition-all mx-auto flex items-center justify-center ${
                                                                p[action]
                                                                    ? 'border-primary bg-primary text-white'
                                                                    : 'border-slate-300 bg-white hover:border-primary/50 dark:border-slate-600 dark:bg-slate-800'
                                                            }`}
                                                        >
                                                            {p[action] && <span className="material-symbols-outlined text-[16px]">check</span>}
                                                        </button>
                                                    </td>
                                                ))}
                                                <td className="px-3 py-3 text-center">
                                                    <button
                                                        onClick={(e) => { e.preventDefault(); selectAllForModule(m.key, !allChecked); }}
                                                        className={`h-6 w-6 rounded-md border-2 transition-all mx-auto flex items-center justify-center ${
                                                            allChecked
                                                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                                                : 'border-slate-300 bg-white hover:border-emerald-400 dark:border-slate-600 dark:bg-slate-800'
                                                        }`}
                                                    >
                                                        {allChecked && <span className="material-symbols-outlined text-[16px]">done_all</span>}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
"""

# Insert the matrix code just before the close of the grid
content = re.sub(
    r"(</div>\s*</div>\s*\{/\*\s*Password strength indicator\s*\*/\})",
    matrix_code + r" \n \1",
    content
)

# 7. Remove RolesTab Component entirely from end of file
content = re.sub(r"// ============================================================\n// TAB 4: ROLES\n// ============================================================.*$", "", content, flags=re.DOTALL)

# 8. Remove the display of user roles in the table card
content = re.sub(r'<span className="inline-flex items-center rounded-full bg-primary/10 px-2\.5 py-0\.5 text-\[10px\] font-bold text-primary">\s*\{u\.role\?\.name \|\| \'Sin rol\'\}\s*</span>', "", content)

# 9. Clean up module types
content = content.replace("AppRole, ", "")

with open('src/pages/Settings/SystemSettings.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
