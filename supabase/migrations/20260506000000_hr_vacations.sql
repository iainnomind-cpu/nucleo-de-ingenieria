-- 1. CREATE TABLES

CREATE TABLE hr_employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    full_name VARCHAR(255) UNIQUE NOT NULL,
    department VARCHAR(100),
    hire_date DATE,
    base_vacation_days INTEGER DEFAULT 12,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE hr_absences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES hr_employees(id) ON DELETE CASCADE,
    absence_type VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    days_count DECIMAL(5,1) NOT NULL,
    return_date DATE,
    is_compensated BOOLEAN DEFAULT false,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'approved',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_hr_employees_modtime BEFORE UPDATE ON hr_employees FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_hr_absences_modtime BEFORE UPDATE ON hr_absences FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

ALTER TABLE hr_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_absences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access on hr_employees" ON hr_employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on hr_absences" ON hr_absences FOR ALL USING (true) WITH CHECK (true);

-- 2. INSERT EMPLOYEES
INSERT INTO hr_employees (full_name, department, hire_date) VALUES ('Jorge Morales Urzua', 'Dirección', '2022-03-16') ON CONFLICT (full_name) DO NOTHING;
INSERT INTO hr_employees (full_name, department, hire_date) VALUES ('Edgar Ricardo Morales Villalvazo', 'Operaciones', '2022-03-16') ON CONFLICT (full_name) DO NOTHING;
INSERT INTO hr_employees (full_name, department, hire_date) VALUES ('Alejandro Bernal Solano', 'Operaciones', '2023-03-20') ON CONFLICT (full_name) DO NOTHING;
INSERT INTO hr_employees (full_name, department, hire_date) VALUES ('Francisco Javier Hernandez', 'Operaciones', '2023-06-12') ON CONFLICT (full_name) DO NOTHING;
INSERT INTO hr_employees (full_name, department, hire_date) VALUES ('Joel Rincon Cuevas', 'Ventas', '2023-11-01') ON CONFLICT (full_name) DO NOTHING;
INSERT INTO hr_employees (full_name, department, hire_date) VALUES ('Jesús Eduardo Ortiz', 'Operaciones', '2023-06-15') ON CONFLICT (full_name) DO NOTHING;
INSERT INTO hr_employees (full_name, department, hire_date) VALUES ('Samara Fernanda Ortega', 'Finanzas / Contabilidad', '2023-12-10') ON CONFLICT (full_name) DO NOTHING;
INSERT INTO hr_employees (full_name, department, hire_date) VALUES ('Irery Paulina Sanchez', 'Finanzas / Contabilidad', '2024-09-12') ON CONFLICT (full_name) DO NOTHING;
INSERT INTO hr_employees (full_name, department, hire_date) VALUES ('Jaime Teodoro De La Cruz', 'Operaciones', '2025-07-17') ON CONFLICT (full_name) DO NOTHING;
INSERT INTO hr_employees (full_name, department, hire_date) VALUES ('Ignacio Magaña Arreaga', 'Operaciones', '2025-09-12') ON CONFLICT (full_name) DO NOTHING;
INSERT INTO hr_employees (full_name, department, hire_date) VALUES ('Alondra Cisneros', 'Desarrollo de Producto', '2026-01-01') ON CONFLICT (full_name) DO NOTHING;
INSERT INTO hr_employees (full_name, department, hire_date) VALUES ('Manuel Alexander Villafan Murillo', 'Operaciones', '2025-05-05') ON CONFLICT (full_name) DO NOTHING;

