import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/AuthContext';
import { HREmployee, HrDocumentFolder, HrEmployeeDocument } from '../../../types/hr';

export default function EmployeeProfile() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user, hasPermission } = useAuth();
    const canEdit = hasPermission('team', 'edit');

    const [employee, setEmployee] = useState<HREmployee | null>(null);
    const [folders, setFolders] = useState<HrDocumentFolder[]>([]);
    const [documents, setDocuments] = useState<HrEmployeeDocument[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    
    // Modals
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [folderName, setFolderName] = useState('');
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (!id) return;
        const fetchAll = async () => {
            const [empRes, fRes, dRes] = await Promise.all([
                supabase.from('hr_employees').select('*').eq('id', id).single(),
                supabase.from('hr_document_folders').select('*').eq('employee_id', id).order('created_at'),
                supabase.from('hr_employee_documents').select('*').eq('employee_id', id).order('created_at', { ascending: false })
            ]);

            setEmployee(empRes.data);
            setFolders(fRes.data || []);
            setDocuments(dRes.data || []);
            setLoading(false);
        };
        fetchAll();
    }, [id]);

    const handleCreateFolder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!folderName.trim()) return;
        
        const { data, error } = await supabase.from('hr_document_folders').insert({
            employee_id: id,
            name: folderName.trim()
        }).select().single();

        if (!error && data) {
            setFolders([...folders, data]);
            setShowFolderModal(false);
            setFolderName('');
        }
    };

    const handleDeleteFolder = async (folderId: string) => {
        if (!window.confirm('¿Eliminar esta carpeta? Los documentos dentro pasarán a la carpeta principal.')) return;
        
        await supabase.from('hr_document_folders').delete().eq('id', folderId);
        setFolders(folders.filter(f => f.id !== folderId));
        // Reset local documents folder_id to null
        setDocuments(documents.map(d => d.folder_id === folderId ? { ...d, folder_id: null } : d));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !id || !user) return;

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
            const folderPath = selectedFolderId ? `${id}/${selectedFolderId}` : id;
            const filePath = `${folderPath}/${fileName}`;

            // Upload to storage
            const { error: uploadError } = await supabase.storage.from('hr_documents').upload(filePath, file);
            
            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage.from('hr_documents').getPublicUrl(filePath);

            // Save to DB
            const { data: docData, error: dbError } = await supabase.from('hr_employee_documents').insert({
                employee_id: id,
                folder_id: selectedFolderId,
                file_name: file.name,
                file_url: publicUrl,
                file_type: file.type || 'application/octet-stream',
                file_size_bytes: file.size,
                uploaded_by: user.id
            }).select().single();

            if (dbError) throw dbError;
            if (docData) setDocuments([docData, ...documents]);

        } catch (error) {
            console.error('Upload error:', error);
            alert('Error al subir el archivo');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteDocument = async (doc: HrEmployeeDocument) => {
        if (!window.confirm(`¿Eliminar el documento ${doc.file_name}?`)) return;
        
        await supabase.from('hr_employee_documents').delete().eq('id', doc.id);
        setDocuments(documents.filter(d => d.id !== doc.id));
        // We could also delete from storage here, but for now we just remove the DB record.
    };

    if (loading) return <div className="flex flex-1 justify-center items-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
    if (!employee) return <div className="p-8">Empleado no encontrado</div>;

    const currentFolderDocuments = documents.filter(d => d.folder_id === selectedFolderId);

    return (
        <div className="flex flex-1 flex-col overflow-y-auto bg-slate-50 dark:bg-slate-950 p-8 gap-6">
            
            {/* Nav Row */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/team/directory')} className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/20 text-2xl font-bold">
                        {employee.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{employee.full_name}</h1>
                        <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                            <span className="font-bold">{employee.department || 'Sin Departamento'}</span>
                            <span>•</span>
                            <span>Ingreso: <strong className="text-slate-700 dark:text-slate-300">{employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('es-MX') : 'N/A'}</strong></span>
                            <span>•</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${employee.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                                {employee.is_active ? 'ACTIVO' : 'INACTIVO'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* Folders Sidebar */}
                <div className="lg:col-span-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-[20px]">folder</span> Carpetas
                        </h3>
                        {canEdit && (
                            <button onClick={() => setShowFolderModal(true)} className="p-1 text-slate-400 hover:text-primary rounded hover:bg-primary/10">
                                <span className="material-symbols-outlined text-[18px]">add</span>
                            </button>
                        )}
                    </div>

                    <div className="space-y-1">
                        <button 
                            onClick={() => setSelectedFolderId(null)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${selectedFolderId === null ? 'bg-primary/10 text-primary dark:bg-primary/20 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[18px]">{selectedFolderId === null ? 'folder_open' : 'folder'}</span>
                                General
                            </div>
                            <span className="text-xs font-bold px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-full">{documents.filter(d => d.folder_id === null).length}</span>
                        </button>
                        
                        {folders.map(f => (
                            <button 
                                key={f.id}
                                onClick={() => setSelectedFolderId(f.id)}
                                className={`group w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${selectedFolderId === f.id ? 'bg-primary/10 text-primary dark:bg-primary/20 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <span className="material-symbols-outlined text-[18px]">{selectedFolderId === f.id ? 'folder_open' : 'folder'}</span>
                                    <span className="truncate">{f.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-full">{documents.filter(d => d.folder_id === f.id).length}</span>
                                    {canEdit && <span onClick={(e) => { e.stopPropagation(); handleDeleteFolder(f.id); }} className="material-symbols-outlined text-[14px] text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100">delete</span>}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Documents Area */}
                <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                {selectedFolderId ? folders.find(f => f.id === selectedFolderId)?.name : 'Documentos Generales'}
                            </h2>
                            <p className="text-sm text-slate-500">{currentFolderDocuments.length} archivos</p>
                        </div>
                        
                        {canEdit && (
                            <div>
                                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                    className="flex items-center gap-2 bg-primary text-primary-content px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                                >
                                    {uploading ? (
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    ) : (
                                        <span className="material-symbols-outlined text-[18px]">upload_file</span>
                                    )}
                                    {uploading ? 'Subiendo...' : 'Subir Documento'}
                                </button>
                            </div>
                        )}
                    </div>

                    {currentFolderDocuments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <span className="material-symbols-outlined text-6xl mb-4 opacity-50">description</span>
                            <p className="text-sm">No hay documentos en esta carpeta</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {currentFolderDocuments.map(doc => (
                                <div key={doc.id} className="group relative flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded flex items-center justify-center">
                                        <span className="material-symbols-outlined">
                                            {doc.file_type?.includes('pdf') ? 'picture_as_pdf' : doc.file_type?.includes('image') ? 'image' : 'insert_drive_file'}
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="block text-sm font-medium text-slate-900 dark:text-white truncate hover:text-primary transition-colors">
                                            {doc.file_name}
                                        </a>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            {new Date(doc.created_at).toLocaleDateString('es-MX')} • {(doc.file_size_bytes ? (doc.file_size_bytes / 1024 / 1024).toFixed(2) : '0')} MB
                                        </p>
                                    </div>
                                    {canEdit && (
                                        <button 
                                            onClick={() => handleDeleteDocument(doc)}
                                            className="absolute right-2 top-2 p-1 text-slate-400 hover:text-red-500 rounded bg-white dark:bg-slate-900 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Eliminar"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Folder Modal */}
            {showFolderModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nueva Carpeta</h3>
                            <button onClick={() => setShowFolderModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <form onSubmit={handleCreateFolder}>
                            <input 
                                required 
                                type="text" 
                                placeholder="Ej. Contratos, Identificaciones..." 
                                value={folderName} 
                                onChange={e => setFolderName(e.target.value)} 
                                autoFocus
                                className="w-full rounded-lg border-0 bg-slate-50 p-3 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900 mb-4" 
                            />
                            <button type="submit" className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-content hover:bg-primary/90">
                                Crear Carpeta
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
