const fs = require('fs');
const file = 'src/pages/Fleet/VehicleDetail/VehicleDetail.tsx';
let txt = fs.readFileSync(file, 'utf8');

// Replace new Date(variable).toLocaleDateString...
// We only want to replace instances where a variable like m.date, ins.start_date, etc. is passed, not empty ones or strings.
txt = txt.replace(/new Date\((m\.date|log\.date|m\.service_date|ins\.start_date|ins\.end_date|vehicle\.verification_date|vehicle\.insurance_expiry)\)\.toLocaleDateString/g, 
  "new Date($1 + 'T12:00:00').toLocaleDateString");

fs.writeFileSync(file, txt);
console.log('Fixed dates');
