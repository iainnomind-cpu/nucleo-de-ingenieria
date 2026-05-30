-- Insert a new bucket for client documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-documents',
  'client-documents',
  true,
  20971520, -- 20MB
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip',
    'application/x-rar-compressed'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  file_size_limit = EXCLUDED.file_size_limit;

-- Enable RLS
-- Note: buckets have policies on storage.objects

-- Allow public read access to client-documents
DROP POLICY IF EXISTS "Public Access for client-documents" ON storage.objects;
CREATE POLICY "Public Access for client-documents" ON storage.objects
FOR SELECT USING (bucket_id = 'client-documents');

-- Allow authenticated users to upload to client-documents
DROP POLICY IF EXISTS "Authenticated users can upload to client-documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload to client-documents" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'client-documents');

-- Allow authenticated users to update/delete their uploads or any upload if needed
DROP POLICY IF EXISTS "Authenticated users can delete in client-documents" ON storage.objects;
CREATE POLICY "Authenticated users can delete in client-documents" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'client-documents');

DROP POLICY IF EXISTS "Authenticated users can update in client-documents" ON storage.objects;
CREATE POLICY "Authenticated users can update in client-documents" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'client-documents');
