-- MÓDULO: EVIDENCIA FOTOGRÁFICA — Soporte de fotos en campo

-- 1. Agregar columna photos a project_incidents (field_logs y monitoring_logs ya la tienen)
ALTER TABLE project_incidents ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]';

-- 2. Crear bucket de Supabase Storage para evidencia fotográfica
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'evidence-photos',
    'evidence-photos',
    true,
    20971520, -- 20MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS policies para el bucket (acceso público, consistente con el resto del ERP)
CREATE POLICY "Allow public read evidence-photos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'evidence-photos');

CREATE POLICY "Allow public insert evidence-photos"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'evidence-photos');

CREATE POLICY "Allow public delete evidence-photos"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'evidence-photos');
