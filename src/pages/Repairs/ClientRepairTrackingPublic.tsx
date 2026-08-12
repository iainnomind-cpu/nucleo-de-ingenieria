import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { PhotoGallery } from '../../components/PhotoUploader';

// Tipos de estado (flujo completo de reparación)
const REPAIR_STATUSES = [
    { key: 'reported', label: 'Reportado', icon: 'report_problem', color: 'bg-slate-100 text-slate-700 border-slate-300' },
    { key: 'picked_up', label: 'Recibido en Taller', icon: 'warehouse', color: 'bg-blue-100 text-blue-700 border-blue-300' },
    { key: 'diagnosis_received', label: 'En Diagnóstico', icon: 'troubleshoot', color: 'bg-purple-100 text-purple-700 border-purple-300' },
    { key: 'quoted', label: 'Cotizado', icon: 'request_quote', color: 'bg-amber-100 text-amber-700 border-amber-300' },
    { key: 'authorized', label: 'Autorizado', icon: 'thumb_up', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    { key: 'in_repair', label: 'En Reparación', icon: 'build', color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
    { key: 'return_shipped', label: 'Listo / Enviado', icon: 'local_shipping', color: 'bg-teal-100 text-teal-700 border-teal-300' },
    { key: 'completed', label: 'Entregado', icon: 'task_alt', color: 'bg-green-100 text-green-700 border-green-300' },
];

export default function ClientRepairTrackingPublic() {
    const { token } = useParams<{ token: string }>();
    const [repair, setRepair] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    const fetchRepairData = useCallback(async () => {
        if (!token) return;
        setLoading(true);

        const { data, error } = await supabase
            .from('equipment_repairs')
            .select(`
                *,
                client:clients(id, company_name, contact_name),
                equipment:installed_equipment(id, name, brand, model, serial_number),
                warehouse_equipment(id, name, brand, model, serial_number)
            `)
            .eq('access_token', token)
            .single();

        if (error || !data) {
            setNotFound(true);
        } else {
            setRepair(data);
        }
        setLoading(false);
    }, [token]);

    useEffect(() => {
        fetchRepairData();
    }, [fetchRepairData]);

    if (notFound) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
                <div className="max-w-md text-center">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
                        <span className="material-symbols-outlined text-red-500 text-[40px]">link_off</span>
                    </div>
                    <h1 className="text-xl font-bold text-slate-900">Enlace no válido</h1>
                    <p className="mt-2 text-sm text-slate-500">El seguimiento de esta reparación no existe o el enlace ha caducado. Contacta a Soporte Técnico.</p>
                </div>
            </div>
        );
    }

    if (loading || !repair) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
                    <p className="text-sm font-medium text-slate-500">Cargando seguimiento de reparación...</p>
                </div>
            </div>
        );
    }

    // Calcular progreso
    const currentIndex = REPAIR_STATUSES.findIndex(s => s.key === repair.status) || 0;
    const isCancelled = repair.status === 'cancelled';

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100">
            {/* Header */}
            <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-lg sticky top-0 z-10">
                <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 shadow-lg shadow-slate-200">
                            <span className="material-symbols-outlined text-white text-[22px]">build_circle</span>
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-slate-900">Núcleo de Ingeniería</h1>
                            <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Seguimiento de Reparación</p>
                        </div>
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
                
                {/* Info del Equipo */}
                <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex gap-4 items-start">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-50">
                            <span className="material-symbols-outlined text-sky-600 text-[28px]">precision_manufacturing</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">
                                {repair.repair_source === 'warehouse' 
                                    ? repair.warehouse_equipment?.name 
                                    : (repair.equipment?.name || repair.external_equipment_name || 'Equipo no especificado')}
                            </h2>
                            <div className="mt-1 flex flex-wrap gap-2 text-sm text-slate-500">
                                <span><strong>Marca:</strong> {repair.equipment?.brand || repair.warehouse_equipment?.brand || 'N/A'}</span>
                                <span>·</span>
                                <span><strong>Modelo:</strong> {repair.equipment?.model || repair.warehouse_equipment?.model || 'N/A'}</span>
                            </div>
                            {repair.client && (
                                <p className="mt-2 text-sm font-medium text-slate-700">
                                    Cliente: <span className="text-slate-900">{repair.client.company_name}</span>
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-1">Fecha de Reporte</p>
                        <p className="text-base font-semibold text-slate-900">{new Date(repair.report_date + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                </div>

                {/* Status Timeline */}
                <div className="rounded-2xl border border-slate-200/60 bg-white p-6 md:p-8 shadow-sm overflow-hidden">
                    <h3 className="mb-8 text-lg font-bold text-slate-900 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sky-500">timeline</span>
                        Progreso del Servicio
                    </h3>

                    {isCancelled ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
                            <span className="material-symbols-outlined text-[48px] text-red-400 mb-2">cancel</span>
                            <h4 className="text-lg font-bold text-red-800">Servicio Cancelado</h4>
                            <p className="mt-1 text-sm text-red-600">Este servicio de reparación ha sido cancelado.</p>
                            {repair.resolution_notes && (
                                <p className="mt-3 text-sm font-medium text-red-700">"{repair.resolution_notes}"</p>
                            )}
                        </div>
                    ) : (
                        <div className="relative">
                            <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-100 -translate-y-1/2 rounded-full hidden md:block"></div>
                            
                            <div className="absolute top-1/2 left-0 h-1 bg-sky-500 -translate-y-1/2 rounded-full hidden md:block transition-all duration-1000" style={{ width: `${(currentIndex / (REPAIR_STATUSES.length - 1)) * 100}%` }}></div>
                            
                            {/* Vertical Line for Mobile */}
                            <div className="absolute left-6 top-0 bottom-0 w-1 bg-slate-100 rounded-full md:hidden"></div>
                            <div className="absolute left-6 top-0 w-1 bg-sky-500 rounded-full md:hidden transition-all duration-1000" style={{ height: `${(currentIndex / (REPAIR_STATUSES.length - 1)) * 100}%` }}></div>

                            <div className="flex flex-col md:flex-row justify-between relative z-10 gap-6 md:gap-0">
                                {REPAIR_STATUSES.map((status, idx) => {
                                    const isCompleted = idx <= currentIndex;
                                    const isActive = idx === currentIndex;
                                    const colorCls = isCompleted ? status.color : 'bg-white text-slate-300 border-slate-200';
                                    
                                    return (
                                        <div key={status.key} className="flex md:flex-col items-center gap-4 md:gap-3 text-center w-full md:w-32 relative">
                                            <div className={'flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500 ' + colorCls + (isActive ? ' shadow-lg ring-4 ring-white scale-110' : '')}>
                                                <span className="material-symbols-outlined text-[24px]">{isCompleted ? 'check' : status.icon}</span>
                                            </div>
                                            <div className="text-left md:text-center mt-0 md:mt-2">
                                                <p className={'text-xs md:text-sm font-bold transition-all duration-500 ' + (isCompleted ? 'text-slate-900' : 'text-slate-400')}>
                                                    {status.label}
                                                </p>
                                                {isActive && (
                                                    <span className="inline-flex mt-1 md:mt-2 rounded-full bg-sky-100 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-sky-700 animate-pulse">
                                                        Actual
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Detalles de la Falla */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
                        <h3 className="mb-4 text-base font-bold text-slate-900 flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-500">info</span>
                            Reporte de Falla
                        </h3>
                        <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl">
                            {repair.failure_description}
                        </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
                        <h3 className="mb-4 text-base font-bold text-slate-900 flex items-center gap-2">
                            <span className="material-symbols-outlined text-green-500">assignment_turned_in</span>
                            Diagnóstico Técnico
                        </h3>
                        {repair.diagnosis ? (
                            <p className="text-sm text-slate-700 leading-relaxed bg-green-50/50 border border-green-100 p-4 rounded-xl">
                                {repair.diagnosis}
                            </p>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-6 text-center h-full min-h-[100px] border-2 border-dashed border-slate-100 rounded-xl">
                                <span className="material-symbols-outlined text-slate-300 mb-2 text-[32px]">pending_actions</span>
                                <p className="text-sm text-slate-400">El diagnóstico técnico aún está en proceso.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Fotos Iniciales */}
                {(repair.photos_before || []).length > 0 && (
                    <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
                        <h3 className="mb-4 text-base font-bold text-slate-900 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sky-500">photo_camera</span>
                            Evidencia Fotográfica (Recepción)
                        </h3>
                        <PhotoGallery photos={repair.photos_before} />
                    </div>
                )}
                
                {/* Notas Finales */}
                {repair.resolution_notes && repair.status === 'completed' && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
                        <h3 className="mb-2 text-base font-bold text-emerald-900 flex items-center gap-2">
                            <span className="material-symbols-outlined text-emerald-600">verified</span>
                            Notas de Entrega / Resolución
                        </h3>
                        <p className="text-sm text-emerald-800 leading-relaxed">
                            {repair.resolution_notes}
                        </p>
                    </div>
                )}

            </div>
        </div>
    );
}
