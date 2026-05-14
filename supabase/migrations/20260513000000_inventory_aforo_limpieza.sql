-- Migration: Add missing inventory items for Limpieza de Pozos and Equipos de Aforo
-- Updates existing "Limpieza de Pozos" items to use the correct area 'limpieza_pozos'
-- Inserts missing items from "Equipos de Aforos" sheet

UPDATE inventory_products SET area = 'limpieza_pozos' WHERE code LIKE 'LIM-%';

INSERT INTO inventory_products (code, name, description, category, unit, current_stock, min_stock, unit_cost, area, criticality, is_active)
VALUES
  ('AFO-MOT-001', 'Motor SHAKTI 177 HP', 'Modelo: S/M, Serie: 2060591801', 'herramienta', 'pieza', 1, 0, 70000, 'equipos_aforo', 'normal', true),
  ('AFO-MOT-002', 'Motor SME 100 HP', 'Modelo: 8SME 1000-2 4C-60-D, Serie: 132005125', 'herramienta', 'pieza', 1, 0, 197200, 'equipos_aforo', 'normal', true),
  ('AFO-MOT-003', 'Motor KSB 305 HP', 'Modelo: UMA250-190/22GD, Serie: KSB22052101', 'herramienta', 'pieza', 1, 0, 319000, 'equipos_aforo', 'normal', true),
  ('AFO-MOT-004', 'Motor Altamira 75 HP', 'Modelo: MSX8 753460, Serie: 81235034231', 'herramienta', 'pieza', 1, 0, 58000, 'equipos_aforo', 'normal', true),
  ('AFO-MOT-005', 'Motor SME 60 HP', 'Modelo: 6SME 600T-4C, Serie: 20192366-520472409253', 'herramienta', 'pieza', 1, 0, 66120, 'equipos_aforo', 'normal', true),
  ('AFO-BOM-001', 'Bomba FRANKLIN 125 HP', 'Modelo: 895/15, Serie: S/S', 'herramienta', 'pieza', 1, 0, 40000, 'equipos_aforo', 'normal', true),
  ('AFO-BOM-002', 'Bomba ALTAMIRA 50 HP', 'Modelo: KOR32-R500-5, Serie: S/S', 'herramienta', 'pieza', 1, 0, 32000, 'equipos_aforo', 'normal', true),
  ('AFO-BOM-003', 'Bomba ALTAMIRA 100 HP', 'Modelo: KOR32 R1000-11, Serie: S/S', 'herramienta', 'pieza', 1, 0, 56000, 'equipos_aforo', 'normal', true),
  ('AFO-BOM-004', 'Bomba FRANKLIN 100 HP', 'Modelo: 8, Serie: HTSU120-0124', 'herramienta', 'pieza', 1, 0, 104400, 'equipos_aforo', 'normal', true),
  ('AFO-BOM-005', 'Bomba FRANKLIN 50 HP', 'Modelo: 250SR50F66-1863, Serie: 15F70 19-0021', 'herramienta', 'pieza', 1, 0, 30000, 'equipos_aforo', 'normal', true),
  ('AFO-BOM-006', 'Bomba GOULDS 150 HP', 'Modelo: S/M, Serie: S/S', 'herramienta', 'pieza', 1, 0, 40000, 'equipos_aforo', 'normal', true),
  ('AFO-BOM-007', 'Bomba ALTAMIRA 75 HP', 'Modelo: KOR40 R750-4-1 A, Serie: S/S', 'herramienta', 'pieza', 1, 0, 36000, 'equipos_aforo', 'normal', true),
  ('AFO-BOMC-001', 'Bomba Cliente SHAKTIL 5 HP', 'Modelo: S/M, Serie: 2074277704', 'herramienta', 'pieza', 1, 0, 3500, 'equipos_aforo', 'normal', true),
  ('AFO-BOMC-002', 'Bomba Cliente SHAKTIL 20 HP', 'Modelo: QF30-15, Serie: 2113404101', 'herramienta', 'pieza', 1, 0, 10000, 'equipos_aforo', 'normal', true),
  ('AFO-BOMC-003', 'Bomba Cliente ALTAMIRA 60 HP', 'Modelo: KOR15 R600-17, Serie: S/S', 'herramienta', 'pieza', 1, 0, 18000, 'equipos_aforo', 'normal', true),
  ('AFO-BOMC-004', 'Bomba Cliente ALTAMIRA 60 HP', 'Modelo: KOR15 R600-19, Serie: S/S', 'herramienta', 'pieza', 1, 0, 20000, 'equipos_aforo', 'normal', true),
  ('AFO-BOMC-005', 'Bomba Cliente ALTAMIRA 20 HP', 'Modelo: KOR6 R200-15, Serie: S/S', 'herramienta', 'pieza', 1, 0, 11000, 'equipos_aforo', 'normal', true),
  ('AFO-BOMC-006', 'Bomba Cliente ALTAMIRA 25 HP', 'Modelo: KOR6 R250-21, Serie: S/S', 'herramienta', 'pieza', 1, 0, 14300, 'equipos_aforo', 'normal', true),
  ('AFO-BOMC-007', 'Bomba Cliente SIN MARCA 60 HP', 'Modelo: S/M, Serie: S/S', 'herramienta', 'pieza', 1, 0, 48000, 'equipos_aforo', 'normal', true),
  ('AFO-BOMC-008', 'Bomba Cliente GOULDS 300 HP', 'Modelo: 9RCLC-7, Serie: HPSU024', 'herramienta', 'pieza', 1, 0, 192000, 'equipos_aforo', 'normal', true),
  ('AFO-BOMC-009', 'Bomba Cliente SIN MARCA 50 HP', 'Modelo: S/M, Serie: S/S', 'herramienta', 'pieza', 1, 0, 45000, 'equipos_aforo', 'normal', true),
  ('AFO-CBL-001', 'CABLE PARA AFORO 510 MTS 3X4/0', '', 'herramienta', 'pieza', 1, 0, 0, 'equipos_aforo', 'normal', true),
  ('AFO-TUB-001', 'TUBERIA AFORO 10PZA DE 6"', '', 'herramienta', 'pieza', 10, 0, 0, 'equipos_aforo', 'normal', true),
  ('AFO-CBL-002', 'Cable aforo 163 mts 3X6', '', 'herramienta', 'pieza', 1, 0, 0, 'equipos_aforo', 'normal', true),
  ('AFO-TUB-002', 'Tubo de 3" C40 c/rosca 6.40m', '', 'herramienta', 'pieza', 10, 0, 0, 'equipos_aforo', 'normal', true),
  ('AFO-TUB-003', 'Tubo de 3" C40 c/rosca cople conico 6mts', '', 'herramienta', 'pieza', 1, 0, 0, 'equipos_aforo', 'normal', true),
  ('AFO-TUB-004', 'Tubo 3" C40 c/rosca y cople conico 4mts', '', 'herramienta', 'pieza', 1, 0, 0, 'equipos_aforo', 'normal', true)
ON CONFLICT (code) DO NOTHING;