-- 3. INSERT ABSENCES
INSERT INTO hr_absences (employee_id, absence_type, start_date, days_count, return_date, is_compensated) SELECT id, 'VACACIONES', '2026-01-01', 15.0, '2026-01-17', false FROM hr_employees WHERE full_name = 'Jorge Morales Urzua';
INSERT INTO hr_absences (employee_id, absence_type, start_date, days_count, return_date, is_compensated) SELECT id, 'VACACIONES', '2025-02-01', 15.0, '2025-02-16', false FROM hr_employees WHERE full_name = 'Edgar Ricardo Morales Villalvazo';
INSERT INTO hr_absences (employee_id, absence_type, start_date, days_count, return_date, is_compensated) SELECT id, 'VACACIONES', '2025-03-01', 15.0, '2025-03-16', false FROM hr_employees WHERE full_name = 'Alejandro Bernal Solano';
INSERT INTO hr_absences (employee_id, absence_type, start_date, days_count, return_date, is_compensated) SELECT id, 'VACACIONES', '2025-04-01', 15.0, '2025-04-16', false FROM hr_employees WHERE full_name = 'Francisco Javier Hernandez';
INSERT INTO hr_absences (employee_id, absence_type, start_date, days_count, return_date, is_compensated) SELECT id, 'VACACIONES', '2025-05-01', 15.0, '2025-05-16', false FROM hr_employees WHERE full_name = 'Joel Rincon Cuevas';
INSERT INTO hr_absences (employee_id, absence_type, start_date, days_count, return_date, is_compensated) SELECT id, 'PERMISO NO REMUNERADO', '2026-01-21', 1.0, '2026-01-22', false FROM hr_employees WHERE full_name = 'Jesús Eduardo Ortiz';
INSERT INTO hr_absences (employee_id, absence_type, start_date, days_count, return_date, is_compensated) SELECT id, 'PERMISO NO REMUNERADO', '2026-01-02', 1.0, '2026-01-03', false FROM hr_employees WHERE full_name = 'Samara Fernanda Ortega';
INSERT INTO hr_absences (employee_id, absence_type, start_date, days_count, return_date, is_compensated) SELECT id, 'PERMISO NO REMUNERADO', '2026-01-28', 1.0, '2026-01-29', false FROM hr_employees WHERE full_name = 'Irery Paulina Sanchez';
INSERT INTO hr_absences (employee_id, absence_type, start_date, days_count, return_date, is_compensated) SELECT id, 'VACACIONES', '2025-09-01', 15.0, '2025-09-16', false FROM hr_employees WHERE full_name = 'Jaime Teodoro De La Cruz';
INSERT INTO hr_absences (employee_id, absence_type, start_date, days_count, return_date, is_compensated) SELECT id, 'VACACIONES', '2025-02-01', 3.0, '2025-02-04', false FROM hr_employees WHERE full_name = 'Ignacio Magaña Arreaga';
INSERT INTO hr_absences (employee_id, absence_type, start_date, days_count, return_date, is_compensated) SELECT id, 'VACACIONES', '2025-03-03', 5.0, '2025-03-08', false FROM hr_employees WHERE full_name = 'Alondra Cisneros';
INSERT INTO hr_absences (employee_id, absence_type, start_date, days_count, return_date, is_compensated) SELECT id, 'PERMISO NO REMUNERADO', '2026-01-31', 1.0, '2026-02-01', false FROM hr_employees WHERE full_name = 'Manuel Alexander Villafan Murillo';
INSERT INTO hr_absences (employee_id, absence_type, start_date, days_count, return_date, is_compensated) SELECT id, 'PERMISO NO REMUNERADO', '2026-01-13', 1.0, '2026-01-14', false FROM hr_employees WHERE full_name = 'Manuel Alexander Villafan Murillo';
INSERT INTO hr_absences (employee_id, absence_type, start_date, days_count, return_date, is_compensated) SELECT id, 'PERMISO NO REMUNERADO', '2026-02-04', 1.0, '2026-02-05', false FROM hr_employees WHERE full_name = 'Samara Fernanda Ortega';
INSERT INTO hr_absences (employee_id, absence_type, start_date, days_count, return_date, is_compensated) SELECT id, 'PERMISO NO REMUNERADO', '2026-02-16', 1.0, '2026-02-17', false FROM hr_employees WHERE full_name = 'Jaime Teodoro De La Cruz';
INSERT INTO hr_absences (employee_id, absence_type, start_date, days_count, return_date, is_compensated) SELECT id, 'PERMISO NO REMUNERADO', '2026-02-16', 1.0, '2026-02-17', false FROM hr_employees WHERE full_name = 'Manuel Alexander Villafan Murillo';
INSERT INTO hr_absences (employee_id, absence_type, start_date, days_count, return_date, is_compensated) SELECT id, 'PERMISO NO REMUNERADO', '2026-04-02', 9.0, '2026-04-13', false FROM hr_employees WHERE full_name = 'Irery Paulina Sanchez';
INSERT INTO hr_absences (employee_id, absence_type, start_date, days_count, return_date, is_compensated) SELECT id, 'PERMISO NO REMUNERADO', '2026-03-12', 1.0, '2026-03-13', false FROM hr_employees WHERE full_name = 'Alondra Cisneros';
INSERT INTO hr_absences (employee_id, absence_type, start_date, days_count, return_date, is_compensated) SELECT id, 'PERMISO NO REMUNERADO', '2026-03-18', 1.0, '2026-03-19', false FROM hr_employees WHERE full_name = 'Samara Fernanda Ortega';
INSERT INTO hr_absences (employee_id, absence_type, start_date, days_count, return_date, is_compensated) SELECT id, 'PERMISO NO REMUNERADO', '2026-03-18', 1.0, '2026-03-19', false FROM hr_employees WHERE full_name = 'Irery Paulina Sanchez';
INSERT INTO hr_absences (employee_id, absence_type, start_date, days_count, return_date, is_compensated) SELECT id, 'PERMISO NO REMUNERADO', '2026-04-04', 2.0, '2026-04-06', false FROM hr_employees WHERE full_name = 'Alondra Cisneros';
INSERT INTO hr_absences (employee_id, absence_type, start_date, days_count, return_date, is_compensated) SELECT id, 'VACACIONES', '2026-04-04', 2.0, '2026-04-06', false FROM hr_employees WHERE full_name = 'Joel Rincon Cuevas';
INSERT INTO hr_absences (employee_id, absence_type, start_date, days_count, return_date, is_compensated) SELECT id, 'PERMISO NO REMUNERADO', '2026-03-31', 11.0, '2026-04-13', false FROM hr_employees WHERE full_name = 'Samara Fernanda Ortega';
INSERT INTO hr_absences (employee_id, absence_type, start_date, days_count, return_date, is_compensated) SELECT id, 'PERMISO NO REMUNERADO', '2026-05-02', 1.0, '2026-05-03', false FROM hr_employees WHERE full_name = 'Irery Paulina Sanchez';