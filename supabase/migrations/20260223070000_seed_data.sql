-- MIGRATION: SEED DATA INTERCONECTADA (M1 - M8)

-- Variables/UUIDs determinísticos para relacionar los registros
-- Se usan valores explícitos en hexadecimal válido para asegurar la integridad referencial

-- =======================================================
-- M1: CLIENTS & CRM
-- =======================================================
INSERT INTO clients (id, company_name, contact_name, email, phone, rfc, industry, status, payment_score, credit_days) VALUES
('47e70259-21cb-4bc9-93b5-7c0ef95cfdbf', 'Agrícola San José', 'José Martínez', 'jose@agricolasanjose.com', '6621002030', 'ASJ901231XYZ', 'Agricultura', 'active', 9.50, 15),
('bd94e772-c518-472b-8a16-6cdaaab54c9a', 'Inmobiliaria Bosques', 'María de la Cruz', 'mcruz@inmobosques.com', '6628009010', 'IBO880101ABC', 'Construcción', 'active', 6.00, 30);

INSERT INTO client_assets (id, client_id, asset_type, name, brand, model, horsepower, depth, status) VALUES
('f0882ef9-8b89-4a94-b1eb-1db17dc02b85', '47e70259-21cb-4bc9-93b5-7c0ef95cfdbf', 'well', 'Pozo Agrícola Norte 1', 'N/A', 'N/A', null, 250, 'active'),
('c3260792-7fcc-4158-b0a3-3b1a8f906e57', 'bd94e772-c518-472b-8a16-6cdaaab54c9a', 'well', 'Pozo Residencial Sur', 'N/A', 'N/A', null, 180, 'maintenance');

INSERT INTO sales_opportunities (id, client_id, title, estimated_value, probability, stage, closing_date) VALUES
('01111111-1111-4111-a111-111111111111', '47e70259-21cb-4bc9-93b5-7c0ef95cfdbf', 'Renovación Bomba Pozo Norte', 350000, 100, 'closed_won', CURRENT_DATE - INTERVAL '15 days'),
('02222222-2222-4222-a222-222222222222', 'bd94e772-c518-472b-8a16-6cdaaab54c9a', 'Rehabilitación y Aforo Sur', 180000, 70, 'negotiation', CURRENT_DATE + INTERVAL '10 days');

-- =======================================================
-- M2: COTIZADOR
-- =======================================================
INSERT INTO service_catalog (id, name, category, base_price, unit) VALUES
('11111111-1111-4111-a111-111111111111', 'Maniobra de Extracción e Instalación', 'equipamiento', 15000, 'servicio'),
('12222222-2222-4222-a222-222222222222', 'Aforo de Pozo (24 hrs)', 'aforo', 25000, 'servicio'),
('13333333-3333-4333-a333-333333333333', 'Rehabilitación Mecánica', 'rehabilitacion', 40000, 'servicio');

INSERT INTO quotes (id, quote_number, client_id, opportunity_id, status, title, estimated_days, subtotal, tax_amount, total) VALUES
('e6644fcf-b6b6-4ac9-8b8a-b86a87c53d08', 'COT-2026-0001', '47e70259-21cb-4bc9-93b5-7c0ef95cfdbf', '01111111-1111-4111-a111-111111111111', 'approved', 'Renovación Pozo Norte', 3, 301724.14, 48275.86, 350000),
('fa93297f-44eb-4a24-9f87-c10ba249f056', 'COT-2026-0002', 'bd94e772-c518-472b-8a16-6cdaaab54c9a', '02222222-2222-4222-a222-222222222222', 'sent', 'Aforo y Revisión Sur', 2, 155172.41, 24827.59, 180000);

