-- Add vacation_start_date column to hr_employees
-- This allows overriding the hire_date as the reference for vacation entitlement calculation.
-- If NULL, the system falls back to hire_date.
ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS vacation_start_date DATE;
