import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { HREmployee } from '../../types/hr';

export default function TeamDirectory() {
    const navigate = useNavigate();
    const [employees, setEmployees] = useState<HREmployee[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchEmployees = async () => {
            const { data } = await supabase.from('hr_employees').select('*').order('full_name');
            setEmployees(data || []);
            setLoading(false);
        };
        fetchEmployees();
    }, []);

    const filteredEmployees = employees.filter(e => 
        e.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        e.department?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-1 flex-col overflow-y-auto bg-slate-50 dark:bg-slate-950 p-8 gap-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[28px]">folder_shared</span>
                        Expedientes de Personal
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Directorio de trabajadores y gestión de documentos</p>
                </div>
            </div>

            <div className="flex gap-4 items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex-1 relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400">search</span>
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre o departamento..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex flex-1 justify-center items-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredEmployees.map(emp => (
                        <div 
                            key={emp.id} 
                            onClick={() => navigate(`/team/directory/${emp.id}`)}
                            className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-primary/50 transition-all cursor-pointer flex flex-col items-center text-center group"
                        >
                            <div className="h-16 w-16 bg-primary/10 text-primary dark:bg-primary/20 flex items-center justify-center rounded-full text-2xl font-bold mb-3 group-hover:scale-110 transition-transform">
                                {emp.full_name.charAt(0).toUpperCase()}
                            </div>
                            <h3 className="font-bold text-slate-900 dark:text-white line-clamp-1">{emp.full_name}</h3>
                            <p className="text-xs font-medium text-slate-500 mt-1 uppercase tracking-wider">{emp.department || 'Sin Departamento'}</p>
                            
                            <div className="mt-4 w-full pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${emp.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                                    {emp.is_active ? 'ACTIVO' : 'INACTIVO'}
                                </span>
                                <span className="text-primary text-sm font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    Ver Expediente <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                                </span>
                            </div>
                        </div>
                    ))}
                    {filteredEmployees.length === 0 && (
                        <div className="col-span-full py-12 text-center text-slate-500">
                            No se encontraron trabajadores que coincidan con la búsqueda.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
