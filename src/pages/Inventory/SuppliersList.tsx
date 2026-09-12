import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface Supplier {
    id: string;
    name: string;
    contact_person: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes: string | null;
    is_active: boolean;
}

export default function SuppliersList() {
    const navigate = useNavigate();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [form, setForm] = useState<Partial<Supplier>>({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        notes: ''
    });

    const fetchSuppliers = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase
            .from('suppliers')
            .select('*')
            .eq('is_active', true)
            .order('name');
        
        setSuppliers(data || []);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchSuppliers();
    }, [fetchSuppliers]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                const { id: _id, ...updateData } = form as any;
                await supabase.from('suppliers').update(updateData).eq('id', editingId);
            } else {
                await supabase.from('suppliers').insert({ ...form });
            }
            setShowForm(false);
            setForm({ name: '', contact_person: '', phone: '', email: '', address: '', notes: '' });
            setEditingId(null);
            fetchSuppliers();
        } catch (error) {
            console.error('Error al guardar proveedor:', error);
            alert('Hubo un error al guardar el proveedor.');
        }
    };

    const handleEdit = (supplier: Supplier) => {
        setForm({
            name: supplier.name,
            contact_person: supplier.contact_person || '',
            phone: supplier.phone || '',
            email: supplier.email || '',
            address: supplier.address || '',
            notes: supplier.notes || ''
        });
        setEditingId(supplier.id);
        setShowForm(true);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`¿Estás seguro de eliminar el proveedor ${name}?`)) return;
        await supabase.from('suppliers').update({ is_active: false }).eq('id', id);
        fetchSuppliers();
    };

    const filteredSuppliers = suppliers.filter(s => 
        s.name.toLowerCase().includes(search.toLowerCase()) || 
        (s.contact_person && s.contact_person.toLowerCase().includes(search.toLowerCase()))
    );

    const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';

    return (
        <div className="flex flex-1 flex-col gap-6 p-8 overflow-y-auto h-full">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/inventory')} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">Directorio de Proveedores</h2>
                        <p className="mt-1 text-sm text-slate-500">Administra los proveedores de inventario y materiales.</p>
                    </div>
                </div>
                <button onClick={() => { setEditingId(null); setForm({ name: '', contact_person: '', phone: '', email: '', address: '', notes: '' }); setShowForm(true); }} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary/90 transition-all">
                    <span className="material-symbols-outlined text-[18px]">add</span>Nuevo Proveedor
                </button>
            </div>

            <div className="relative max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                <input type="text" placeholder="Buscar proveedor..." value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="rounded-xl border border-primary/20 bg-primary/5 p-6 mb-4 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">{editingId ? 'edit' : 'storefront'}</span>
                            {editingId ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                        </h3>
                        <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">close</span></button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className={labelClass}>Razón Social / Nombre *</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="Nombre de la empresa" /></div>
                        <div><label className={labelClass}>Contacto (Vendedor)</label><input value={form.contact_person || ''} onChange={e => setForm({ ...form, contact_person: e.target.value })} className={inputClass} placeholder="Nombre de quien atiende" /></div>
                        <div><label className={labelClass}>Teléfono</label><input type="tel" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputClass} placeholder="Ej. 662 123 4567" /></div>
                        <div><label className={labelClass}>Correo Electrónico</label><input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} className={inputClass} placeholder="ventas@proveedor.com" /></div>
                        <div className="md:col-span-2"><label className={labelClass}>Dirección</label><input value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} className={inputClass} placeholder="Calle, Número, Colonia, Ciudad" /></div>
                        <div className="md:col-span-2"><label className={labelClass}>Notas / Productos que manejan</label><textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className={inputClass} placeholder="Escribe aquí notas adicionales..." /></div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Cancelar</button>
                        <button type="submit" className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-primary/90">{editingId ? 'Guardar Cambios' : 'Crear Proveedor'}</button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="flex h-32 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
            ) : filteredSuppliers.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-12 dark:border-slate-700">
                    <span className="material-symbols-outlined text-4xl text-slate-400">store_off</span>
                    <p className="mt-2 text-sm text-slate-500">No se encontraron proveedores.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredSuppliers.map(supplier => (
                        <div key={supplier.id} className="group relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50">
                            <div>
                                <div className="flex items-start justify-between">
                                    <h3 className="font-bold text-slate-900 dark:text-white line-clamp-1">{supplier.name}</h3>
                                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                        <button onClick={() => handleEdit(supplier)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-primary dark:hover:bg-slate-800"><span className="material-symbols-outlined text-[18px]">edit</span></button>
                                        <button onClick={() => handleDelete(supplier.id, supplier.name)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                                    </div>
                                </div>
                                {supplier.contact_person && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">person</span> {supplier.contact_person}</p>}
                                {supplier.phone && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">call</span> <a href={`tel:${supplier.phone}`} className="hover:text-primary">{supplier.phone}</a></p>}
                                {supplier.email && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">mail</span> <a href={`mailto:${supplier.email}`} className="hover:text-primary truncate">{supplier.email}</a></p>}
                                {supplier.address && <p className="mt-2 text-xs text-slate-500 dark:text-slate-500 flex items-start gap-2"><span className="material-symbols-outlined text-[16px] shrink-0">location_on</span> {supplier.address}</p>}
                                {supplier.notes && <p className="mt-3 text-xs italic text-slate-500 bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-100 dark:border-slate-700/50">{supplier.notes}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
