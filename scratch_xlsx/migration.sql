-- Migration: Add missing inventory items for Limpieza de Pozos and Equipos de Aforo

UPDATE inventory_products SET area = 'limpieza_pozos' WHERE code LIKE 'LIM-%';

INSERT INTO inventory_products (code, name, description, category, unit, current_stock, min_stock, unit_cost, area, criticality, is_active)
VALUES
  ('AFO-MOT-001', 'Motor SHAKTI 177HP', 'Modelo: S/M, Serie: 2060591801', 'herramienta', 'pieza', 1, 0, 70000, 'equipos_aforo', 'normal', true),
  ('AFO-MOT-002', 'Motor SME 100HP', 'Modelo: 8SME 1000-2 4C-60-D, Serie: 132005125', 'herramienta', 'pieza', 1, 0, 197200, 'equipos_aforo', 'normal', true),
  ('AFO-MOT-003', 'Motor KSB 305HP', 'Modelo: UMA250-190/22GD, Serie: KSB22052101', 'herramienta', 'pieza', 1, 0, 319000, 'equipos_aforo', 'normal', true),
  ('AFO-MOT-004', 'Motor Altamira x  75HP', 'Modelo: MSX8 753460, Serie: 81235034231', 'herramienta', 'pieza', 1, 0, 58000, 'equipos_aforo', 'normal', true),
  ('AFO-MOT-005', 'Motor SME 60HP', 'Modelo: 6SME 600T-4C, Serie: 20192366-520472409253', 'herramienta', 'pieza', 1, 0, 66120, 'equipos_aforo', 'normal', true),
  ('AFO-BOM-001', 'Bomba FRANKLIN 125HP', 'Modelo: 895/15, Serie: S/S', 'herramienta', 'pieza', 1, 0, 40000, 'equipos_aforo', 'normal', true),
  ('AFO-BOM-002', 'Bomba ALTAMIRA 50HP', 'Modelo: KOR32-R500-5, Serie: S/S', 'herramienta', 'pieza', 1, 0, 32000, 'equipos_aforo', 'normal', true),
  ('AFO-BOM-003', 'Bomba ALTAMIRA 100HP', 'Modelo: KOR32 R1000-11, Serie: S/S', 'herramienta', 'pieza', 1, 0, 56000, 'equipos_aforo', 'normal', true),
  ('AFO-BOM-004', 'Bomba FRANKLIN 100HP', 'Modelo: 8, Serie: HTSU120-0124', 'herramienta', 'pieza', 1, 0, 104400, 'equipos_aforo', 'normal', true),
  ('AFO-BOM-005', 'Bomba FRANKLIN 50HP', 'Modelo: 250SR50F66-1863, Serie: 15F70 19-0021', 'herramienta', 'pieza', 1, 0, 30000, 'equipos_aforo', 'normal', true),
  ('AFO-BOM-006', 'Bomba GOULDS 150HP', 'Modelo: S/M, Serie: S/S', 'herramienta', 'pieza', 1, 0, 40000, 'equipos_aforo', 'normal', true),
  ('AFO-BOM-007', 'Bomba ALTAMIRA 75HP', 'Modelo: KOR40 R750-4-1 A, Serie: S/S', 'herramienta', 'pieza', 1, 0, 36000, 'equipos_aforo', 'normal', true),
  ('AFO-BOMC-001', 'Bomba Cliente SHAKTIL 5HP', 'Modelo: S/M, Serie: 2074277704', 'herramienta', 'pieza', 1, 0, 3500, 'equipos_aforo', 'normal', true),
  ('AFO-BOMC-002', 'Bomba Cliente SHAKTIL 20HP', 'Modelo: QF30-15, Serie: 2113404101', 'herramienta', 'pieza', 1, 0, 10000, 'equipos_aforo', 'normal', true),
  ('AFO-BOMC-003', 'Bomba Cliente ALTAMIRA 60HP', 'Modelo: KOR15 R600-17, Serie: S/S', 'herramienta', 'pieza', 1, 0, 18000, 'equipos_aforo', 'normal', true),
  ('AFO-BOMC-004', 'Bomba Cliente ALTAMIRA 60HP', 'Modelo: KOR15 R600-19, Serie: S/S', 'herramienta', 'pieza', 1, 0, 20000, 'equipos_aforo', 'normal', true),
  ('AFO-BOMC-005', 'Bomba Cliente ALTAMIRA 20HP', 'Modelo: KOR6 R200-15, Serie: S/S', 'herramienta', 'pieza', 1, 0, 11000, 'equipos_aforo', 'normal', true),
  ('AFO-BOMC-006', 'Bomba Cliente ALTAMIRA 25HP', 'Modelo: KOR6 R250-21, Serie: S/S', 'herramienta', 'pieza', 1, 0, 14300, 'equipos_aforo', 'normal', true),
  ('AFO-BOMC-007', 'Bomba Cliente SIN MARCA 60HP', 'Modelo: S/M, Serie: S/S', 'herramienta', 'pieza', 1, 0, 48000, 'equipos_aforo', 'normal', true),
  ('AFO-BOMC-008', 'Bomba Cliente GOULDS 300HP', 'Modelo: 9RCLC-7, Serie: HPSU024', 'herramienta', 'pieza', 1, 0, 192000, 'equipos_aforo', 'normal', true),
  ('AFO-BOMC-009', 'Bomba Cliente SIN MARCA 50HP', 'Modelo: S/M, Serie: S/S', 'herramienta', 'pieza', 1, 0, 45000, 'equipos_aforo', 'normal', true),
  ('AFO-BOMC-010', 'Bomba Cliente CABLE PARA AFORO 510 MTS 3X4/0HP', 'Modelo: TOTAL: 625 MIL, Serie: PRECIO DE CABLE POR MITAD, SE COMPRO USADO', 'herramienta', 'pieza', 1, 0, 0, 'equipos_aforo', 'normal', true),
  ('AFO-BOMC-011', 'Bomba Cliente TUBERIA AFORO 10PZA DE 6"HP', 'Modelo: 15PZA DE 3", Serie: TOTAL:', 'herramienta', 'pieza', 1, 0, 0, 'equipos_aforo', 'normal', true),
  ('AFO-BOMC-012', 'Bomba Cliente cable aforo  163 mts 3X6HP', 'Modelo: S/M, Serie: S/S', 'herramienta', 'pieza', 1, 0, 0, 'equipos_aforo', 'normal', true),
  ('AFO-BOMC-013', 'Bomba Cliente CONCEPTO  CANTIDADHP', 'Modelo: S/M, Serie: MAX.', 'herramienta', 'pieza', 1, 0, 0, 'equipos_aforo', 'normal', true),
  ('AFO-BOMC-014', 'Bomba Cliente Tubo de 3" C40c/rosca 6.40m 10HP', 'Modelo: S/M, Serie: S/S', 'herramienta', 'pieza', 1, 0, 0, 'equipos_aforo', 'normal', true),
  ('AFO-BOMC-015', 'Bomba Cliente Tubo de 3" C40 c/rosca cople conico 6mts 1HP', 'Modelo: S/M, Serie: S/S', 'herramienta', 'pieza', 1, 0, 0, 'equipos_aforo', 'normal', true),
  ('AFO-BOMC-016', 'Bomba Cliente Tubo 3" C40 c/rosca y cople conico 4mts 1HP', 'Modelo: S/M, Serie: S/S', 'herramienta', 'pieza', 1, 0, 0, 'equipos_aforo', 'normal', true);
