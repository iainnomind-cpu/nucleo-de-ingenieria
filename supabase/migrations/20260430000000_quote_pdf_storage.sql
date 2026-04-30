-- ═══════════════════════════════════════════════════════════════
-- STORAGE: Bucket para PDFs de Cotizaciones
-- Permite subir cotizaciones generadas para enviarlas por WhatsApp
-- ═══════════════════════════════════════════════════════════════

-- 1. Crear bucket público para PDFs de cotizaciones
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'quote-pdfs',
    'quote-pdfs',
    true,
    10485760, -- 10MB
    ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS policies (acceso público, consistente con el bucket evidence-photos)
CREATE POLICY "Allow public read quote-pdfs"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'quote-pdfs');

CREATE POLICY "Allow public insert quote-pdfs"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'quote-pdfs');

CREATE POLICY "Allow public delete quote-pdfs"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'quote-pdfs');

-- 3. Agregar campos a wa_conversations para auto-envío de documentos
--    Cuando el cliente responde a una plantilla, el sistema puede enviar
--    automáticamente el PDF dentro de la ventana de 24h.
ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS pending_document_url TEXT;
ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS pending_document_filename TEXT;
