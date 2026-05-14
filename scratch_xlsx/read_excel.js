const xlsx = require('xlsx');

const filePath = 'C:\\Users\\redi_\\Downloads\\Inventario BODEGA 2026.xlsx';
const workbook = xlsx.readFile(filePath);

console.log('Sheets:', workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`\n--- Sheet: ${sheetName} ---`);
  for (let i = 0; i < Math.min(5, data.length); i++) {
    console.log(data[i]);
  }
});
