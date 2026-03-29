import { useState, useRef, useCallback } from 'react';
import { PhotoAttachment, normalizePhotos, ACCEPTED_FILE_TYPES, MAX_FILES_DEFAULT } from '../types/photos';
import { uploadMultiplePhotos, deletePhoto, formatFileSize } from '../lib/storage';

interface PhotoUploaderProps {
    photos: unknown[];
    onPhotosChange: (photos: PhotoAttachment[]) => void;
    folder: string;
    uploaderName: string;
    maxFiles?: number;
    disabled?: boolean;
    compact?: boolean;
}

export default function PhotoUploader({
    photos: rawPhotos,
    onPhotosChange,
    folder,
    uploaderName,
    maxFiles = MAX_FILES_DEFAULT,
    disabled = false,
    compact = false,
}: PhotoUploaderProps) {
    const photos = normalizePhotos(rawPhotos);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState({ completed: 0, total: 0 });
    const [dragOver, setDragOver] = useState(false);
    const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
    const [errors, setErrors] = useState<string[]>([]);

    const handleFiles = useCallback(async (files: FileList | File[]) => {
        const fileArray = Array.from(files);
        if (fileArray.length === 0) return;

        const remaining = maxFiles - photos.length;
        if (remaining <= 0) {
            setErrors([`Máximo ${maxFiles} archivos permitidos.`]);
            return;
        }
        const toUpload = fileArray.slice(0, remaining);

        setUploading(true);
        setErrors([]);
        setProgress({ completed: 0, total: toUpload.length });

        const { photos: newPhotos, errors: uploadErrors } = await uploadMultiplePhotos(
            toUpload, folder, uploaderName,
            (completed, total) => setProgress({ completed, total })
        );

        if (uploadErrors.length > 0) setErrors(uploadErrors);
        if (newPhotos.length > 0) {
            onPhotosChange([...photos, ...newPhotos]);
        }
        setUploading(false);
    }, [photos, folder, uploaderName, maxFiles, onPhotosChange]);

    const handleRemove = async (idx: number) => {
        const photo = photos[idx];
        if (photo.url) await deletePhoto(photo.url);
        const updated = photos.filter((_, i) => i !== idx);
        onPhotosChange(updated);
        if (lightboxIdx !== null) setLightboxIdx(null);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (!disabled && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    };

    const isVideo = (url: string) => /\.(mp4|webm)$/i.test(url);

    return (
        <div className="space-y-3">
            {/* Upload Zone */}
            {!disabled && photos.length < maxFiles && (
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
                        accept={ACCEPTED_FILE_TYPES}
                        multiple
                        capture="environment"
                        className="hidden"
                        onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
                    />

                    <div className={`flex ${compact ? 'flex-row items-center gap-3' : 'flex-col items-center gap-2'}`}>
                        <div className={`flex items-center justify-center rounded-lg bg-primary/10 ${compact ? 'h-10 w-10' : 'h-14 w-14'}`}>
                            <span className={`material-symbols-outlined text-primary ${compact ? 'text-[20px]' : 'text-[28px]'}`}>
                                add_a_photo
                            </span>
                        </div>
                        <div className={compact ? '' : 'text-center'}>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className={`font-semibold text-primary hover:underline ${compact ? 'text-sm' : 'text-sm'}`}
                            >
                                {compact ? 'Agregar Fotos' : 'Toca para abrir cámara o galería'}
                            </button>
                            {!compact && (
                                <p className="text-[11px] text-slate-400 mt-1">
                                    o arrastra archivos aquí · JPG, PNG, WEBP, MP4 · máx {maxFiles - photos.length} más
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

            {/* Thumbnails Grid */}
            {photos.length > 0 && (
                <div className={`grid gap-2 ${compact ? 'grid-cols-4 sm:grid-cols-6' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6'}`}>
                    {photos.map((photo, idx) => (
                        <div
                            key={idx}
                            className="group relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 cursor-pointer transition-transform hover:scale-[1.03] hover:shadow-md"
                            onClick={() => setLightboxIdx(idx)}
                        >
                            {isVideo(photo.url) ? (
                                <div className="flex h-full w-full items-center justify-center bg-slate-900">
                                    <span className="material-symbols-outlined text-white text-[32px]">play_circle</span>
                                </div>
                            ) : (
                                <img
                                    src={photo.url}
                                    alt={photo.filename}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                />
                            )}

                            {/* Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="absolute bottom-0 left-0 right-0 p-1.5">
                                    <p className="text-[9px] text-white/90 truncate font-medium">{photo.uploaded_by}</p>
                                    <p className="text-[8px] text-white/60">{formatFileSize(photo.size_bytes)}</p>
                                </div>
                            </div>

                            {/* Remove button */}
                            {!disabled && (
                                <button
                                    onClick={e => { e.stopPropagation(); handleRemove(idx); }}
                                    className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500/90 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                >
                                    <span className="material-symbols-outlined text-[12px]">close</span>
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Lightbox Modal */}
            {lightboxIdx !== null && photos[lightboxIdx] && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={() => setLightboxIdx(null)}
                >
                    <div className="relative max-h-[90vh] max-w-[90vw] flex flex-col" onClick={e => e.stopPropagation()}>
                        {/* Controls */}
                        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent p-4">
                            <div className="text-white">
                                <p className="text-sm font-semibold">{photos[lightboxIdx].filename}</p>
                                <p className="text-xs text-white/60">
                                    {photos[lightboxIdx].uploaded_by} · {new Date(photos[lightboxIdx].uploaded_at).toLocaleDateString('es-MX')} · {formatFileSize(photos[lightboxIdx].size_bytes)}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={photos[lightboxIdx].url}
                                    download={photos[lightboxIdx].filename}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
                                    title="Descargar"
                                >
                                    <span className="material-symbols-outlined text-[20px]">download</span>
                                </a>
                                <button
                                    onClick={() => setLightboxIdx(null)}
                                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[20px]">close</span>
                                </button>
                            </div>
                        </div>

                        {/* Image */}
                        {isVideo(photos[lightboxIdx].url) ? (
                            <video
                                src={photos[lightboxIdx].url}
                                controls
                                className="max-h-[85vh] max-w-[85vw] rounded-lg"
                            />
                        ) : (
                            <img
                                src={photos[lightboxIdx].url}
                                alt={photos[lightboxIdx].filename}
                                className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
                            />
                        )}

                        {/* Navigation arrows */}
                        {photos.length > 1 && (
                            <>
                                <button
                                    onClick={() => setLightboxIdx(lightboxIdx > 0 ? lightboxIdx - 1 : photos.length - 1)}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                                >
                                    <span className="material-symbols-outlined">chevron_left</span>
                                </button>
                                <button
                                    onClick={() => setLightboxIdx(lightboxIdx < photos.length - 1 ? lightboxIdx + 1 : 0)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                                >
                                    <span className="material-symbols-outlined">chevron_right</span>
                                </button>
                            </>
                        )}

                        {/* Counter */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white">
                            {lightboxIdx + 1} / {photos.length}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Componente de solo lectura para mostrar fotos en registros existentes.
 */
export function PhotoGallery({ photos: rawPhotos }: { photos: unknown[] }) {
    const photos = normalizePhotos(rawPhotos);
    if (photos.length === 0) return null;

    return (
        <PhotoUploader
            photos={rawPhotos}
            onPhotosChange={() => {}}
            folder=""
            uploaderName=""
            disabled={true}
        />
    );
}