-- =======================================================
-- M4: INVENTARIO
-- =======================================================
INSERT INTO inventory_products (id, code, name, category, unit, current_stock, min_stock, unit_cost) VALUES
('c0ab23a8-5fb3-4ac8-bcf6-a19bd9f2b8f8', 'BOM-001', 'Bomba Sumergible 75HP', 'hidraulica', 'pieza', 2, 1, 85000),
('a0f9b3b8-8c1c-4b5b-9dcf-98889aa3b2f9', 'VAR-001', 'Variador de Frecuencia 100HP', 'electrica', 'pieza', 1, 2, 45000),
('f30737a2-bbfa-4bc9-8e5b-b18c02c6c1cb', 'TUB-001', 'Tubería de Columna 6"', 'hidraulica', 'tramo', 120, 50, 4500);

-- Generar necesidad de compra (Variador está bajo mínimo)
INSERT INTO purchase_list_items (product_id, quantity_needed, status, priority) VALUES 
('a0f9b3b8-8c1c-4b5b-9dcf-98889aa3b2f9', 2, 'pending', 'high');

-- =======================================================
-- M3: PROYECTOS & OPERACIONES
-- =======================================================
INSERT INTO projects (id, project_number, quote_id, client_id, title, status, start_date, assigned_team, quoted_amount, actual_cost, checklist_completed_at) VALUES
('8a513d6a-5435-43a9-a78b-d7d8c7c93cb5', 'PRY-2026-0001', 'e6644fcf-b6b6-4ac9-8b8a-b86a87c53d08', '47e70259-21cb-4bc9-93b5-7c0ef95cfdbf', 'Renovación Pozo Norte', 'completed', CURRENT_DATE - INTERVAL '10 days', '["Joel", "Alejandro"]', 350000, 180000, CURRENT_DATE - INTERVAL '11 days'),
('86ea25f1-34e8-46eb-8e5f-e5cb09abcddf', 'PRY-2026-0002', null, 'bd94e772-c518-472b-8a16-6cdaaab54c9a', 'Mantenimiento Preventivo Residencial', 'in_field', CURRENT_DATE, '["Joel", "Emanuel"]', 45000, 15000, CURRENT_DATE - INTERVAL '1 days');

INSERT INTO project_tasks (project_id, title, assigned_to, status, due_date) VALUES
('8a513d6a-5435-43a9-a78b-d7d8c7c93cb5', 'Instalación de Bomba', 'Joel', 'completed', CURRENT_DATE - INTERVAL '8 days'),
('86ea25f1-34e8-46eb-8e5f-e5cb09abcddf', 'Inspección de tablero', 'Alejandro', 'in_progress', CURRENT_DATE + INTERVAL '1 days');

INSERT INTO field_logs (project_id, log_date, author, summary, activities_done) VALUES
('8a513d6a-5435-43a9-a78b-d7d8c7c93cb5', CURRENT_DATE - INTERVAL '8 days', 'Joel', 'Instalación completada exitosamente', 'Se instaló la bomba de 75HP y se configuró variador.');

-- Salidas de inventario por proyecto
INSERT INTO inventory_movements (product_id, movement_type, quantity, unit_cost, total_cost, reason, reference_id, reference_type, reference_number) VALUES
('c0ab23a8-5fb3-4ac8-bcf6-a19bd9f2b8f8', 'exit', 1, 85000, 85000, 'project_consumption', '8a513d6a-5435-43a9-a78b-d7d8c7c93cb5', 'project', 'PRY-2026-0001');

-- =======================================================
-- M5: MANTENIMIENTO PREDICTIVO
-- =======================================================
INSERT INTO installed_equipment (id, client_id, project_id, name, equipment_type, brand, model, well_name, status) VALUES
('21111111-1111-4111-a111-111111111111', '47e70259-21cb-4bc9-93b5-7c0ef95cfdbf', '8a513d6a-5435-43a9-a78b-d7d8c7c93cb5', 'Bomba Principal Norte', 'bomba', 'Grundfos', 'SP 75-10', 'Pozo Agrícola Norte 1', 'active');

