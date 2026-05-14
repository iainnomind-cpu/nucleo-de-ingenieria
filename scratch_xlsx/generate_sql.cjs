const fs = require('fs');

const data = JSON.parse(fs.readFileSync('output.json', 'utf8'));

const aforos = data.aforos;

let motors = [];
let pumps = [];
let clientPumps = [];

let currentSection = null;

for (let row of aforos) {
  if (row.length === 0) continue;
  if (row[0] === 'MOTORES  EN BODEGA') {
    currentSection = 'motors';
    continue;
  } else if (row[0] === 'BOMBAS EN BODEGA') {
    currentSection = 'pumps';
    continue;
  } else if (row[2] === 'BOMBAS CLIENTES') {
    currentSection = 'clientPumps';
    continue;
  } else if (row[0] === 'MARCA MOTOR' || row[0] === 'MARCA' || row[0] === null) {
    continue;
  }

  if (currentSection === 'motors') {
    if (row[0] && typeof row[0] === 'string' && row[1]) {
      motors.push({
        marca: row[0],
        hp: row[1],
        modelo: row[3] || 'S/M',
        serie: row[4] || 'S/S',
        precio: row[11] || 0
      });
    }
  } else if (currentSection === 'pumps') {
    if (row[0] && typeof row[0] === 'string' && row[1]) {
      pumps.push({
        marca: row[0],
        hp: row[1],
        modelo: row[4] || 'S/M',
        serie: row[5] || 'S/S',
        precio: row[11] || 0
      });
    }
  } else if (currentSection === 'clientPumps') {
    if (row[0] && typeof row[0] === 'string' && row[1]) {
      clientPumps.push({
        marca: row[0],
        hp: row[1],
        modelo: row[4] || 'S/M',
        serie: row[5] || 'S/S',
        precio: row[11] || 0
      });
    }
  }
}

let sql = `-- Migration: Add missing inventory items for Limpieza de Pozos and Equipos de Aforo\n\n`;

// Fix Limpieza de Pozos area
sql += `UPDATE inventory_products SET area = 'limpieza_pozos' WHERE code LIKE 'LIM-%';\n\n`;

// Add Equipos de Aforo
sql += `INSERT INTO inventory_products (code, name, description, category, unit, current_stock, min_stock, unit_cost, area, criticality, is_active)\nVALUES\n`;

let index = 1;
const values = [];

for (let m of motors) {
  const code = `AFO-MOT-${String(index++).padStart(3, '0')}`;
  const name = `Motor ${m.marca} ${m.hp}HP`;
  const desc = `Modelo: ${m.modelo}, Serie: ${m.serie}`;
  values.push(`  ('${code}', '${name}', '${desc}', 'herramienta', 'pieza', 1, 0, ${m.precio}, 'equipos_aforo', 'normal', true)`);
}

index = 1;
for (let p of pumps) {
  const code = `AFO-BOM-${String(index++).padStart(3, '0')}`;
  const name = `Bomba ${p.marca} ${p.hp}HP`;
  const desc = `Modelo: ${p.modelo}, Serie: ${p.serie}`;
  values.push(`  ('${code}', '${name}', '${desc}', 'herramienta', 'pieza', 1, 0, ${p.precio}, 'equipos_aforo', 'normal', true)`);
}

index = 1;
for (let c of clientPumps) {
  const code = `AFO-BOMC-${String(index++).padStart(3, '0')}`;
  const name = `Bomba Cliente ${c.marca} ${c.hp}HP`;
  const desc = `Modelo: ${c.modelo}, Serie: ${c.serie}`;
  values.push(`  ('${code}', '${name}', '${desc}', 'herramienta', 'pieza', 1, 0, ${c.precio}, 'equipos_aforo', 'normal', true)`);
}

sql += values.join(',\n') + ';\n';

fs.writeFileSync('migration.sql', sql);
console.log('Migration generated.');
