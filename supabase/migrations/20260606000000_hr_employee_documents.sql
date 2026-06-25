-- 1. CREATE TABLES

CREATE TABLE IF NOT EXISTS hr_document_folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES hr_employees(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, name)
);

CREATE TABLE IF NOT EXISTS hr_employee_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES hr_employees(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES hr_document_folders(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(100),
    file_size_bytes BIGINT,
    uploaded_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. ENABLE ROW LEVEL SECURITY

ALTER TABLE hr_document_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_employee_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access on hr_document_folders" ON hr_document_folders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on hr_employee_documents" ON hr_employee_documents FOR ALL USING (true) WITH CHECK (true);

-- 3. STORAGE BUCKET CONFIGURATION
-- Insert the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('hr_documents', 'hr_documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for storage.objects (bucket: hr_documents)
CREATE POLICY "Allow authenticated access to hr_documents" 
ON storage.objects FOR ALL 
TO authenticated 
USING (bucket_id = 'hr_documents') 
WITH CHECK (bucket_id = 'hr_documents');

