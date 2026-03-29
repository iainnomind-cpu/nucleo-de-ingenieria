-- Add video recordings table for maintenance module

CREATE TABLE IF NOT EXISTS public.video_recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_id UUID NOT NULL REFERENCES public.installed_equipment(id) ON DELETE CASCADE,
    recording_date DATE NOT NULL,
    recorded_by TEXT,
    grid_depth NUMERIC,
    static_level NUMERIC,
    bottom_depth NUMERIC,
    casing_observations TEXT,
    video_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.video_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.video_recordings
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON public.video_recordings
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON public.video_recordings
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users only" ON public.video_recordings
    FOR DELETE USING (auth.role() = 'authenticated');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_video_recordings_equipment_id ON public.video_recordings(equipment_id);
CREATE INDEX IF NOT EXISTS idx_video_recordings_date ON public.video_recordings(recording_date);