INSERT INTO maintenance_contracts (id, client_id, contract_number, title, billing_type, monthly_amount, start_date, end_date, status) VALUES
('c1111111-1111-4111-a111-111111111111', '47e70259-21cb-4bc9-93b5-7c0ef95cfdbf', 'CTR-2026-001', 'Póliza Mantenimiento Norte', 'monthly', 12000, CURRENT_DATE - INTERVAL '1 month', CURRENT_DATE + INTERVAL '11 months', 'active');

INSERT INTO maintenance_schedules (equipment_id, client_id, service_type, title, frequency_months, next_service_date, assigned_to, status) VALUES
('21111111-1111-4111-a111-111111111111', '47e70259-21cb-4bc9-93b5-7c0ef95cfdbf', 'revision_general', 'Revisión Trimestral Bomba Norte', 3, CURRENT_DATE + INTERVAL '80 days', 'Joel', 'scheduled'),
('21111111-1111-4111-a111-111111111111', '47e70259-21cb-4bc9-93b5-7c0ef95cfdbf', 'termografia', 'Inspección Termográfica Tablero', 6, CURRENT_DATE - INTERVAL '2 days', 'Alejandro', 'overdue');

-- =======================================================
-- M6: FINANZAS Y FACTURACIÓN
-- =======================================================
INSERT INTO invoices (id, invoice_number, client_id, project_id, status, issue_date, due_date, subtotal, tax_amount, total, amount_paid, balance) VALUES
('31111111-1111-4111-a111-111111111111', 'FAC-2026-0001', '47e70259-21cb-4bc9-93b5-7c0ef95cfdbf', '8a513d6a-5435-43a9-a78b-d7d8c7c93cb5', 'paid', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '10 days', 301724.14, 48275.86, 350000, 350000, 0),
('32222222-2222-4222-a222-222222222222', 'FAC-2026-0002', 'bd94e772-c518-472b-8a16-6cdaaab54c9a', '86ea25f1-34e8-46eb-8e5f-e5cb09abcddf', 'sent', CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE - INTERVAL '5 days', 38793.10, 6206.90, 45000, 20000, 25000);

INSERT INTO payments (invoice_id, payment_date, amount, payment_method, reference) VALUES
('31111111-1111-4111-a111-111111111111', CURRENT_DATE - INTERVAL '2 days', 350000, 'transfer', 'SPEI-998877'),
('32222222-2222-4222-a222-222222222222', CURRENT_DATE - INTERVAL '15 days', 20000, 'transfer', 'SPEI-443322');

INSERT INTO project_expenses (project_id, category, description, amount, supplier) VALUES
('8a513d6a-5435-43a9-a78b-d7d8c7c93cb5', 'subcontract', 'Grúa para montaje', 15000, 'Grúas del Norte');

-- =======================================================
-- M8: COMUNICACIONES Y EQUIPO
-- =======================================================
INSERT INTO spaces (id, name, space_type, description, is_archived) VALUES
('41111111-1111-4111-a111-111111111111', 'Agrícola San José — Renovación Pozo Norte', 'project', 'Space contextual PRY-2026-0001', false);

INSERT INTO messages (space_id, sender, content, message_type) VALUES
('41111111-1111-4111-a111-111111111111', '12345678-1234-1234-1234-123456789012', '🚀 INICIO DE PROYECTO: Renovación Pozo Norte', 'text');

INSERT INTO team_tasks (title, assigned_to, status, priority, due_date, client_id) VALUES
('Gestionar cobro factura FAC-2026-0002', 'Samara', 'pending', 'urgent', CURRENT_DATE - INTERVAL '5 days', 'bd94e772-c518-472b-8a16-6cdaaab54c9a'),
('Comprar Variadores 100HP', 'Paulina', 'in_progress', 'high', CURRENT_DATE + INTERVAL '2 days', null);

-- Fin de migración de pruebas
