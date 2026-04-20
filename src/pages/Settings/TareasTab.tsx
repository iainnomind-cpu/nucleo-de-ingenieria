import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import WhatsAppRules from '../WhatsApp/WhatsAppRules';

interface BusinessRule {
    id: string;
    name: string;
    description: string;
    trigger_event: string;
    action: string;
    is_active: boolean;
    config: any;
}

export default function TareasTab() {
    const [rules, setRules] = useState<BusinessRule[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRules = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('business_rules')
                .select('*')
                .order('created_at', { ascending: true });
            
            if (!error && data) {
                setRules(data);
            }
            setLoading(false);
        };
        fetchRules();
    }, []);

    const toggleRule = async (id: string, currentStatus: boolean) => {
        const { error } = await supabase
            .from('business_rules')
            .update({ is_active: !currentStatus })
            .eq('id', id);

        if (!error) {
            setRules(rules.map(r => r.id === id ? { ...r, is_active: !currentStatus } : r));
        }
    };

    return (
        <div className="flex flex-col gap-8">
            {/* Reglas de Negocio / ERP Automations */}
            <div className="rounded-xl border border-slate-200/60 bg-white/50 p-6 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                        <span className="material-symbols-outlined text-indigo-600 text-[20px]">account_tree</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Reglas de Negocio (ERP)</h3>
                        <p className="text-sm text-slate-500">Automatizaciones internas del flujo operativo y financiero.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
                    </div>
                ) : rules.length === 0 ? (
                    <div className="py-6 text-center text-sm text-slate-500">
                        No hay reglas de negocio configuradas en la base de datos.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {rules.map(rule => (
                            <div key={rule.id} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-700 md:flex-row md:items-center md:justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-bold text-slate-900 dark:text-white">{rule.name}</h4>
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${rule.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                                            {rule.is_active ? 'Activa' : 'Inactiva'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500">{rule.description}</p>
                                    <div className="mt-2 flex gap-2">
                                        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                            Trigger: {rule.trigger_event}
                                        </span>
                                        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                            Acción: {rule.action}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center">
                                    <button
                                        onClick={() => toggleRule(rule.id, rule.is_active)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${rule.is_active ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${rule.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Reglas de Notificaciones Internas (WhatsApp / Push) */}
            <div className="rounded-xl border border-slate-200/60 bg-white/50 p-6 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30">
                        <span className="material-symbols-outlined text-teal-600 text-[20px]">notifications_active</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Notificaciones Internas</h3>
                        <p className="text-sm text-slate-500">Reglas para alertas de equipo y notificaciones de sistema.</p>
                    </div>
                </div>
                {/* Se re-usa el componente de reglas, que actualmente lee 'wa_automation_rules' */}
                <WhatsAppRules clientMode={false} />
            </div>
        </div>
    );
}
