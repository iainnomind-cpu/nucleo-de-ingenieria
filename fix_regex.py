import re
with open("src/pages/Repairs/RepairsDashboard.tsx", "r", encoding="utf-8") as f:
    content = f.read()
content = content.replace("replace(r'\\\\D', '')", "replace(/\\\\D/g, '')")
with open("src/pages/Repairs/RepairsDashboard.tsx", "w", encoding="utf-8") as f:
    f.write(content)

with open("src/pages/Repairs/RepairDetail.tsx", "r", encoding="utf-8") as f:
    content2 = f.read()
content2 = content2.replace("replace(r'\\\\D', '')", "replace(/\\\\D/g, '')")
with open("src/pages/Repairs/RepairDetail.tsx", "w", encoding="utf-8") as f:
    f.write(content2)
