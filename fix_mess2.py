import re
with open('src/pages/Repairs/RepairsDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_client = r'''                <span className="truncate">
                    {isWarehouse ? <span className="text-orange-500 font-medium">Bodega Núcleo</span> : (r.external_client_name || r.client?.company_name || "-")}
                </span>'''

new_client = r'''                <div className="truncate flex flex-col gap-0.5">
                    <span>{isWarehouse ? <span className="text-orange-500 font-medium">Bodega Núcleo</span> : (r.external_client_name || r.client?.company_name || "—")}</span>
                    {r.client?.phone && <span className="text-[9px] text-slate-400 flex items-center gap-1"><span className="material-symbols-outlined text-[10px]">phone</span>{r.client.phone}</span>}
                    {r.client?.email && <span className="text-[9px] text-slate-400 flex items-center gap-1"><span className="material-symbols-outlined text-[10px]">mail</span>{r.client.email}</span>}
                </div>'''

content = content.replace(old_client, new_client)

with open('src/pages/Repairs/RepairsDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
