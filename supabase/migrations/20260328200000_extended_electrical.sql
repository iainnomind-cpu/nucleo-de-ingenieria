-- MÓDULO: Mantenimiento - Parámetros Eléctricos Extendidos (Trifásico)
-- Descripción: Agrega soporte para seguimiento de voltajes y corrientes independientes 
-- por cada fase y los respectivos cálculos de desbalance porcentual.

ALTER TABLE monitoring_logs
ADD COLUMN IF NOT EXISTS voltage_l1 NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS voltage_l2 NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS voltage_l3 NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS voltage_unbalance NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS amperage_a1 NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS amperage_a2 NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS amperage_a3 NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS amperage_unbalance NUMERIC DEFAULT NULL;
