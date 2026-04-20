import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    Client,
    ClientStatus,
    STATUS_LABELS,
    STATUS_COLORS,
} from '../../types/crm';
import ClientFormModal from './ClientFormModal';
import GoogleMapView, { MapPin } from '../../components/GoogleMap';
import { NUCLEO_HQ, PinColor } from '../../lib/maps';

const STATUS_OPTIONS: ClientStatus[] = ['prospect', 'active', 'inactive', 'vip', 'overdue'];

export default function ClientsList() {
    const navigate = useNavigate();
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<ClientStatus | 'all'>('all');
    const [showForm, setShowForm] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

    const getStatusPinColor = (status: ClientStatus): PinColor => {
        switch (status) {
            case 'active': case 'vip': return 'green';
            case 'prospect': return 'yellow';
            case 'overdue': return 'red';
            default: return 'black';
        }
    };

    const fetchClients = useCallback(async () => {
        setLoading(true);
        let query = supabase
            .from('clients')
            .select('*')
            .order('updated_at', { ascending: false });

        if (filterStatus !== 'all') {
            query = query.eq('status', filterStatus);
        }

        if (searchTerm.trim()) {
            query = query.or(
                `company_name.ilike.%${searchTerm}%,contact_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`
            );
        }

        const { data, error } = await query;
        if (error) {
            console.error('Error fetching clients:', error);
        } else {
            setClients(data || []);
        }
        setLoading(false);
    }, [filterStatus, searchTerm]);

    useEffect(() => {
        fetchClients();
    }, [fetchClients]);

    const handleDeleteClient = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este cliente?')) return;
        const { error } = await supabase.from('clients').delete().eq('id', id);
        if (error) {
            console.error('Error deleting client:', error);
        } else {
            fetchClients();
        }
    };

    const handleSave = () => {
        setShowForm(false);
        setEditingClient(null);
        fetchClients();
    };

    const getScoreColor = (score: number | null) => {
        if (!score) return 'text-slate-400';
        if (score >= 4.0) return 'text-emerald-500';
        if (score >= 3.0) return 'text-amber-500';
        return 'text-red-500';
    };

    // KPI summaries
    const totalClients = clients.length;
    const activeClients = clients.filter((c) => c.status === 'active' || c.status === 'vip').length;
    const prospects = clients.filter((c) => c.status === 'prospect').length;
    const overdueClients = clients.filter((c) => c.status === 'overdue').length;

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
            {/* Header */}
            <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                    CRM & Gestión de Clientes
                </h2>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Centraliza toda la información de prospectos y clientes activos.
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    { label: 'Total Clientes', value: totalClients, icon: 'groups', color: 'from-sky-500 to-cyan-500' },
                    { label: 'Activos / VIP', value: activeClients, icon: 'verified', color: 'from-emerald-500 to-teal-500' },
                    { label: 'Prospectos', value: prospects, icon: 'person_search', color: 'from-amber-500 to-orange-500' },
                    { label: 'Morosos', value: overdueClients, icon: 'warning', color: 'from-red-500 to-rose-500' },
                ].map((kpi) => (
                    <div
                        key={kpi.label}
                        className="group relative overflow-hidden rounded-xl border border-slate-200/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl transition-all hover:shadow-md dark:border-slate-800/60 dark:bg-slate-900/50"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    {kpi.label}
                                </p>
                                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{kpi.value}</p>
                            </div>
                            <div
                                className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${kpi.color} shadow-lg`}
                            >
                                <span className="material-symbols-outlined text-white text-[24px]">{kpi.icon}</span>
                            </div>
                        </div>
                        <div className={`absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r ${kpi.color} opacity-60`} />
                    </div>
                ))}
            </div>

            {/* Search, Filters & Actions */}
            <div className="rounded-xl border border-slate-200/60 bg-white/50 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50">
                <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
                    <div className="relative w-full md:max-w-md">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            search
                        </span>
                        <input
                            type="text"
                            placeholder="Buscar por empresa, contacto o email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-primary"
                        />
                    </div>
                    <div className="flex gap-2">
                        {/* Map/List toggle */}
                        <div className="flex rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 overflow-hidden">
                            <button onClick={() => setViewMode('list')}
                                className={`flex items-center gap-1 px-3 py-2.5 text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400'}`}>
                                <span className="material-symbols-outlined text-[18px]">list</span>Lista
                            </button>
                            <button onClick={() => setViewMode('map')}
                                className={`flex items-center gap-1 px-3 py-2.5 text-sm font-medium transition-colors ${viewMode === 'map' ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400'}`}>
                                <span className="material-symbols-outlined text-[18px]">map</span>Mapa
                            </button>
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-sm transition-all ${showFilters || filterStatus !== 'all'
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                        >
                            <span className="material-symbols-outlined text-[20px]">filter_list</span>
                            Filtros
                        </button>
                        <button
                            onClick={() => {
                                setEditingClient(null);
                                setShowForm(true);
                            }}
                            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/30"
                        >
                            <span className="material-symbols-outlined text-[20px]">add</span>
                            Nuevo Cliente
                        </button>
                    </div>
                </div>

                {/* Filter bar */}
                {showFilters && (
                    <div className="border-t border-slate-200 px-6 py-3 dark:border-slate-800">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500">Estado:</span>
                            <button
                                onClick={() => setFilterStatus('all')}
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${filterStatus === 'all'
                                    ? 'bg-primary text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                                    }`}
                            >
                                Todos
                            </button>
                            {STATUS_OPTIONS.map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setFilterStatus(s)}
                                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${filterStatus === s
                                        ? `${STATUS_COLORS[s].bg} ${STATUS_COLORS[s].text}`
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                                        }`}
                                >
                                    {STATUS_LABELS[s]}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* MAP VIEW */}
                {viewMode === 'map' && (
                    <div className="p-4 h-64 sm:h-96">
                        {(() => {
                            const geoClients = clients.filter(c => c.latitude && c.longitude);
                            if (geoClients.length === 0) return (
                                <div className="flex flex-col items-center gap-3 py-12 text-center">
                                    <span className="material-symbols-outlined text-[48px] text-slate-300">map</span>
                                    <p className="text-sm text-slate-500">No hay clientes con ubicación registrada.</p>
                                    <p className="text-xs text-slate-400">Edita un cliente y usa el autocompletado de Google Maps para agregar su dirección.</p>
                                </div>
                            );
                            const pins: MapPin[] = geoClients.map(c => ({
                                id: c.id,
                                lat: c.latitude!,
                                lng: c.longitude!,
                                title: c.company_name,
                                color: getStatusPinColor(c.status),
                                info: `${c.contact_name || ''} · ${STATUS_LABELS[c.status]}${c.phone ? ' · ' + c.phone : ''}`,
                            }));
                            // Add HQ marker
                            pins.push({ id: 'hq', lat: NUCLEO_HQ.lat, lng: NUCLEO_HQ.lng, title: 'Núcleo de Ingeniería — Cd. Guzmán', color: 'blue', label: 'N', info: 'Base de operaciones' });
                            return (
                                <div>
                                    <div className="mb-3 flex items-center gap-4 text-xs text-slate-500">
                                        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-emerald-500"></span>Activo/VIP</span>
                                        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-amber-500"></span>Prospecto</span>
                                        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-red-500"></span>Moroso</span>
                                        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-gray-600"></span>Inactivo</span>
                                        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-blue-500"></span>HQ</span>
                                    </div>
                                    <GoogleMapView
                                        pins={pins}
                                        center={NUCLEO_HQ}
                                        zoom={9}
                                        height="500px"
                                        onPinClick={(pin) => { if (pin.id !== 'hq') navigate(`/crm/${pin.id}`); }}
                                    />
                                </div>
                            );
                        })()}
                    </div>
                )}

                {/* TABLE VIEW */}
                {viewMode === 'list' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-t border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/50">
                                <tr>
                                    <th className="px-6 py-3.5 font-semibold text-slate-500 dark:text-slate-400">Empresa</th>
                                    <th className="px-6 py-3.5 font-semibold text-slate-500 dark:text-slate-400">Contacto</th>
                                    <th className="px-6 py-3.5 font-semibold text-slate-500 dark:text-slate-400">Industria</th>
                                    <th className="px-6 py-3.5 font-semibold text-slate-500 dark:text-slate-400">Estado</th>
                                    <th className="px-6 py-3.5 font-semibold text-slate-500 dark:text-slate-400">Score</th>
                                    <th className="px-6 py-3.5 font-semibold text-slate-500 dark:text-slate-400">Ubicación</th>
                                    <th className="px-6 py-3.5 text-right font-semibold text-slate-500 dark:text-slate-400">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                                                <span className="text-sm text-slate-500">Cargando clientes...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : clients.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <span className="material-symbols-outlined text-[48px] text-slate-300 dark:text-slate-600">
                                                    person_off
                                                </span>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                                    No se encontraron clientes.
                                                </p>
                                                <button
                                                    onClick={() => {
                                                        setEditingClient(null);
                                                        setShowForm(true);
                                                    }}
                                                    className="text-sm font-semibold text-primary hover:underline"
                                                >
                                                    Agregar primer cliente
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    clients.map((client) => (
                                        <tr
                                            key={client.id}
                                            className="group cursor-pointer transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50"
                                            onClick={() => navigate(`/crm/${client.id}`)}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 font-bold text-primary">
                                                        {client.company_name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-900 dark:text-white">
                                                            {client.company_name}
                                                        </p>
                                                        {client.rfc && (
                                                            <p className="text-xs text-slate-400">{client.rfc}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-slate-700 dark:text-slate-300">{client.contact_name || '—'}</p>
                                                {client.email && (
                                                    <p className="text-xs text-slate-400">{client.email}</p>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                {client.industry || '—'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span
                                                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[client.status].bg
                                                        } ${STATUS_COLORS[client.status].text}`}
                                                >
                                                    {STATUS_LABELS[client.status]}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`font-bold ${getScoreColor(client.payment_score)}`}>
                                                    {client.payment_score ? client.payment_score.toFixed(1) : '—'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {client.latitude && client.longitude ? (
                                                    <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                                                        <span className="material-symbols-outlined text-[14px]">location_on</span>
                                                        {client.formatted_address?.split(',')[0] || 'GPS'}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-400">Sin ubicación</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingClient(client);
                                                            setShowForm(true);
                                                        }}
                                                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary dark:hover:bg-slate-700"
                                                        title="Editar"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">edit</span>
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteClient(client.id);
                                                        }}
                                                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                                                        title="Eliminar"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">delete</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Client Form Modal */}
            {showForm && (
                <ClientFormModal
                    client={editingClient}
                    onClose={() => {
                        setShowForm(false);
                        setEditingClient(null);
                    }}
                    onSave={handleSave}
                />
            )}
        </div>
    );
}
