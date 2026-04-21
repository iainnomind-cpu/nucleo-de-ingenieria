import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Client,
    ClientStatus,
    GrowthPotential,
} from '../../types/crm';
import AddressAutocomplete from '../../components/AddressAutocomplete';
import MapPinPicker from '../../components/MapPinPicker';
import type { GeoResult } from '../../lib/maps';
import { useAuth } from '../../lib/AuthContext';

interface Props {
    client: Client | null;
    onClose: () => void;
    onSave: () => void;
}

const statusOptions: { value: ClientStatus; label: string }[] = [
    { value: 'prospect', label: 'Prospecto' },
    { value: 'active', label: 'Activo' },
    { value: 'inactive', label: 'Inactivo' },
    { value: 'vip', label: 'VIP' },
    { value: 'overdue', label: 'Moroso' },
];

const growthOptions: { value: GrowthPotential; label: string }[] = [
    { value: 'low', label: 'Bajo' },
    { value: 'medium', label: 'Medio' },
    { value: 'high', label: 'Alto' },
];

export default function ClientFormModal({ client, onClose, onSave }: Props) {
    const { user } = useAuth();
    const [saving, setSaving] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [form, setForm] = useState({
        company_name: '',
        contact_name: '',
        email: '',
        phone: '',
        rfc: '',
        address: '',
        formatted_address: '',
        latitude: null as number | null,
        longitude: null as number | null,
        industry: '',
        status: 'prospect' as ClientStatus,
        payment_score: '',
        growth_potential: '' as GrowthPotential | '',
        credit_days: '0',
    });

    useEffect(() => {
        if (client) {
            setForm({
                company_name: client.company_name || '',
                contact_name: client.contact_name || '',
                email: client.email || '',
                phone: client.phone || '',
                rfc: client.rfc || '',
                address: client.address || '',
                formatted_address: client.formatted_address || '',
                latitude: client.latitude,
                longitude: client.longitude,
                industry: client.industry || '',
                status: client.status,
                payment_score: client.payment_score?.toString() || '',
                growth_potential: client.growth_potential || '',
                credit_days: client.credit_days?.toString() || '0',
            });
        }
    }, [client]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        const payload = {
            company_name: form.company_name,
            contact_name: form.contact_name || null,
            email: form.email || null,
            phone: form.phone || null,
            rfc: form.rfc || null,
            address: form.address || null,
            formatted_address: form.formatted_address || null,
            latitude: form.latitude,
            longitude: form.longitude,
            industry: form.industry || null,
            status: form.status,
            payment_score: form.payment_score ? parseFloat(form.payment_score) : null,
            growth_potential: form.growth_potential || null,
            credit_days: parseInt(form.credit_days) || 0,
        };

        let error;
        if (client) {
            ({ error } = await supabase.from('clients').update(payload).eq('id', client.id));
        } else {
            const insertPayload = { ...payload, created_by: user?.id || null };
            const { data: newClient, error: insertError } = await supabase
                .from('clients').insert(insertPayload).select().single();
            error = insertError;

            // → Pipeline Sync: Auto-crear oportunidad en "Prospección"
            if (!error && newClient) {
                await supabase.from('sales_opportunities').insert({
                    client_id: newClient.id,
                    title: `Prospección — ${newClient.company_name}`,
                    estimated_value: null,
                    probability: 10,
                    stage: 'prospecting',
                });
            }
        }

        if (error) {
            console.error('Error saving client:', error);
            alert('Error al guardar: ' + error.message);
        } else {
            onSave();
        }
        setSaving(false);
    };

    const inputClass =
        'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl dark:border-slate-800/60 dark:bg-slate-900">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {client ? 'Editar Cliente' : 'Nuevo Cliente'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="max-h-[70vh] overflow-y-auto p-6">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        {/* Company Name */}
                        <div className="md:col-span-2">
                            <label className={labelClass}>Nombre de Empresa *</label>
                            <input
                                name="company_name"
                                value={form.company_name}
                                onChange={handleChange}
                                required
                                placeholder="Ej: Empresa Industrial S.A."
                                className={inputClass}
                            />
                        </div>

                        {/* Contact Name */}
                        <div>
                            <label className={labelClass}>Nombre de Contacto</label>
                            <input
                                name="contact_name"
                                value={form.contact_name}
                                onChange={handleChange}
                                placeholder="Ej: Juan Pérez"
                                className={inputClass}
                            />
                        </div>

                        {/* Email */}
                        <div>
                            <label className={labelClass}>Correo Electrónico</label>
                            <input
                                name="email"
                                type="email"
                                value={form.email}
                                onChange={handleChange}
                                placeholder="correo@empresa.com"
                                className={inputClass}
                            />
                        </div>

                        {/* Phone */}
                        <div>
                            <label className={labelClass}>Teléfono</label>
                            <input
                                name="phone"
                                value={form.phone}
                                onChange={handleChange}
                                placeholder="+52 81 1234 5678"
                                className={inputClass}
                            />
                        </div>

                        {/* RFC */}
                        <div>
                            <label className={labelClass}>RFC</label>
                            <input
                                name="rfc"
                                value={form.rfc}
                                onChange={handleChange}
                                placeholder="XAXX010101000"
                                className={inputClass}
                            />
                        </div>

                        {/* Industry */}
                        <div>
                            <label className={labelClass}>Industria</label>
                            <input
                                name="industry"
                                value={form.industry}
                                onChange={handleChange}
                                placeholder="Ej: Manufactura, Construcción..."
                                className={inputClass}
                            />
                        </div>

                        {/* Status */}
                        <div>
                            <label className={labelClass}>Estado</label>
                            <select name="status" value={form.status} onChange={handleChange} className={inputClass}>
                                {statusOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Payment Score */}
                        <div>
                            <label className={labelClass}>Scoring de Pago (0-5)</label>
                            <input
                                name="payment_score"
                                type="number"
                                step="0.1"
                                min="0"
                                max="5"
                                value={form.payment_score}
                                onChange={handleChange}
                                placeholder="4.5"
                                className={inputClass}
                            />
                        </div>

                        {/* Growth Potential */}
                        <div>
                            <label className={labelClass}>Potencial de Crecimiento</label>
                            <select
                                name="growth_potential"
                                value={form.growth_potential}
                                onChange={handleChange}
                                className={inputClass}
                            >
                                <option value="">Sin definir</option>
                                {growthOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Credit Days */}
                        <div>
                            <label className={labelClass}>Días de Crédito</label>
                            <input
                                name="credit_days"
                                type="number"
                                min="0"
                                value={form.credit_days}
                                onChange={handleChange}
                                className={inputClass}
                            />
                        </div>

                        {/* Address — Google Places Autocomplete + Map Pin */}
                        <div className="md:col-span-2">
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Dirección del Predio</label>
                                <button type="button" onClick={() => setShowMap(!showMap)}
                                    className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/20 transition-colors">
                                    <span className="material-symbols-outlined text-[14px]">{showMap ? 'visibility_off' : 'map'}</span>
                                    {showMap ? 'Ocultar Mapa' : 'Marcar en Mapa'}
                                </button>
                            </div>
                            <AddressAutocomplete
                                value={form.address}
                                onChange={(v) => setForm({ ...form, address: v })}
                                onSelect={(geo: GeoResult) => setForm({ ...form, address: geo.formatted_address, formatted_address: geo.formatted_address, latitude: geo.lat, longitude: geo.lng })}
                                placeholder="Buscar dirección del predio..."
                                className={inputClass}
                            />
                            {showMap && (
                                <div className="mt-3">
                                    <MapPinPicker
                                        lat={form.latitude}
                                        lng={form.longitude}
                                        height="250px"
                                        onLocationChange={(lat, lng, address) => {
                                            setForm(prev => ({
                                                ...prev,
                                                latitude: lat,
                                                longitude: lng,
                                                formatted_address: address,
                                                address: address || prev.address,
                                            }));
                                        }}
                                    />
                                </div>
                            )}
                            {form.latitude && form.longitude && (
                                <div className="mt-1.5 flex items-center gap-2 text-[10px] text-emerald-600 dark:text-emerald-400">
                                    <span className="material-symbols-outlined text-[12px]">check_circle</span>
                                    Coordenadas: {form.latitude.toFixed(4)}, {form.longitude.toFixed(4)}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 transition-all hover:shadow-lg disabled:opacity-50"
                        >
                            {saving && (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            )}
                            {client ? 'Guardar Cambios' : 'Crear Cliente'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
