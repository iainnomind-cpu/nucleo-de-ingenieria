import { supabase } from './supabase';
import { PhotoAttachment, MAX_FILE_SIZE, ACCEPTED_FILE_TYPES } from '../types/photos';

const BUCKET = 'evidence-photos';

/**
 * Genera un nombre de archivo único con timestamp y sufijo aleatorio.
 */
function generateUniqueFilename(originalName: string): string {
    const ext = originalName.split('.').pop()?.toLowerCase() || 'jpg';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}_${random}.${ext}`;
}

/**
 * Valida un archivo antes de subir.
 */
function validateFile(file: File): string | null {
    if (file.size > MAX_FILE_SIZE) {
        return `"${file.name}" excede el límite de 20MB (${(file.size / 1024 / 1024).toFixed(1)}MB)`;
    }
    const allowedTypes = ACCEPTED_FILE_TYPES.split(',');
    if (!allowedTypes.includes(file.type)) {
        return `"${file.name}" no es un tipo permitido. Usa JPG, PNG, WEBP o MP4.`;
    }
    return null;
}

/**
 * Sube un archivo al bucket de Supabase Storage.
 * @param file - Archivo a subir
 * @param folder - Carpeta dentro del bucket (e.g. "field-logs/uuid-del-proyecto")
 * @param uploaderName - Nombre de quien sube la foto
 * @returns PhotoAttachment con metadata, o null si falla
 */
export async function uploadPhoto(
    file: File,
    folder: string,
    uploaderName: string
): Promise<{ data: PhotoAttachment | null; error: string | null }> {
    // Validar
    const validationError = validateFile(file);
    if (validationError) return { data: null, error: validationError };

    const filename = generateUniqueFilename(file.name);
    const path = `${folder}/${filename}`;

    // Subir
    const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
        });

    if (uploadError) {
        return { data: null, error: `Error al subir "${file.name}": ${uploadError.message}` };
    }

    // Obtener URL pública
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return {
        data: {
            url: urlData.publicUrl,
            filename: file.name,
            uploaded_by: uploaderName,
            uploaded_at: new Date().toISOString(),
            size_bytes: file.size,
        },
        error: null,
    };
}

/**
 * Sube múltiples archivos en paralelo.
 */
export async function uploadMultiplePhotos(
    files: File[],
    folder: string,
    uploaderName: string,
    onProgress?: (completed: number, total: number) => void
): Promise<{ photos: PhotoAttachment[]; errors: string[] }> {
    const photos: PhotoAttachment[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
        const result = await uploadPhoto(files[i], folder, uploaderName);
        if (result.data) {
            photos.push(result.data);
        }
        if (result.error) {
            errors.push(result.error);
        }
        onProgress?.(i + 1, files.length);
    }

    return { photos, errors };
}

/**
 * Elimina una foto del bucket.
 */
export async function deletePhoto(url: string): Promise<boolean> {
    // Extraer path del URL: https://xxx.supabase.co/storage/v1/object/public/evidence-photos/folder/file.jpg
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return false;

    const path = url.substring(idx + marker.length);
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    return !error;
}

/**
 * Formatea el tamaño de archivo.
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
