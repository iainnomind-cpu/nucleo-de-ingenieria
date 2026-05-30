import { useState, useRef, useCallback } from 'react';
import { PhotoAttachment, normalizePhotos, ACCEPTED_DOCUMENT_TYPES, MAX_FILES_DEFAULT } from '../types/photos';
import { uploadMultiplePhotos, deletePhoto, formatFileSize } from '../lib/storage';

interface DocumentUploaderProps {
    documents: unknown[];
    onDocumentsChange: (docs: PhotoAttachment[]) => void;
    folder: string;
    uploaderName: string;
    maxFiles?: number;
    disabled?: boolean;
    compact?: boolean;
}

export function getDocumentIcon(filename: string) {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['pdf'].includes(ext)) return 'picture_as_pdf';
    if (['doc', 'docx'].includes(ext)) return 'description';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'table_view';
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'image';
    if (['mp4', 'webm'].includes(ext)) return 'movie';
    if (['zip', 'rar'].includes(ext)) return 'folder_zip';
    return 'insert_drive_file';
}

export function getDocumentColor(filename: string) {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['pdf'].includes(ext)) return 'text-red-500 bg-red-100 dark:bg-red-900/30';
    if (['doc', 'docx'].includes(ext)) return 'text-blue-500 bg-blue-100 dark:bg-blue-900/30';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30';
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'text-purple-500 bg-purple-100 dark:bg-purple-900/30';
    if (['zip', 'rar'].includes(ext)) return 'text-amber-500 bg-amber-100 dark:bg-amber-900/30';
    return 'text-slate-500 bg-slate-100 dark:bg-slate-800';
}

export default function DocumentUploader({
    documents: rawDocuments,
    onDocumentsChange,
    folder,
    uploaderName,
    maxFiles = MAX_FILES_DEFAULT,
    disabled = false,
    compact = false,
}: DocumentUploaderProps) {
    const documents = normalizePhotos(rawDocuments);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState({ completed: 0, total: 0 });
    const [dragOver, setDragOver] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);

    const handleFiles = useCallback(async (files: FileList | File[]) => {
        const fileArray = Array.from(files);
        if (fileArray.length === 0) return;

        const remaining = maxFiles - documents.length;
        if (remaining <= 0) {
            setErrors([`Máximo ${maxFiles} archivos permitidos.`]);
            return;
        }
        const toUpload = fileArray.slice(0, remaining);

        setUploading(true);
        setErrors([]);
        setProgress({ completed: 0, total: toUpload.length });

        const { photos: newDocs, errors: uploadErrors } = await uploadMultiplePhotos(
            toUpload, folder, uploaderName,
            (completed, total) => setProgress({ completed, total }),
            ACCEPTED_DOCUMENT_TYPES
        );

        if (uploadErrors.length > 0) setErrors(uploadErrors);
        if (newDocs.length > 0) {
            onDocumentsChange([...documents, ...newDocs]);
        }
        setUploading(false);
    }, [documents, folder, uploaderName, maxFiles, onDocumentsChange]);

    const handleRemove = async (idx: number) => {
        const doc = documents[idx];
        if (doc.url) await deletePhoto(doc.url);
        const updated = documents.filter((_, i) => i !== idx);
        onDocumentsChange(updated);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (!disabled && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    };

    return (
        <div className="space-y-3">
            {/* Upload Zone */}
            {!disabled && documents.length < maxFiles && (
                <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className={`relative rounded-xl border-2 border-dashed transition-all ${compact ? 'p-3' : 'p-5'} ${
                        dragOver
                            ? 'border-primary bg-primary/5 scale-[1.01]'
                            : 'border-slate-300 hover:border-primary/50 hover:bg-slate-50/50 dark:border-slate-700 dark:hover:border-primary/40 dark:hover:bg-slate-800/30'
                    }`}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPTED_DOCUMENT_TYPES}
                        multiple
                        className="hidden"
                        onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
                    />

                    <div className={`flex ${compact ? 'flex-row items-center gap-3' : 'flex-col items-center gap-2'}`}>
                        <div className={`flex items-center justify-center rounded-lg bg-primary/10 ${compact ? 'h-10 w-10' : 'h-14 w-14'}`}>
                            <span className={`material-symbols-outlined text-primary ${compact ? 'text-[20px]' : 'text-[28px]'}`}>
                                upload_file
                            </span>
                        </div>
                        <div className={compact ? '' : 'text-center'}>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className={`font-semibold text-primary hover:underline ${compact ? 'text-sm' : 'text-sm'}`}
                            >
                                {compact ? 'Agregar Documentos' : 'Toca para seleccionar archivos'}
                            </button>
                            {!compact && (
                                <p className="text-[11px] text-slate-400 mt-1">
                                    o arrastra archivos aquí · PDF, DOCX, XLSX, JPG · máx {maxFiles - documents.length} más
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Progress */}
            {uploading && (
                <div className="flex items-center gap-3 rounded-lg bg-sky-50 px-4 py-3 dark:bg-sky-900/20">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <div className="flex-1">
                        <div className="flex justify-between text-xs font-semibold text-sky-700 dark:text-sky-300">
                            <span>Subiendo {progress.completed}/{progress.total}...</span>
                            <span>{Math.round((progress.completed / progress.total) * 100)}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-sky-200 dark:bg-sky-800 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-primary transition-all duration-300"
                                style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Errors */}
            {errors.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/40 dark:bg-red-900/10">
                    {errors.map((err, i) => (
                        <p key={i} className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">error</span>
                            {err}
                        </p>
                    ))}
                </div>
            )}

            {/* Documents List */}
            {documents.length > 0 && (
                <div className="flex flex-col gap-2">
                    {documents.map((doc, idx) => (
                        <div
                            key={idx}
                            className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-all hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${getDocumentColor(doc.filename)}`}>
                                    <span className="material-symbols-outlined text-[20px]">{getDocumentIcon(doc.filename)}</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white" title={doc.filename}>
                                        {doc.filename}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {doc.uploaded_by} · {new Date(doc.uploaded_at).toLocaleDateString('es-MX')} · {formatFileSize(doc.size_bytes)}
                                    </p>
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1 ml-4">
                                <a
                                    href={doc.url}
                                    download={doc.filename}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-primary dark:hover:bg-slate-700"
                                    title="Descargar/Ver"
                                >
                                    <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                                </a>
                                {!disabled && (
                                    <button
                                        onClick={() => handleRemove(idx)}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                                        title="Eliminar"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
