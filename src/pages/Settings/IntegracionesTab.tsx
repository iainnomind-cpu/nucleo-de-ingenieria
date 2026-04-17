import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';
const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';

export default function IntegracionesTab() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchCreds = async () => {
            const { data } = await supabase.from('system_settings').select('*').eq('key', 'email_credentials').single();
            if (data?.value) {
                setEmail(data.value.email || '');
                setPassword(data.value.app_password || '');
            }
            setLoading(false);
        };
        fetchCreds();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        // Using upsert in case it doesn't exist yet
        const { error } = await supabase.from('system_settings').upsert({
            key: 'email_credentials',
            value: { email, app_password: password },
            description: 'Credenciales de Gmail App Password'
        }, { onConflict: 'key' });
        
        setSaving(false);
        if (!error) {
            alert('Credenciales de Gmail guardadas correctamente.');
        } else {
            alert('Error al guardar credenciales: ' + error.message);
        }
    };

    if (loading) {
        return <div className="flex justify-center p-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="rounded-xl border border-red-200/60 bg-red-50/50 p-6 shadow-sm dark:border-red-900/40 dark:bg-red-900/10">
                <div className="flex items-center gap-2 mb-2 text-red-600 dark:text-red-400">
                    <span className="material-symbols-outlined text-[20px]">mail</span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Conexión Gmail</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                    Configura las credenciales de tu cuenta de Gmail para enviar las cotizaciones y alertas del sistema automáticamente.
                </p>

                <form onSubmit={handleSave}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className={labelClass}>Correo Gmail</label>
                            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                                className={inputClass} placeholder="ia.innomind@gmail.com" />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Contraseña de Aplicación
                                </label>
                                <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                                    ¿Cómo obtenerla?
                                </a>
                            </div>
                            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                                className={inputClass} placeholder="••••••••••••••••" />
                        </div>
                    </div>

                    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 mb-6 dark:border-blue-900/30 dark:bg-blue-900/10 text-sm text-blue-900 dark:text-blue-300">
                        <div className="font-bold flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                            Cómo generar una Contraseña de Aplicación:
                        </div>
                        <ol className="list-decimal pl-6 space-y-2">
                            <li>Ve a <a href="https://myaccount.google.com/security" className="underline font-semibold hover:text-blue-600" target="_blank" rel="noreferrer">myaccount.google.com/security</a></li>
                            <li>Activa la <strong>Verificación en 2 pasos</strong> si no la tienes</li>
                            <li>Ve a <a href="https://myaccount.google.com/apppasswords" className="underline font-semibold hover:text-blue-600" target="_blank" rel="noreferrer">myaccount.google.com/apppasswords</a></li>
                            <li>En "Nombre de app" escribe: <strong>Núcleo ERP</strong></li>
                            <li>Haz clic en <strong>Crear</strong></li>
                            <li>Copia la contraseña de 16 caracteres que aparece</li>
                            <li>Pégala aquí en el campo de Contraseña de Aplicación</li>
                        </ol>
                        <p className="mt-4 text-amber-600 dark:text-amber-500 font-medium italic flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px]">warning</span> 
                            Esta NO es tu contraseña normal de Gmail. Es una contraseña especial para apps.
                        </p>
                    </div>

                    <button type="submit" disabled={saving} className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                        {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <span className="material-symbols-outlined text-[18px]">save</span>}
                        {saving ? 'Guardando...' : 'Guardar Credenciales'}
                    </button>
                </form>
            </div>
        </div>
    );
}
