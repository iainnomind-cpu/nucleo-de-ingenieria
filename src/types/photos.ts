export interface PhotoAttachment {
    url: string;
    filename: string;
    uploaded_by: string;
    uploaded_at: string;
    size_bytes: number;
}

/**
 * Normaliza datos de fotos: soporta tanto el formato legacy (string[]) 
 * como el nuevo formato (PhotoAttachment[]).
 */
export function normalizePhotos(raw: unknown): PhotoAttachment[] {
    if (!raw || !Array.isArray(raw)) return [];
    return raw.map((item: unknown) => {
        if (typeof item === 'string') {
            // Legacy format: just a URL string
            return {
                url: item,
                filename: item.split('/').pop() || 'photo.jpg',
                uploaded_by: 'Sistema',
                uploaded_at: new Date().toISOString(),
                size_bytes: 0,
            };
        }
        return item as PhotoAttachment;
    });
}

export const ACCEPTED_FILE_TYPES = 'image/jpeg,image/png,image/webp,video/mp4';
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
export const MAX_FILES_DEFAULT = 10;
