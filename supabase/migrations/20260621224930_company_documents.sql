-- Create table for Company Document Folders
CREATE TABLE IF NOT EXISTS company_document_folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE company_document_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to authenticated users for company_document_folders" ON company_document_folders
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create table for Company Documents
CREATE TABLE IF NOT EXISTS company_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    folder_id UUID REFERENCES company_document_folders(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(100),
    file_size_bytes BIGINT,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE company_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to authenticated users for company_documents" ON company_documents
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Insert some default folders
INSERT INTO company_document_folders (name) VALUES 
('Políticas y Procedimientos'),
('Actas Constitutivas'),
('Contratos Globales'),
('Identidad y Logotipos')
ON CONFLICT DO NOTHING;

-- Storage Bucket configuration for company-documents
INSERT INTO storage.buckets (id, name, public) VALUES ('company-documents', 'company-documents', true) ON CONFLICT DO NOTHING;

CREATE POLICY "Allow public read access to company-documents" ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'company-documents');

CREATE POLICY "Allow authenticated uploads to company-documents" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'company-documents');

CREATE POLICY "Allow authenticated deletes for company-documents" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'company-documents');
