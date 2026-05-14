const xlsx = require('xlsx');
const fs = require('fs');

const filePath = 'C:\\Users\\redi_\\Downloads\\Inventario BODEGA 2026.xlsx';
const workbook = xlsx.readFile(filePath);

const limpieza = xlsx.utils.sheet_to_json(workbook.Sheets['Materiales p. limpieza de pozos'], { header: 1 });
const aforos = xlsx.utils.sheet_to_json(workbook.Sheets['Equipos de Aforos'], { header: 1 });

fs.writeFileSync('output.json', JSON.stringify({
  limpieza: limpieza,
  aforos: aforos
}, null, 2));
