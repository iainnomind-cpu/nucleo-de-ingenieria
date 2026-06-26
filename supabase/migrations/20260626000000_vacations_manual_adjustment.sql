-- Add manual adjustment column for vacations
ALTER TABLE hr_employees 
ADD COLUMN IF NOT EXISTS manual_vacation_adjustment DECIMAL(5,1) DEFAULT 0;
