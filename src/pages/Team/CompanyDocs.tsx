import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { CompanyDocumentFolder, CompanyDocument } from '../../types/hr';
import { useAuth } from '../../lib/AuthContext';

function formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function CompanyDocs() {
    const { user } = useAuth();
    const [folders, setFolders] = useState<CompanyDocumentFolder[]>([]);
    const [documents, setDocuments] = useState<CompanyDocument[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    useEffect(() => {
        fetchFolders();
        fetchDocuments();
    }, []);

    const fetchFolders = async () => {
        const { data, error } = await supabase
            .from('company_document_folders')
            .select('*')
            .order('name');
        if (error) console.error('Error fetching folders:', error);
        else setFolders(data || []);
    };

    const fetchDocuments = async () => {
        const { data, error } = await supabase
            .from('company_documents')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) console.error('Error fetching documents:', error);
        else setDocuments(data || []);
        setLoading(false);
    };

    const handleCreateFolder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFolderName.trim()) return;

        const { error } = await supabase
            .from('company_document_folders')
            .insert({ name: newFolderName.trim() });
        
        if (error) {
            console.error('Error creating folder:', error);
            alert('Error al crear la carpeta');
        } else {
            setShowFolderModal(false);
            setNewFolderName('');
            fetchFolders();
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !user) return;
        
        const file = e.target.files[0];
        setUploading(true);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
            const filePath = `company/${fileName}`;

            // Upload to storage
            const { error: uploadError, data } = await supabase.storage
                .from('company-documents')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('company-documents')
                .getPublicUrl(filePath);

            // Save to database
            const { error: dbError } = await supabase
                .from('company_documents')
                .insert({
                    folder_id: selectedFolder,
                    file_name: file.name,
                    file_url: publicUrl,
                    file_type: file.type,
                    file_size_bytes: file.size,
                    uploaded_by: user.id
                });

            if (dbError) throw dbError;

            fetchDocuments();
        } catch (error: any) {
            console.error('Error uploading file:', error);
            alert('Error al subir el archivo: ' + error.message);
        } finally {
            setUploading(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleDeleteFile = async (doc: CompanyDocument) => {
        if (!window.confirm(`¿Estás seguro de eliminar el archivo "${doc.file_name}"? Esta acción no se puede deshacer.`)) return;

        try {
            // Delete from database first
            const { error: dbError } = await supabase
                .from('company_documents')
                .delete()
                .eq('id', doc.id);
            if (dbError) throw dbError;

            // Extract file path from URL to delete from storage
            // URL format: .../storage/v1/object/public/company-documents/company/filename.ext
            const urlParts = doc.file_url.split('/company-documents/');
            if (urlParts.length > 1) {
                const path = urlParts[1];
                await supabase.storage.from('company-documents').remove([path]);
            }

            fetchDocuments();
        } catch (error: any) {
            console.error('Error deleting file:', error);
            alert('Error al eliminar el archivo: ' + error.message);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('es-MX', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const filteredDocuments = documents.filter(doc => 
        selectedFolder === 'all' || selectedFolder === null ? true :
        selectedFolder === 'unassigned' ? doc.folder_id === null :
        doc.folder_id === selectedFolder
    );

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Expediente de la Empresa</h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Gestiona los documentos globales, políticas, actas y archivos importantes.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                {/* Folders Sidebar */}
                <div className="col-span-1 space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Carpetas</h2>
                            <button
                                onClick={() => setShowFolderModal(true)}
                                className="flex h-6 w-6 items-center justify-center rounded bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                                title="Nueva carpeta"
                            >
                                <span className="material-symbols-outlined text-[16px]">add</span>
                            </button>
                        </div>

                        <div className="space-y-1">
                            <button
                                onClick={() => setSelectedFolder(null)}
                                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                    selectedFolder === null
                                        ? 'bg-primary/10 text-primary font-medium dark:bg-primary/20'
                                        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50'
                                }`}
                            >
                                <span className="material-symbols-outlined text-xl">folder_copy</span>
                                Todos los archivos
                            </button>

                            {folders.map(folder => (
                                <button
                                    key={folder.id}
                                    onClick={() => setSelectedFolder(folder.id)}
                                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                        selectedFolder === folder.id
                                            ? 'bg-primary/10 text-primary font-medium dark:bg-primary/20'
                                            : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-xl">folder</span>
                                    {folder.name}
                                </button>
                            ))}

                            <button
                                onClick={() => setSelectedFolder('unassigned')}
                                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                    selectedFolder === 'unassigned'
                                        ? 'bg-primary/10 text-primary font-medium dark:bg-primary/20'
                                        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50'
                                }`}
                            >
                                <span className="material-symbols-outlined text-xl">folder_off</span>
                                Sin clasificar
                            </button>
                        </div>
                    </div>
                </div>

                {/* Documents Area */}
                <div className="col-span-1 md:col-span-3">
                    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        {/* Header Area */}
                        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                {selectedFolder === null ? 'Todos los archivos' : 
                                 selectedFolder === 'unassigned' ? 'Archivos sin clasificar' : 
                                 folders.find(f => f.id === selectedFolder)?.name || 'Documentos'}
                            </h2>
                            <div>
                                <input
                                    type="file"
                                    id="file-upload"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                    disabled={uploading}
                                />
                                <label
                                    htmlFor="file-upload"
                                    className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${
                                        uploading ? 'bg-primary/70' : 'bg-primary hover:bg-primary/90'
                                    }`}
                                >
                                    {uploading ? (
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    ) : (
                                        <span className="material-symbols-outlined text-sm">upload</span>
                                    )}
                                    {uploading ? 'Subiendo...' : 'Subir Archivo'}
                                </label>
                            </div>
                        </div>

                        {/* Files List */}
                        <div className="p-0">
                            {loading ? (
                                <div className="flex justify-center py-12">
                                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                                </div>
                            ) : filteredDocuments.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800/50">
                                        <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">inventory_2</span>
                                    </div>
                                    <h3 className="text-sm font-medium text-slate-900 dark:text-white">No hay documentos</h3>
                                    <p className="mt-1 text-sm text-slate-500">Sube archivos a esta sección para comenzar a organizarlos.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                    {filteredDocuments.map(doc => (
                                        <div key={doc.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <div className="flex items-center gap-4 overflow-hidden">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                                    <span className="material-symbols-outlined">
                                                        {doc.file_type?.includes('pdf') ? 'picture_as_pdf' :
                                                         doc.file_type?.includes('image') ? 'image' : 'description'}
                                                    </span>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white" title={doc.file_name}>
                                                        {doc.file_name}
                                                    </p>
                                                    <div className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-500">
                                                        <span>{formatBytes(doc.file_size_bytes || 0)}</span>
                                                        <span>•</span>
                                                        <span>{formatDate(doc.created_at)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 pl-4">
                                                <a
                                                    href={doc.file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                                                    title="Ver / Descargar"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">download</span>
                                                </a>
                                                <button
                                                    onClick={() => handleDeleteFile(doc)}
                                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                                                    title="Eliminar"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Create Folder Modal */}
            {showFolderModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">create_new_folder</span>
                                Nueva Carpeta
                            </h3>
                            <button onClick={() => setShowFolderModal(false)} className="text-slate-400 hover:text-slate-600">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleCreateFolder}>
                            <div className="mb-6">
                                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Nombre de la carpeta
                                </label>
                                <input
                                    type="text"
                                    autoFocus
                                    required
                                    value={newFolderName}
                                    onChange={e => setNewFolderName(e.target.value)}
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                    placeholder="Ej. Actas Constitutivas, Contratos..."
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowFolderModal(false)}
                                    className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!newFolderName.trim()}
                                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                                >
                                    Crear Carpeta
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
