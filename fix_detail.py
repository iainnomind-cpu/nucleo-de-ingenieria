import re
import sys

def update_detail():
    with open("src/pages/Repairs/RepairDetail.tsx", "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Update fetch
    content = content.replace(
        "client:clients(id, company_name)",
        "client:clients(id, company_name, phone, email)"
    )

    # 2. Add state for shippingPhotos
    content = content.replace(
        "const [deliveryPhotos, setDeliveryPhotos] = useState<PhotoAttachment[]>([]);",
        "const [deliveryPhotos, setDeliveryPhotos] = useState<PhotoAttachment[]>([]);\n    const [shippingPhotos, setShippingPhotos] = useState<PhotoAttachment[]>([]);"
    )

    # 3. Load photos
    content = content.replace(
        "setDeliveryPhotos((repairData.delivery_photos as PhotoAttachment[]) || []);",
        "setDeliveryPhotos((repairData.delivery_photos as PhotoAttachment[]) || []);\n        setShippingPhotos((repairData.shipping_guide_photos as PhotoAttachment[]) || []);"
    )

    # 4. Save photos
    content = content.replace(
        "if (section === 'external') { finalData = { ...finalData, external_provider: editData.external_provider || null, shipping_carrier_to: editData.shipping_carrier_to || null, tracking_number_to: editData.tracking_number_to || null }; }",
        "if (section === 'external') { finalData = { ...finalData, external_provider: editData.external_provider || null, shipping_carrier_to: editData.shipping_carrier_to || null, tracking_number_to: editData.tracking_number_to || null, shipping_guide_photos: shippingPhotos }; }"
    )

    # 5. UI elements for external section view
    provider_ui = """                                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                    <div><span className="block text-xs text-slate-400 mb-0.5">Paquetería Envío</span><span className="font-semibold text-slate-900">{repair.shipping_carrier_to || '—'}</span></div>
                                    <div><span className="block text-xs text-slate-400 mb-0.5">No. Guía / Rastreo</span><span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{repair.tracking_number_to || '—'}</span></div>
                                </div>"""

    new_provider_ui = provider_ui + """
                                {repair.shipping_guide_photos && repair.shipping_guide_photos.length > 0 && (
                                    <div className="mt-4">
                                        <p className="text-xs text-slate-500 mb-2 font-semibold">GUÍA DE PAQUETERÍA</p>
                                        <PhotoGallery photos={repair.shipping_guide_photos} />
                                    </div>
                                )}"""

    content = content.replace(provider_ui, new_provider_ui)

    # 6. UI elements for external section edit
    external_edit_ui = """                                    <div><label className="mb-1 block text-xs font-semibold text-slate-500 uppercase">Número Guía / Rastreo</label><input value={editData.tracking_number_to || ''} onChange={e => setEditData({ ...editData, tracking_number_to: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></div>
                                </div>
                            </div>
                        ) : ("""

    new_external_edit_ui = """                                    <div><label className="mb-1 block text-xs font-semibold text-slate-500 uppercase">Número Guía / Rastreo</label><input value={editData.tracking_number_to || ''} onChange={e => setEditData({ ...editData, tracking_number_to: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></div>
                                </div>
                                <div className="mt-4">
                                    <label className="mb-2 block text-xs font-semibold text-slate-500 uppercase">Imágenes de Guía de Paquetería</label>
                                    <PhotoUploader photos={shippingPhotos} onPhotosChange={setShippingPhotos} folder={`repairs/${repair.id}/shipping`} uploaderName="Sistema" />
                                </div>
                                {(() => {
                                    const ws = workshops.find(w => w.name === editData.external_provider);
                                    if (!ws?.contact_phone) return null;
                                    return (
                                        <a href={`https://wa.me/${ws.contact_phone.replace(r'\\D', '')}?text=Hola%20taller.%20Les%20acabamos%20de%20enviar%20un%20equipo.%20Guía:%20${editData.tracking_number_to || 'N/A'}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 transition-all">
                                            <span className="material-symbols-outlined text-[18px]">chat</span> Notificar al Taller (WhatsApp)
                                        </a>
                                    );
                                })()}
                            </div>
                        ) : ("""

    content = content.replace(external_edit_ui, new_external_edit_ui)

    # 7. Add client phone and email under the client name
    header_ui = """                            <p className="text-sm text-slate-500 mt-1">
                                {repair.external_client_name || repair.client?.company_name || 'Sin Cliente'} 
                                {repair.client?.company_name && ' · '}
                                {repair.external_equipment_name || repair.equipment?.well_name || repair.equipment?.name || 'Equipo externo'}
                            </p>"""

    new_header_ui = header_ui + """
                            {(repair.client?.phone || repair.client?.email) && (
                                <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                                    {repair.client.phone && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">phone</span> {repair.client.phone}</span>}
                                    {repair.client.email && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">mail</span> {repair.client.email}</span>}
                                </div>
                            )}"""
    content = content.replace(header_ui, new_header_ui)

    with open("src/pages/Repairs/RepairDetail.tsx", "w", encoding="utf-8") as f:
        f.write(content)

update_detail()
print("Detail updated successfully")
