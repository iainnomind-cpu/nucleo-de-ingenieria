import re

with open('src/pages/Repairs/RepairsDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the mess
content = re.sub(r'\{isWarehouse \? <span className="text-orange-500 font-medium">Bodega N.*?\<\/span\>', '{isWarehouse ? <span className="text-orange-500 font-medium">Bodega Núcleo</span> : (r.external_client_name || r.client?.company_name || "—")}</span>', content, flags=re.DOTALL)

# Replace client rendering block
old_client = r'''            {/* Client + provider */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                <span className="truncate">
                    {isWarehouse ? <span className="text-orange-500 font-medium">Bodega Núcleo</span> : (r.external_client_name || r.client?.company_name || '—')}
                </span>'''

new_client = r'''            {/* Client + provider */}
            <div className="flex items-start justify-between text-[10px] text-slate-400 mb-1">
                <div className="truncate flex flex-col gap-0.5">
                    <span>{isWarehouse ? <span className="text-orange-500 font-medium">Bodega Núcleo</span> : (r.external_client_name || r.client?.company_name || '—')}</span>
                    {r.client?.phone && <span className="text-[9px] text-slate-400 flex items-center gap-1"><span className="material-symbols-outlined text-[10px]">phone</span>{r.client.phone}</span>}
                    {r.client?.email && <span className="text-[9px] text-slate-400 flex items-center gap-1"><span className="material-symbols-outlined text-[10px]">mail</span>{r.client.email}</span>}
                </div>'''

content = content.replace(old_client, new_client)

tracking_end = r'''{r.tracking_number_to && <span className="font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">{r.tracking_number_to}</span>}
                </div>
            )}'''

action_buttons = r'''{r.tracking_number_to && <span className="font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">{r.tracking_number_to}</span>}
                </div>
            )}

            {/* Actions */}
            {r.client?.phone && r.status === 'pending_approval' && (
              <a href={`https://wa.me/${r.client.phone.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(r.client.company_name || '')}.%20Su%20equipo%20sigue%20en%20nuestro%20taller.%20%C2%BFNos%20confirma%20si%20se%20va%20a%20reparar?`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="mt-2 flex items-center justify-center gap-1 w-full rounded-md bg-amber-50 px-2 py-1.5 text-[10px] font-bold text-amber-600 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400">
                <span className="material-symbols-outlined text-[14px]">chat</span> Recordatorio 15 días
              </a>
            )}
            {r.client?.phone && (r.status === 'ready_for_pickup' || r.status === 'completed') && (
              <a href={`https://wa.me/${r.client.phone.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(r.client.company_name || '')}.%20Su%20equipo%20ya%20est%C3%A1%20listo.%20Le%20recordamos%20que%20si%20no%20pasa%20por%20%C3%A9l%20en%20los%20pr%C3%B3ximos%20d%C3%ADas%2C%20se%20tendr%C3%A1%20que%20desechar.`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="mt-2 flex items-center justify-center gap-1 w-full rounded-md bg-red-50 px-2 py-1.5 text-[10px] font-bold text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400">
                <span className="material-symbols-outlined text-[14px]">warning</span> Aviso Recoger/Desechar
              </a>
            )}'''

content = content.replace(tracking_end, action_buttons)

with open('src/pages/Repairs/RepairsDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
