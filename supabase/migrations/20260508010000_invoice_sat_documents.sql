-- Add SAT document URL columns to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sat_pdf_url text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sat_xml_url text;

-- Create storage bucket for documents if it doesn't exist
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public reads on documents bucket
CREATE POLICY "Public read access on documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents');

-- Allow authenticated uploads on documents bucket
CREATE POLICY "Authenticated upload on documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents');

-- Allow authenticated updates (upsert) on documents bucket
CREATE POLICY "Authenticated update on documents" ON storage.objects
  FOR UPDATE USING (bucket_id = 'documents');

-- Allow authenticated deletes on documents bucket
CREATE POLICY "Authenticated delete on documents" ON storage.objects
  FOR DELETE USING (bucket_id = 'documents');
