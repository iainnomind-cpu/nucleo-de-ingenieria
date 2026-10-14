path = r'c:\Users\redi_\Downloads\nucleo de ingeniería\project\src\pages\Repairs\RepairDetail.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# The actual bytes in the file use < > & as-is (the viewer just escaped them for display)
# Let's find the view fragment and append contact info after it
anchor = 'repair.failure_description}</p>'
idx = content.find(anchor)
if idx == -1:
    print("Anchor not found!")
    exit(1)

# Find the closing fragment tag </> after this point
frag_end_marker = '                            </>'
frag_end_idx = content.find(frag_end_marker, idx)
print(f"Found fragment end at: {frag_end_idx}")
print(repr(content[frag_end_idx - 10:frag_end_idx + 30]))

insert_point = frag_end_idx  # Insert before the closing </>

new_contact_block = """                                {/* Contacto del cliente para avisos */}
                                {(repair.client_phone || repair.client_email || repair.pickup_deadline_date) && (
                                    <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50/50 p-3 dark:border-sky-800/40 dark:bg-sky-900/10">
                                        <p className="text-[10px] font-bold uppercase text-sky-600 dark:text-sky-400 mb-2 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[12px]">contact_phone</span>
                                            Contacto para Avisos de Recogida
                                        </p>
                                        <div className="flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-300">
                                            {repair.client_phone && (
                                                <span className="flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[14px] text-green-500">phone</span>
                                                    <a href={`https://wa.me/${repair.client_phone.replace(/\\D/g,'')}`} target="_blank" rel="noreferrer" className="font-semibold text-green-600 hover:underline dark:text-green-400">{repair.client_phone}</a>
                                                </span>
                                            )}
                                            {repair.client_email && (
                                                <span className="flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[14px] text-sky-500">mail</span>
                                                    <a href={`mailto:${repair.client_email}`} className="font-semibold text-sky-600 hover:underline dark:text-sky-400">{repair.client_email}</a>
                                                </span>
                                            )}
                                            {repair.pickup_deadline_date && (
                                                <span className="flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[14px] text-red-500">event_busy</span>
                                                    <span>Recoger antes del: <strong className="text-red-600 dark:text-red-400">{new Date(repair.pickup_deadline_date + 'T12:00:00').toLocaleDateString('es-MX')}</strong></span>
                                                </span>
                                            )}
                                        </div>
                                        {/* Botones de aviso rápido */}
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {repair.client_phone && (
                                                <a href={`https://wa.me/${repair.client_phone.replace(/\\D/g,'')}?text=${encodeURIComponent(
                                                    `Hola ${repair.external_client_name || repair.client?.company_name || 'Cliente'}, le recordamos que su equipo "${repair.external_equipment_name || repair.equipment?.well_name || repair.equipment?.name || 'en reparación'}" se encuentra en nuestro taller Núcleo de Ingeniería.${repair.pickup_deadline_date ? ` Tiene hasta el ${new Date(repair.pickup_deadline_date + 'T12:00:00').toLocaleDateString('es-MX')} para recogerlo, de lo contrario será desechado.` : ' Le pedimos que pase a recogerlo a la brevedad.'}`
                                                )}`} target="_blank" rel="noreferrer"
                                                    className="flex items-center gap-1 rounded-lg bg-green-100 px-3 py-1.5 text-[11px] font-bold text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400">
                                                    <span className="material-symbols-outlined text-[14px]">chat</span>
                                                    Recordatorio WA
                                                </a>
                                            )}
                                            {repair.client_phone && (
                                                <a href={`https://wa.me/${repair.client_phone.replace(/\\D/g,'')}?text=${encodeURIComponent(
                                                    `Hola ${repair.external_client_name || repair.client?.company_name || 'Cliente'}, su equipo "${repair.external_equipment_name || repair.equipment?.well_name || repair.equipment?.name || 'en espera'}" lleva tiempo con nosotros esperando confirmación. ¿Desea que procedamos con la reparación o pasará a recogerlo?`
                                                )}`} target="_blank" rel="noreferrer"
                                                    className="flex items-center gap-1 rounded-lg bg-amber-100 px-3 py-1.5 text-[11px] font-bold text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400">
                                                    <span className="material-symbols-outlined text-[14px]">help</span>
                                                    ¿Se repara? (15 días)
                                                </a>
                                            )}
                                            {repair.client_email && (
                                                <a href={`mailto:${repair.client_email}?subject=${encodeURIComponent(`Equipo en taller: ${repair.external_equipment_name || repair.equipment?.well_name || repair.equipment?.name || ''}`)}&body=${encodeURIComponent(
                                                    `Estimado(a) ${repair.external_client_name || repair.client?.company_name || 'Cliente'},\n\nLe recordamos que su equipo se encuentra en nuestro taller Núcleo de Ingeniería.${repair.pickup_deadline_date ? `\n\nTiene hasta el ${new Date(repair.pickup_deadline_date + 'T12:00:00').toLocaleDateString('es-MX')} para recogerlo; de no hacerlo, el equipo será desechado.` : ''}\n\nCualquier duda, contáctenos.\n\nNúcleo de Ingeniería`
                                                )}`}
                                                    className="flex items-center gap-1 rounded-lg bg-sky-100 px-3 py-1.5 text-[11px] font-bold text-sky-700 hover:bg-sky-200 dark:bg-sky-900/30 dark:text-sky-400">
                                                    <span className="material-symbols-outlined text-[14px]">mail</span>
                                                    Enviar Correo
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}
"""

content = content[:insert_point] + new_contact_block + content[insert_point:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS: Contact info block added to RepairDetail view mode")
