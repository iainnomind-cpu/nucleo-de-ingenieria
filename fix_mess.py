import re
with open('src/pages/Repairs/RepairsDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace everything from {isWarehouse ? ... to the end of the line
content = re.sub(r'\{isWarehouse \? <span.*?r\.client\.email\}</span>', r'{isWarehouse ? <span className="text-orange-500 font-medium">Bodega Núcleo</span> : (r.external_client_name || r.client?.company_name || "—")}', content)

with open('src/pages/Repairs/RepairsDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
