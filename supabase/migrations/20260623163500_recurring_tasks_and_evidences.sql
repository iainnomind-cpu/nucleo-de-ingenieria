-- Tareas Recurrentes + Evidencias
-- Migration: 20260623163500_recurring_tasks_and_evidences.sql

-- 1. Agregar campos de recurrencia a team_tasks
ALTER TABLE team_tasks ADD COLUMN IF NOT EXISTS recurrence VARCHAR(50) DEFAULT NULL;
-- 'daily' | 'weekdays' | 'weekly' | 'monthly' | NULL
ALTER TABLE team_tasks ADD COLUMN IF NOT EXISTS recurrence_end_date DATE DEFAULT NULL;
ALTER TABLE team_tasks ADD COLUMN IF NOT EXISTS parent_recurring_task_id UUID REFERENCES team_tasks(id) ON DELETE SET NULL;

-- 2. Tabla de evidencias de tareas
CREATE TABLE IF NOT EXISTS task_evidences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES team_tasks(id) ON DELETE CASCADE NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(100),
    file_size_bytes BIGINT,
    uploaded_by VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE task_evidences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on task_evidences" ON task_evidences FOR ALL USING (true) WITH CHECK (true);

-- 3. Storage bucket para evidencias
INSERT INTO storage.buckets (id, name, public) VALUES ('task-evidences', 'task-evidences', true) ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'task-evidences-select') THEN
    CREATE POLICY "task-evidences-select" ON storage.objects FOR SELECT USING (bucket_id = 'task-evidences');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'task-evidences-insert') THEN
    CREATE POLICY "task-evidences-insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'task-evidences');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'task-evidences-update') THEN
    CREATE POLICY "task-evidences-update" ON storage.objects FOR UPDATE USING (bucket_id = 'task-evidences');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'task-evidences-delete') THEN
    CREATE POLICY "task-evidences-delete" ON storage.objects FOR DELETE USING (bucket_id = 'task-evidences');
  END IF;
END $$;
