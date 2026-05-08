-- Add SAT document URL columns to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sat_pdf_url text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sat_xml_url text;

-- Create storage bucket for documents if it doesn't exist
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Policies: skip if already exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read access on documents' AND tablename = 'objects') THEN
    CREATE POLICY "Public read access on documents" ON storage.objects FOR SELECT USING (bucket_id = 'documents');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated upload on documents' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated upload on documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated update on documents' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated update on documents" ON storage.objects FOR UPDATE USING (bucket_id = 'documents');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated delete on documents' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated delete on documents" ON storage.objects FOR DELETE USING (bucket_id = 'documents');
  END IF;
END $$;
