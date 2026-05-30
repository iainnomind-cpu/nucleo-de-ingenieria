-- Migration to create the client_documents table

CREATE TABLE IF NOT EXISTS public.client_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    filename TEXT NOT NULL,
    file_type TEXT,
    size_bytes BIGINT,
    uploaded_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- RLS
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users" 
ON public.client_documents FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" 
ON public.client_documents FOR INSERT 
TO authenticated WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users" 
ON public.client_documents FOR DELETE 
TO authenticated USING (true);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_client_documents_client_id ON public.client_documents(client_id);
