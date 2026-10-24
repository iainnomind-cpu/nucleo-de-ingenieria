import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { PhotoGallery } from '../../components/PhotoUploader';
import { 
    EQUIPMENT_TYPE_ICONS, 
    EQUIPMENT_TYPE_LABELS 
} from '../../types/maintenance';

type PortalTab = 'equipos' | 'videos' | 'arranque' | 'instalaciones' | 'desinstalaciones' | 'cuadros' | 'aforos';

const COMPANY_SERVICES_TEXT = 'Equipamiento y rehabilitación de pozos profundos, instalaciones eléctricas en media tensión y baja tensión, mantenimiento hidráulico y eléctrico, asesoría de proyectos hidráulicos y eléctricos, aforos, videograbación de pozos, reparación de equipos de bombeo y variadores, maniobras.';

interface ClientFormatHeaderProps {
    title: string;
    folio?: string | null;
    date?: string | null;
    clientName?: string | null;
    location?: string | null;
    technician?: string | null;
    equipment?: string | null;
    onPrint?: () => void;
}

function ClientFormatHeader({
    title,
    folio,
    date,
    clientName,
    location,
    technician,
    equipment,
    onPrint,
}: ClientFormatHeaderProps) {
    return (
        <div className="mb-5 pb-2">
            {/* Encabezado: Logo + Empresa + Servicios */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3 sm:gap-4">
                    <img
                        src="/logo.png"
                        alt="Núcleo de Ingeniería"
                        className="h-12 w-12 sm:h-14 sm:w-14 object-contain flex-shrink-0"
                    />
                    <div>
                        <h2 className="text-xs sm:text-sm md:text-base font-extrabold uppercase tracking-wide text-sky-800">
                            NÚCLEO DE INGENIERÍA HIDRÁULICA Y ELÉCTRICA
                        </h2>
                        <p className="text-[8.5px] sm:text-[10px] text-slate-500 leading-tight max-w-2xl mt-0.5">
                            {COMPANY_SERVICES_TEXT}
                        </p>
                    </div>
                </div>

                {/* Formato y Folio */}
                <div className="flex md:flex-col items-end justify-between md:justify-center gap-1.5 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                    <div className="text-right">
                        <span className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide block">
                            {title}
                        </span>
                        {folio && (
                            <span className="inline-block mt-0.5 text-xs font-mono font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
                                {folio.startsWith('Folio:') ? folio : `Folio: ${folio}`}
                            </span>
                        )}
                    </div>
                    {onPrint && (
                        <button
                            type="button"
                            onClick={onPrint}
                            className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-sky-700 bg-slate-100 hover:bg-sky-50 px-2.5 py-1 rounded-md border border-slate-200 transition-colors">
                            <span className="material-symbols-outlined text-[14px]">print</span>
                            Imprimir / PDF
                        </button>
                    )}
                </div>
            </div>

            {/* Línea divisoria azul oficial */}
            <div className="h-[2.5px] w-full bg-sky-600 my-3 rounded-full" />

            {/* Fila de Metadatos: FECHA, CLIENTE, LUGAR / POZO, TÉCNICO */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 bg-slate-50/90 p-3 rounded-lg border border-slate-200/80 text-xs">
                <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">FECHA</span>
                    <span className="font-semibold text-slate-800 text-xs sm:text-sm">
                        {date || '—'}
                    </span>
                </div>
                <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">CLIENTE</span>
                    <span className="font-semibold text-slate-800 text-xs sm:text-sm truncate block" title={clientName || ''}>
                        {clientName || '—'}
                    </span>
                </div>
                <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">LUGAR / POZO</span>
                    <span className="font-semibold text-slate-800 text-xs sm:text-sm truncate block" title={location || ''}>
                        {location || '—'}
                    </span>
                </div>
                {(technician || equipment) && (
                    <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                            {technician ? 'TÉCNICO' : 'EQUIPO'}
                        </span>
                        <span className="font-semibold text-slate-800 text-xs sm:text-sm truncate block">
                            {technician || equipment}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ClientPortalPublic() {
    const { clientId } = useParams<{ clientId: string }>();
    
    const [client, setClient] = useState<any>(null);
    const [equipments, setEquipments] = useState<any[]>([]);
    const [videos, setVideos] = useState<any[]>([]);
    const [startups, setStartups] = useState<any[]>([]);
    const [installations, setInstallations] = useState<any[]>([]);
    const [uninstallations, setUninstallations] = useState<any[]>([]);
    const [panels, setPanels] = useState<any[]>([]);
    const [aforos, setAforos] = useState<any[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [tab, setTab] = useState<PortalTab>('equipos');

    const fetchData = useCallback(async () => {
        if (!clientId) return;
        setLoading(true);

        const { data: clientData } = await supabase
            .from('clients')
            .select('*')
            .eq('id', clientId)
            .single();

        if (!clientData) {
            setNotFound(true);
            setLoading(false);
            return;
        }
        setClient(clientData);

        const [eqRes, vRes, sRes, iRes, uRes, pRes, aRes] = await Promise.all([
            supabase.from('installed_equipment').select('*').eq('client_id', clientId).order('installation_date', { ascending: false }),
            supabase.from('video_recordings').select('*').eq('client_id', clientId).order('recording_date', { ascending: false }),
            supabase.from('startup_formats').select('*').eq('client_id', clientId).order('record_date', { ascending: false }),
            supabase.from('well_installations').select('*').eq('client_id', clientId).order('installation_date', { ascending: false }),
            supabase.from('well_uninstallations').select('*').eq('client_id', clientId).order('uninstallation_date', { ascending: false }),
            supabase.from('electric_panel_records').select('*').eq('client_id', clientId).order('record_date', { ascending: false }),
            supabase.from('aforo_records').select('*, measurements:aforo_measurements(*)').eq('client_id', clientId).order('created_at', { ascending: false }),
        ]);

        setEquipments(eqRes.data || []);
        setVideos(vRes.data || []);
        setStartups(sRes.data || []);
        setInstallations(iRes.data || []);
        setUninstallations(uRes.data || []);
        setPanels(pRes.data || []);
        setAforos(aRes.data || []);
        
        if (eqRes.data?.length) setTab('equipos');
        else if (vRes.data?.length) setTab('videos');
        else if (sRes.data?.length) setTab('arranque');
        else if (iRes.data?.length) setTab('instalaciones');
        else if (uRes.data?.length) setTab('desinstalaciones');
        else if (pRes.data?.length) setTab('cuadros');
        else if (aRes.data?.length) setTab('aforos');

        setLoading(false);
    }, [clientId]);

    useEffect(() => { fetchData(); }, [fetchData]);
    const openPrintWindow = (title: string, folio: string, date: string, loc: string, bodyContent: string) => {
        const pw = window.open('', '_blank');
        if (!pw) return;
        pw.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${title} ${folio || ''}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #111; padding: 20px; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #0066cc; padding-bottom: 10px; margin-bottom: 14px; }
  .company { font-weight: bold; font-size: 13px; color: #0066cc; }
  .services { font-size: 7.5px; color: #555; max-width: 340px; line-height: 1.25; margin-top: 2px; }
  .folio { font-size: 16px; font-weight: bold; color: #0066cc; }
  .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; padding: 8px; background: #f8fafc; border: 1px solid #e2e8f0; }
  .meta-field { font-size: 10px; }
  .meta-label { font-weight: bold; font-size: 8.5px; color: #64748b; text-transform: uppercase; }
  .section-title { font-size: 11px; font-weight: bold; background: #e2e8f0; padding: 4px 8px; margin: 12px 0 6px; text-transform: uppercase; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .field { border-bottom: 1px solid #e2e8f0; padding: 4px 0; }
  .field-label { font-size: 8.5px; color: #64748b; font-weight: bold; text-transform: uppercase; }
  .field-value { font-size: 10px; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 6px; }
  th, td { border: 1px solid #cbd5e1; padding: 5px; text-align: center; }
  th { background: #f1f5f9; font-weight: bold; }
  .obs { background: #fffbeb; border: 1px solid #fef3c7; padding: 8px; border-radius: 4px; margin-top: 10px; font-size: 9.5px; }
  .photos { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .photos img { width: 110px; height: 80px; object-fit: cover; border-radius: 4px; border: 1px solid #cbd5e1; }
  .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center; margin-top: 35px; }
  .sig-line { border-top: 1px solid #000; padding-top: 4px; font-size: 9px; font-weight: bold; }
  @media print { body { padding: 15px; } }
</style>
</head><body>
  <div class="header">
    <div style="display:flex;align-items:center;gap:12px">
      <img src="${window.location.origin}/logo.png" style="height:48px;" />
      <div>
        <div class="company">NÚCLEO DE INGENIERÍA HIDRÁULICA Y ELÉCTRICA</div>
        <div class="services">${COMPANY_SERVICES_TEXT}</div>
      </div>
    </div>
    <div style="text-align:right">
      <div class="folio">${folio || ''}</div>
      <div style="font-size:10px;color:#333;font-weight:bold;">${title}</div>
      <div style="font-size:11px;font-weight:bold;color:#1e293b;">${client?.company_name || ''}</div>
      <div style="font-size:10px;color:#64748b;">${date || ''}</div>
    </div>
  </div>
  <div class="meta-grid">
    <div class="meta-field"><div class="meta-label">FECHA</div><div>${date || '—'}</div></div>
    <div class="meta-field"><div class="meta-label">CLIENTE</div><div>${client?.company_name || '—'}</div></div>
    <div class="meta-field"><div class="meta-label">LUGAR / POZO</div><div>${loc || '—'}</div></div>
  </div>
  ${bodyContent}
</body></html>`);
        pw.document.close();
        pw.focus();
        setTimeout(() => pw.print(), 500);
    };

    const handlePrintStartup = (s: any) => {
        let measurementsHtml = '';
        const rows = [
            { h: s.time_logged, v1: s.volts_l1, v2: s.volts_l2, v3: s.volts_l3, a1: s.amp_l1, a2: s.amp_l2, a3: s.amp_l3, q: s.flow_rate, nd: s.dynamic_level, pd: s.discharge_pressure, pv: s.avg_volts, pa: s.avg_amps, d: s.unbalance_percentage },
            { h: s.time_logged_2, v1: s.volts_l1_2, v2: s.volts_l2_2, v3: s.volts_l3_2, a1: s.amp_l1_2, a2: s.amp_l2_2, a3: s.amp_l3_2, q: s.flow_rate_2, nd: s.dynamic_level_2, pd: s.discharge_pressure_2, pv: s.avg_volts_2, pa: s.avg_amps_2, d: s.unbalance_percentage_2 },
            { h: s.time_logged_3, v1: s.volts_l1_3, v2: s.volts_l2_3, v3: s.volts_l3_3, a1: s.amp_l1_3, a2: s.amp_l2_3, a3: s.amp_l3_3, q: s.flow_rate_3, nd: s.dynamic_level_3, pd: s.discharge_pressure_3, pv: s.avg_volts_3, pa: s.avg_amps_3, d: s.unbalance_percentage_3 },
        ].filter(r => r.h);

        if (rows.length > 0) {
            measurementsHtml = `
            <div class="section-title">Tabla de Mediciones</div>
            <table>
              <thead><tr><th>Hora</th><th>V L1-L2</th><th>V L2-L3</th><th>V L1-L3</th><th>A L1</th><th>A L2</th><th>A L3</th><th>Caudal</th><th>N.D.</th><th>P.D.</th><th>Prom.V</th><th>Prom.A</th><th>% Desb.</th></tr></thead>
              <tbody>
                ${rows.map(r => `<tr><td>${r.h}</td><td>${r.v1||'-'}</td><td>${r.v2||'-'}</td><td>${r.v3||'-'}</td><td>${r.a1||'-'}</td><td>${r.a2||'-'}</td><td>${r.a3||'-'}</td><td>${r.q||'-'}</td><td>${r.nd||'-'}</td><td>${r.pd||'-'}</td><td>${r.pv||'-'}</td><td>${r.pa||'-'}</td><td>${r.d||'-'}%</td></tr>`).join('')}
              </tbody>
            </table>`;
        }

        const body = `
          ${measurementsHtml}
          <div class="section-title">Parámetros Eléctricos y Datos del Motor</div>
          <div class="grid-2">
            <div>
              <div class="field"><div class="field-label">Bajo Voltaje</div><div class="field-value">${s.low_voltage ? s.low_voltage + ' V' : '-'}</div></div>
              <div class="field"><div class="field-label">Alto Voltaje</div><div class="field-value">${s.high_voltage ? s.high_voltage + ' V' : '-'}</div></div>
              <div class="field"><div class="field-label">Sobre Carga</div><div class="field-value">${s.overload_amps ? s.overload_amps + ' A' : '-'}</div></div>
              <div class="field"><div class="field-label">Baja Carga</div><div class="field-value">${s.underload_amps ? s.underload_amps + ' A' : '-'}</div></div>
              <div class="field"><div class="field-label">Desbalance de Fases</div><div class="field-value">${s.phase_unbalance ? s.phase_unbalance + ' %' : '-'}</div></div>
            </div>
            <div>
              <div class="field"><div class="field-label">Potencia Motor</div><div class="field-value">${s.motor_power_hp ? s.motor_power_hp + ' HP' : '-'}</div></div>
              <div class="field"><div class="field-label">Voltaje Alimentación</div><div class="field-value">${s.motor_feed_volts ? s.motor_feed_volts + ' V' : '-'}</div></div>
              <div class="field"><div class="field-label">Frecuencia</div><div class="field-value">${s.motor_frequency_hz ? s.motor_frequency_hz + ' Hz' : '-'}</div></div>
              <div class="field"><div class="field-label">Amp. Nominal</div><div class="field-value">${s.motor_nominal_amps ? s.motor_nominal_amps + ' A' : '-'}</div></div>
              <div class="field"><div class="field-label">Protección</div><div class="field-value">${s.motor_protection || '-'}</div></div>
            </div>
          </div>
          ${s.recommendations ? `<div class="obs"><strong>Observaciones y Recomendaciones:</strong><br/>${s.recommendations.replace(/\n/g, '<br/>')}</div>` : ''}
          ${s.photos && s.photos.length > 0 ? `<div class="section-title">Fotografías</div><div class="photos">${s.photos.map((p: any) => `<img src="${p.url}"/>`).join('')}</div>` : ''}
          <div class="signatures">
            <div><div class="sig-line">RECIBIÓ<br/>${s.received_by || ''}</div></div>
            <div><div class="sig-line">REVISÓ<br/>${s.reviewed_by || s.technician || 'ING. JOEL RINCÓN'}</div></div>
            <div><div class="sig-line">AUTORIZÓ<br/>${s.authorized_by || ''}</div></div>
          </div>
        `;
        openPrintWindow('FORMATO DE ARRANQUE', s.folio, s.record_date, s.location, body);
    };

    const handlePrintInstallation = (i: any) => {
        const body = `
          <div class="section-title">Pozo y Tubería</div>
          <div class="grid-4">
            <div class="field"><div class="field-label">Diám. Ademe</div><div class="field-value">${i.ademe_diameter || '-'}</div></div>
            <div class="field"><div class="field-label">Material Ademe</div><div class="field-value">${i.ademe_material || '-'}</div></div>
            <div class="field"><div class="field-label">Diám. Tubería</div><div class="field-value">${i.pipe_diameter || '-'}</div></div>
            <div class="field"><div class="field-label">Long. Tubería</div><div class="field-value">${i.pipe_length || '-'}</div></div>
            <div class="field"><div class="field-label">No. Tramos</div><div class="field-value">${i.pipe_segments || '-'}</div></div>
            <div class="field"><div class="field-label">Válvula Check</div><div class="field-value">${i.valv_check || '-'}</div></div>
            <div class="field"><div class="field-label">Calibre Cable</div><div class="field-value">${i.cable_gauge || '-'}</div></div>
            <div class="field"><div class="field-label">Motor / HP</div><div class="field-value">${i.motor_hp || '-'}</div></div>
            <div class="field"><div class="field-label">Modelo Bomba</div><div class="field-value">${i.pump_model || '-'}</div></div>
            <div class="field"><div class="field-label">Sist. Arranque</div><div class="field-value">${i.starter_system || '-'}</div></div>
            <div class="field"><div class="field-label">Protección</div><div class="field-value">${i.protection_type || '-'}</div></div>
            <div class="field"><div class="field-label">Tierra Física</div><div class="field-value">${i.has_ground ? 'Sí' : 'No'} ${i.ground_location ? '(' + i.ground_location + ')' : ''}</div></div>
          </div>
          <div class="section-title">Niveles y Mediciones</div>
          <div class="grid-4">
            <div class="field"><div class="field-label">Nivel Estático</div><div class="field-value">${i.static_level ? i.static_level + ' m' : '-'}</div></div>
            <div class="field"><div class="field-label">Nivel Dinámico</div><div class="field-value">${i.dynamic_level ? i.dynamic_level + ' m' : '-'}</div></div>
            <div class="field"><div class="field-label">Gasto</div><div class="field-value">${i.flow_rate ? i.flow_rate + ' lps' : '-'}</div></div>
            <div class="field"><div class="field-label">Prof. Fondo</div><div class="field-value">${i.bottom_depth ? i.bottom_depth + ' m' : '-'}</div></div>
          </div>
          ${i.observations ? `<div class="obs"><strong>Observaciones:</strong><br/>${i.observations.replace(/\n/g, '<br/>')}</div>` : ''}
          ${i.photos && i.photos.length > 0 ? `<div class="section-title">Fotografías</div><div class="photos">${i.photos.map((p: any) => `<img src="${p.url}"/>`).join('')}</div>` : ''}
        `;
        openPrintWindow('MANIOBRA / INSTALACIÓN DE EQUIPO', i.folio, i.installation_date, i.location, body);
    };

    const handlePrintUninstallation = (u: any) => {
        const body = `
          <div class="obs" style="margin-top:0;margin-bottom:12px;"><strong>MOTIVO DE DESINSTALACIÓN:</strong><br/>${u.reason || 'Arena en pozo'}</div>
          <div class="section-title">Pozo y Tubería</div>
          <div class="grid-3">
            <div class="field"><div class="field-label">DIÁMETRO ADEME</div><div class="field-value">${u.ademe_diameter || '-'}</div></div>
            <div class="field"><div class="field-label">MATERIAL ADEME</div><div class="field-value">${u.ademe_material || 'Acero'}</div></div>
            <div class="field"><div class="field-label">DIÁMETRO TUBERÍA</div><div class="field-value">${u.pipe_diameter || '-'}</div></div>
            <div class="field"><div class="field-label">LONG. TUBERÍA</div><div class="field-value">${u.pipe_length || '-'}</div></div>
            <div class="field"><div class="field-label">NO. TRAMOS</div><div class="field-value">${u.pipe_segments || '-'}</div></div>
            <div class="field"><div class="field-label">NO. VALV. CHECK</div><div class="field-value">${u.valv_check || '-'}</div></div>
            <div class="field"><div class="field-label">FONDO (M)</div><div class="field-value">${u.bottom_depth || '-'}</div></div>
            <div class="field"><div class="field-label">NIVEL ESTÁTICO</div><div class="field-value">${u.static_level ? u.static_level + ' m' : '-'}</div></div>
            <div class="field"><div class="field-label">NIVEL DINÁMICO</div><div class="field-value">${u.dynamic_level ? u.dynamic_level + ' m' : '-'}</div></div>
          </div>
          <div class="section-title">Datos Eléctricos y Motor</div>
          <div class="grid-3">
            <div class="field"><div class="field-label">CALIBRE CABLE</div><div class="field-value">${u.cable_gauge || '-'}</div></div>
            <div class="field"><div class="field-label">MODELO BOMBA</div><div class="field-value">${u.pump_model || '-'}</div></div>
            <div class="field"><div class="field-label">MOTOR / HP</div><div class="field-value">${u.motor_hp || '-'}</div></div>
            <div class="field"><div class="field-label">TIPO DE EQUIPO</div><div class="field-value">${u.equipment_type || '-'}</div></div>
            <div class="field"><div class="field-label">TÉCNICO RESPONSABLE</div><div class="field-value">${u.technician || '-'}</div></div>
          </div>
          ${u.observations ? `<div class="obs"><strong>Observaciones:</strong><br/>${u.observations.replace(/\n/g, '<br/>')}</div>` : ''}
          ${u.photos && u.photos.length > 0 ? `<div class="section-title">Fotografías</div><div class="photos">${u.photos.map((p: any) => `<img src="${p.url}"/>`).join('')}</div>` : ''}
        `;
        openPrintWindow('DESINSTALACIÓN DE EQUIPO', u.folio, u.uninstallation_date, u.location, body);
    };

    const handlePrintPanel = (p: any) => {
        const body = `
          <div class="section-title">Transformador</div>
          <div class="grid-3">
            <div class="field"><div class="field-label">Capacidad</div><div class="field-value">${p.trans_capacity || '-'}</div></div>
            <div class="field"><div class="field-label">Marca</div><div class="field-value">${p.trans_brand || '-'}</div></div>
            <div class="field"><div class="field-label">Voltaje Primario</div><div class="field-value">${p.trans_primary_voltage ? p.trans_primary_voltage + ' V' : '-'}</div></div>
            <div class="field"><div class="field-label">Voltaje Secundario</div><div class="field-value">${p.trans_secondary_voltage ? p.trans_secondary_voltage + ' V' : '-'}</div></div>
            <div class="field"><div class="field-label">Fases</div><div class="field-value">${p.trans_phases || '-'}</div></div>
          </div>
          <div class="section-title">Arrancador</div>
          <div class="grid-3">
            <div class="field"><div class="field-label">Voltaje</div><div class="field-value">${p.arr_voltage ? p.arr_voltage + ' V' : '-'}</div></div>
            <div class="field"><div class="field-label">Gabinete</div><div class="field-value">${p.arr_cabinet_type || '-'}</div></div>
            <div class="field"><div class="field-label">Marca</div><div class="field-value">${p.arr_brand || '-'}</div></div>
            <div class="field"><div class="field-label">Modelo</div><div class="field-value">${p.arr_model || '-'}</div></div>
            <div class="field"><div class="field-label">HP</div><div class="field-value">${p.arr_hp || '-'}</div></div>
          </div>
          <div class="section-title">Motor</div>
          <div class="grid-3">
            <div class="field"><div class="field-label">HP</div><div class="field-value">${p.motor_hp || '-'}</div></div>
            <div class="field"><div class="field-label">Voltaje</div><div class="field-value">${p.motor_voltage ? p.motor_voltage + ' V' : '-'}</div></div>
            <div class="field"><div class="field-label">Marca</div><div class="field-value">${p.motor_brand || '-'}</div></div>
            <div class="field"><div class="field-label">Modelo</div><div class="field-value">${p.motor_model || '-'}</div></div>
            <div class="field"><div class="field-label">Amp. Nominal</div><div class="field-value">${p.motor_nom_amps ? p.motor_nom_amps + ' A' : '-'}</div></div>
          </div>
          ${p.observations ? `<div class="obs"><strong>Observaciones:</strong><br/>${p.observations.replace(/\n/g, '<br/>')}</div>` : ''}
          ${p.photos && p.photos.length > 0 ? `<div class="section-title">Fotografías</div><div class="photos">${p.photos.map((ph: any) => `<img src="${ph.url}"/>`).join('')}</div>` : ''}
        `;
        openPrintWindow('CUADRO ELÉCTRICO', p.folio, p.record_date, p.location || p.well_name, body);
    };

    const handlePrintAforo = (a: any) => {
        let rowsHtml = '';
        if (a.measurements && a.measurements.length > 0) {
            const sorted = [...a.measurements].sort((x: any, y: any) => (x.row_index || 0) - (y.row_index || 0));
            rowsHtml = `
            <div class="section-title">Lecturas de Aforo</div>
            <table>
              <thead><tr><th>Día</th><th>Hora</th><th>N.D. (m)</th><th>Caudal (LPS)</th></tr></thead>
              <tbody>
                ${sorted.map(m => `<tr><td>${m.day_label || '-'}</td><td>${m.hour_label || '-'}</td><td>${m.dynamic_level || '-'}</td><td>${m.flow_lps || '-'}</td></tr>`).join('')}
              </tbody>
            </table>`;
        }
        const body = `
          <div class="grid-2">
            <div class="field"><div class="field-label">Duración Aforo</div><div class="field-value">${a.duration_hours || '-'} Horas</div></div>
            <div class="field"><div class="field-label">Técnico</div><div class="field-value">${a.technician || '-'}</div></div>
          </div>
          ${rowsHtml}
        `;
        openPrintWindow(`AFORO DE POZO (${a.duration_hours || ''}H)`, a.folio, a.created_at ? new Date(a.created_at).toLocaleDateString() : '', a.location, body);
    };

    const handlePrintVideo = (v: any) => {
        const body = `
          <div class="section-title">Datos del Pozo</div>
          <div class="grid-4">
            <div class="field"><div class="field-label">N. Estático</div><div class="field-value">${v.static_level ? v.static_level + ' m' : '-'}</div></div>
            <div class="field"><div class="field-label">Prof. Fondo</div><div class="field-value">${v.bottom_depth ? v.bottom_depth + ' m' : '-'}</div></div>
            <div class="field"><div class="field-label">Material Ademe</div><div class="field-value">${v.ademe_material || '-'}</div></div>
            <div class="field"><div class="field-label">Diám. Ademe</div><div class="field-value">${v.ademe_diameter || '-'}</div></div>
          </div>
          ${v.casing_observations ? `<div class="obs"><strong>Observaciones de Ademe:</strong><br/>${v.casing_observations.replace(/\n/g, '<br/>')}</div>` : ''}
          ${v.photos && v.photos.length > 0 ? `<div class="section-title">Capturas de Video</div><div class="photos">${v.photos.map((ph: any) => `<img src="${ph.url}"/>`).join('')}</div>` : ''}
        `;
        openPrintWindow('VIDEOGRABACIÓN DE POZO PROFUNDO', v.folio, v.recording_date, v.well_name || v.location, body);
    };


    if (notFound) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-sky-50 p-4">
                <div className="max-w-md text-center">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
                        <span className="material-symbols-outlined text-red-500 text-[40px]">link_off</span>
                    </div>
                    <h1 className="text-xl font-bold text-slate-900">Enlace no válido</h1>
                    <p className="mt-2 text-sm text-slate-500">Este portal de cliente no es válido o ha sido desactivado.</p>
                </div>
            </div>
        );
    }

    if (loading || !client) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-sky-50">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
                    <p className="text-sm text-slate-500">Cargando portal del cliente...</p>
                </div>
            </div>
        );
    }

    const TABS: { key: PortalTab; icon: string; label: string; count: number }[] = [
        { key: 'equipos', icon: 'precision_manufacturing', label: 'Mis Equipos', count: equipments.length },
        { key: 'videos', icon: 'videocam', label: 'Videograbaciones', count: videos.length },
        { key: 'arranque', icon: 'power', label: 'Arranques', count: startups.length },
        { key: 'instalaciones', icon: 'build', label: 'Instalaciones', count: installations.length },
        { key: 'desinstalaciones', icon: 'settings_backup_restore', label: 'Desinstalaciones', count: uninstallations.length },
        { key: 'cuadros', icon: 'electrical_services', label: 'Cuadros Eléctricos', count: panels.length },
        { key: 'aforos', icon: 'water_drop', label: 'Aforos', count: aforos.length },
    ].filter(t => t.count > 0);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/30 to-white pb-20">
            {/* Header */}
            <header className="border-b border-slate-200/60 bg-white/90 backdrop-blur-lg sticky top-0 z-10 shadow-sm">
                <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="Núcleo de Ingeniería" className="h-11 w-11 object-contain" />
                        <div className="border-l border-slate-200 pl-3">
                            <h1 className="text-xs sm:text-sm font-extrabold text-sky-800 tracking-wide uppercase">
                                NÚCLEO DE INGENIERÍA HIDRÁULICA Y ELÉCTRICA
                            </h1>
                            <p className="text-[9px] sm:text-[10px] text-slate-500 line-clamp-1 max-w-lg hidden md:block">
                                {COMPANY_SERVICES_TEXT}
                            </p>
                            <p className="text-[10px] text-sky-600 font-semibold md:hidden">Portal del Cliente</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <h2 className="text-xs sm:text-sm font-bold text-slate-900">{client.company_name}</h2>
                        <p className="text-[10px] sm:text-[11px] text-slate-400">Portal Oficial</p>
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-5xl px-4 py-8">
                {/* Tabs Selector */}
                {TABS.length > 0 ? (
                    <div className="mb-6 flex overflow-x-auto pb-2 scrollbar-hide gap-2">
                        {TABS.map(t => (
                            <button key={t.key} onClick={() => setTab(t.key)}
                                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all whitespace-nowrap ${
                                    tab === t.key ? 'bg-sky-500 text-white shadow-md shadow-sky-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}>
                                <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                                {t.label}
                                <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] ${
                                    tab === t.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                                }`}>{t.count}</span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                        <span className="material-symbols-outlined text-slate-300 text-[40px] mb-3">inbox</span>
                        <h3 className="text-sm font-bold text-slate-700">Sin registros</h3>
                        <p className="text-xs text-slate-500 mt-1">Aún no hay equipos ni formatos de mantenimiento registrados para este cliente.</p>
                    </div>
                )}

                {/* TAB CONTENT: Equipos */}
                {tab === 'equipos' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-500">
                        {equipments.map(eq => (
                            <div key={eq.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                                    <span className="material-symbols-outlined text-[24px]">{EQUIPMENT_TYPE_ICONS[eq.equipment_type as keyof typeof EQUIPMENT_TYPE_ICONS] || 'precision_manufacturing'}</span>
                                </div>
                                <h3 className="font-bold text-slate-900">{eq.name}</h3>
                                <p className="text-xs font-semibold text-sky-600 mb-3">{EQUIPMENT_TYPE_LABELS[eq.equipment_type as keyof typeof EQUIPMENT_TYPE_LABELS]}</p>
                                <div className="space-y-2 text-xs text-slate-600">
                                    {eq.well_name && <p><span className="text-slate-400 w-16 inline-block">Pozo:</span> {eq.well_name}</p>}
                                    {eq.brand && <p><span className="text-slate-400 w-16 inline-block">Marca:</span> {eq.brand}</p>}
                                    {eq.location && <p><span className="text-slate-400 w-16 inline-block">Lugar:</span> {eq.location}</p>}
                                </div>
                                {eq.access_token && (
                                    <a href={`/well-log/${eq.access_token}`} target="_blank" rel="noreferrer" className="mt-4 block text-center rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-bold text-sky-600 hover:bg-sky-50">
                                        Ver Bitácora del Equipo
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* TAB CONTENT: Videograbaciones */}
                {tab === 'videos' && (
                    <div className="space-y-4 animate-in fade-in duration-500">
                        {videos.map(v => (
                            <div key={v.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                <ClientFormatHeader
                                    title="VIDEOGRABACIÓN DE POZO PROFUNDO"
                                    folio={v.folio}
                                    date={v.recording_date}
                                    clientName={client.company_name}
                                    location={v.well_name || v.location || client.address}
                                    technician={v.technician}
                                    onPrint={() => handlePrintVideo(v)}
                                />
                                {v.video_url && (
                                    <div className="mb-4 flex justify-end">
                                        <a href={v.video_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 border border-purple-200">
                                            <span className="material-symbols-outlined text-[16px]">play_circle</span> Ver Video de la Grabación
                                        </a>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4 bg-slate-50 p-3 rounded-lg">
                                    <div><span className="block text-xs text-slate-400">N. Estático</span><span className="font-medium">{v.static_level || '-'} m</span></div>
                                    <div><span className="block text-xs text-slate-400">Prof. Fondo</span><span className="font-medium">{v.bottom_depth || '-'} m</span></div>
                                    <div><span className="block text-xs text-slate-400">Ademe</span><span className="font-medium">{v.ademe_material || '-'}</span></div>
                                    <div><span className="block text-xs text-slate-400">Diám. Ademe</span><span className="font-medium">{v.ademe_diameter || '-'}</span></div>
                                </div>
                                {v.casing_observations && (
                                    <div className="text-sm text-slate-700 bg-yellow-50 p-3 rounded-lg border border-yellow-100 mb-4">
                                        <strong>Observaciones:</strong> {v.casing_observations}
                                    </div>
                                )}
                                {v.photos && v.photos.length > 0 && (
                                    <div className="mt-4"><PhotoGallery photos={v.photos} /></div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* TAB CONTENT: Arranques */}
                {tab === 'arranque' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        {startups.map(s => (
                            <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                <ClientFormatHeader
                                    title="FORMATO DE ARRANQUE"
                                    folio={s.folio}
                                    date={s.record_date}
                                    clientName={client.company_name}
                                    location={s.location || client.address}
                                    technician={s.technician}
                                    equipment={s.equipment}
                                    onPrint={() => handlePrintStartup(s)}
                                />

                                {/* Tabla de mediciones */}
                                {(s.time_logged || s.time_logged_2 || s.time_logged_3) && (
                                    <div className="mb-4">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Tabla de Mediciones</h4>
                                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                                            <table className="w-full text-xs text-center">
                                                <thead className="bg-slate-50 text-slate-500">
                                                    <tr>
                                                        <th className="px-2 py-2 border-b border-slate-200">Hora</th>
                                                        <th className="px-2 py-2 border-b border-slate-200">V L1-L2</th>
                                                        <th className="px-2 py-2 border-b border-slate-200">V L2-L3</th>
                                                        <th className="px-2 py-2 border-b border-slate-200">V L1-L3</th>
                                                        <th className="px-2 py-2 border-b border-slate-200">A L1</th>
                                                        <th className="px-2 py-2 border-b border-slate-200">A L2</th>
                                                        <th className="px-2 py-2 border-b border-slate-200">A L3</th>
                                                        <th className="px-2 py-2 border-b border-slate-200">Caudal</th>
                                                        <th className="px-2 py-2 border-b border-slate-200">N.D.</th>
                                                        <th className="px-2 py-2 border-b border-slate-200">P.D.</th>
                                                        <th className="px-2 py-2 border-b border-slate-200">Prom.V</th>
                                                        <th className="px-2 py-2 border-b border-slate-200">Prom.A</th>
                                                        <th className="px-2 py-2 border-b border-slate-200">% Desb.</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {[
                                                        { h: s.time_logged, v1: s.volts_l1, v2: s.volts_l2, v3: s.volts_l3, a1: s.amp_l1, a2: s.amp_l2, a3: s.amp_l3, q: s.flow_rate, nd: s.dynamic_level, pd: s.discharge_pressure, pv: s.avg_volts, pa: s.avg_amps, d: s.unbalance_percentage },
                                                        { h: s.time_logged_2, v1: s.volts_l1_2, v2: s.volts_l2_2, v3: s.volts_l3_2, a1: s.amp_l1_2, a2: s.amp_l2_2, a3: s.amp_l3_2, q: s.flow_rate_2, nd: s.dynamic_level_2, pd: s.discharge_pressure_2, pv: s.avg_volts_2, pa: s.avg_amps_2, d: s.unbalance_percentage_2 },
                                                        { h: s.time_logged_3, v1: s.volts_l1_3, v2: s.volts_l2_3, v3: s.volts_l3_3, a1: s.amp_l1_3, a2: s.amp_l2_3, a3: s.amp_l3_3, q: s.flow_rate_3, nd: s.dynamic_level_3, pd: s.discharge_pressure_3, pv: s.avg_volts_3, pa: s.avg_amps_3, d: s.unbalance_percentage_3 },
                                                    ].filter(r => r.h).map((r, i) => (
                                                        <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                                            <td className="px-2 py-2 font-medium">{r.h || '-'}</td>
                                                            <td className="px-2 py-2">{r.v1 || '-'}</td>
                                                            <td className="px-2 py-2">{r.v2 || '-'}</td>
                                                            <td className="px-2 py-2">{r.v3 || '-'}</td>
                                                            <td className="px-2 py-2">{r.a1 || '-'}</td>
                                                            <td className="px-2 py-2">{r.a2 || '-'}</td>
                                                            <td className="px-2 py-2">{r.a3 || '-'}</td>
                                                            <td className="px-2 py-2">{r.q || '-'}</td>
                                                            <td className="px-2 py-2">{r.nd || '-'}</td>
                                                            <td className="px-2 py-2">{r.pd || '-'}</td>
                                                            <td className="px-2 py-2 font-semibold text-sky-700">{r.pv || '-'}</td>
                                                            <td className="px-2 py-2 font-semibold text-sky-700">{r.pa || '-'}</td>
                                                            <td className="px-2 py-2 font-semibold text-amber-600">{r.d || '-'}%</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Parámetros eléctricos + Datos Motor */}
                                {(s.low_voltage || s.high_voltage || s.overload_amps || s.motor_power_hp || s.motor_feed_volts) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        {(s.low_voltage || s.high_voltage || s.overload_amps || s.underload_amps || s.phase_unbalance) && (
                                            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Parámetros Eléctricos</h4>
                                                <div className="space-y-1 text-sm">
                                                    {s.low_voltage && <p><span className="text-slate-400">Bajo voltaje:</span> <span className="font-medium">{s.low_voltage} V</span></p>}
                                                    {s.high_voltage && <p><span className="text-slate-400">Alto voltaje:</span> <span className="font-medium">{s.high_voltage} V</span></p>}
                                                    {s.overload_amps && <p><span className="text-slate-400">Sobre carga:</span> <span className="font-medium">{s.overload_amps} A</span></p>}
                                                    {s.underload_amps && <p><span className="text-slate-400">Baja carga:</span> <span className="font-medium">{s.underload_amps} A</span></p>}
                                                    {s.phase_unbalance && <p><span className="text-slate-400">Desbalance de fases:</span> <span className="font-medium">{s.phase_unbalance} %</span></p>}
                                                </div>
                                            </div>
                                        )}
                                        {(s.motor_power_hp || s.motor_feed_volts || s.motor_frequency_hz || s.motor_nom_amps || s.motor_protection_type) && (
                                            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Datos del Motor</h4>
                                                <div className="space-y-1 text-sm">
                                                    {s.motor_power_hp && <p><span className="text-slate-400">Potencia:</span> <span className="font-medium">{s.motor_power_hp} Hp</span></p>}
                                                    {s.motor_feed_volts && <p><span className="text-slate-400">Alimentación:</span> <span className="font-medium">{s.motor_feed_volts} V</span></p>}
                                                    {s.motor_frequency_hz && <p><span className="text-slate-400">Frecuencia:</span> <span className="font-medium">{s.motor_frequency_hz} Hz</span></p>}
                                                    {s.motor_nom_amps && <p><span className="text-slate-400">Amp. Nominal:</span> <span className="font-medium">{s.motor_nom_amps} A</span></p>}
                                                    {s.motor_protection_type && <p><span className="text-slate-400">Protección:</span> <span className="font-medium">{s.motor_protection_type}</span></p>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Recomendaciones */}
                                {s.recommendations && (
                                    <div className="text-sm text-slate-700 mb-4 rounded-lg bg-amber-50 border border-amber-100 p-3">
                                        <strong className="text-amber-800">Observaciones y recomendaciones:</strong>
                                        <p className="mt-1 whitespace-pre-line">{s.recommendations}</p>
                                    </div>
                                )}

                                {/* Firmas */}
                                {(s.received_by || s.reviewed_by || s.authorized_by) && (
                                    <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
                                        <div><p className="font-semibold uppercase">Recibió</p><p className="mt-1 font-medium text-slate-700">{s.received_by || '—'}</p></div>
                                        <div><p className="font-semibold uppercase">Revisó</p><p className="mt-1 font-medium text-slate-700">{s.reviewed_by || '—'}</p></div>
                                        <div><p className="font-semibold uppercase">Autorizó</p><p className="mt-1 font-medium text-slate-700">{s.authorized_by || '—'}</p></div>
                                    </div>
                                )}

                                {s.photos && s.photos.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-slate-100"><PhotoGallery photos={s.photos} /></div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* TAB CONTENT: Instalaciones */}
                {tab === 'instalaciones' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        {installations.map(i => (
                            <div key={i.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                <ClientFormatHeader
                                    title="MANIOBRA / INSTALACIÓN DE EQUIPO"
                                    folio={i.folio}
                                    date={i.installation_date}
                                    clientName={client.company_name}
                                    location={i.location || client.address}
                                    technician={i.technician}
                                    equipment={i.pump_model || i.motor_hp}
                                    onPrint={() => handlePrintInstallation(i)}
                                />

                                {/* Pozo y Tubería */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                    {i.ademe_diameter && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Diám. Ademe</p><p className="font-semibold text-sm mt-0.5">{i.ademe_diameter}</p></div>}
                                    {i.ademe_material && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Material Ademe</p><p className="font-semibold text-sm mt-0.5">{i.ademe_material}</p></div>}
                                    {i.pipe_diameter && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Diám. Tubería</p><p className="font-semibold text-sm mt-0.5">{i.pipe_diameter}</p></div>}
                                    {i.pipe_length && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Long. Tubería</p><p className="font-semibold text-sm mt-0.5">{i.pipe_length}</p></div>}
                                    {i.pipe_segments ? <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Tramos</p><p className="font-semibold text-sm mt-0.5">{i.pipe_segments}</p></div> : null}
                                    {i.valv_check ? <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Válv. Check</p><p className="font-semibold text-sm mt-0.5">{i.valv_check}</p></div> : null}
                                    {i.cable_gauge && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Calibre Cable</p><p className="font-semibold text-sm mt-0.5">{i.cable_gauge}</p></div>}
                                    {i.motor_hp && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Motor / HP</p><p className="font-semibold text-sm mt-0.5">{i.motor_hp}</p></div>}
                                    {i.pump_model && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Modelo Bomba</p><p className="font-semibold text-sm mt-0.5">{i.pump_model}</p></div>}
                                    {i.starter_system && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Sist. Arranque</p><p className="font-semibold text-sm mt-0.5">{i.starter_system}</p></div>}
                                    {i.protection_type && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Protección</p><p className="font-semibold text-sm mt-0.5">{i.protection_type}</p></div>}
                                    {i.has_ground !== undefined && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Tierra Física</p><p className="font-semibold text-sm mt-0.5">{i.has_ground ? 'Sí' : 'No'}{i.ground_location ? ` (${i.ground_location})` : ''}</p></div>}
                                </div>

                                {/* Niveles */}
                                {(i.static_level || i.dynamic_level || i.flow_rate || i.bottom_depth) && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                        {i.static_level ? <div className="bg-sky-50 rounded-lg p-3 border border-sky-200"><p className="text-xs text-sky-400">Nivel Estático</p><p className="font-semibold text-sm mt-0.5 text-sky-700">{i.static_level} m</p></div> : null}
                                        {i.dynamic_level ? <div className="bg-sky-50 rounded-lg p-3 border border-sky-200"><p className="text-xs text-sky-400">Nivel Dinámico</p><p className="font-semibold text-sm mt-0.5 text-sky-700">{i.dynamic_level} m</p></div> : null}
                                        {i.flow_rate ? <div className="bg-sky-50 rounded-lg p-3 border border-sky-200"><p className="text-xs text-sky-400">Gasto</p><p className="font-semibold text-sm mt-0.5 text-sky-700">{i.flow_rate} lps</p></div> : null}
                                        {i.bottom_depth ? <div className="bg-sky-50 rounded-lg p-3 border border-sky-200"><p className="text-xs text-sky-400">Prof. Fondo</p><p className="font-semibold text-sm mt-0.5 text-sky-700">{i.bottom_depth} m</p></div> : null}
                                    </div>
                                )}

                                {/* Observaciones */}
                                {i.observations && (
                                    <div className="text-sm text-slate-700 mb-4 rounded-lg bg-amber-50 border border-amber-100 p-3">
                                        <strong className="text-amber-800">Observaciones:</strong>
                                        <p className="mt-1 whitespace-pre-line">{i.observations}</p>
                                    </div>
                                )}

                                {i.photos && i.photos.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-slate-100"><PhotoGallery photos={i.photos} /></div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* TAB CONTENT: Desinstalaciones */}
                {tab === 'desinstalaciones' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        {uninstallations.map(u => (
                            <div key={u.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                <ClientFormatHeader
                                    title="DESINSTALACIÓN DE EQUIPO"
                                    folio={u.folio}
                                    date={u.uninstallation_date}
                                    clientName={client.company_name}
                                    location={u.location || client.address}
                                    technician={u.technician}
                                    equipment={u.equipment_type || u.pump_model}
                                    onPrint={() => handlePrintUninstallation(u)}
                                />

                                {/* Datos del equipo extraído */}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                                    {u.equipment_type && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Tipo de Equipo</p><p className="font-semibold text-sm mt-0.5">{u.equipment_type}</p></div>}
                                    {u.motor_hp && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Motor / HP</p><p className="font-semibold text-sm mt-0.5">{u.motor_hp}</p></div>}
                                    {u.pump_model && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Modelo Bomba</p><p className="font-semibold text-sm mt-0.5">{u.pump_model}</p></div>}
                                    {u.pipe_diameter && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Diám. Tubería</p><p className="font-semibold text-sm mt-0.5">{u.pipe_diameter}</p></div>}
                                    {u.pipe_segments ? <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Tramos Extraídos</p><p className="font-semibold text-sm mt-0.5">{u.pipe_segments}</p></div> : null}
                                    {u.cable_gauge && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Calibre Cable</p><p className="font-semibold text-sm mt-0.5">{u.cable_gauge}</p></div>}
                                    {u.static_level ? <div className="bg-sky-50 rounded-lg p-3 border border-sky-200"><p className="text-xs text-sky-400">Nivel Estático</p><p className="font-semibold text-sm mt-0.5 text-sky-700">{u.static_level} m</p></div> : null}
                                    {u.bottom_depth ? <div className="bg-sky-50 rounded-lg p-3 border border-sky-200"><p className="text-xs text-sky-400">Prof. Fondo</p><p className="font-semibold text-sm mt-0.5 text-sky-700">{u.bottom_depth} m</p></div> : null}
                                    {u.technician && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Técnico</p><p className="font-semibold text-sm mt-0.5">{u.technician}</p></div>}
                                </div>

                                {/* Motivo */}
                                <div className="text-sm text-slate-700 bg-orange-50 p-3 rounded-lg border border-orange-100 mb-4">
                                    <strong className="text-orange-800">Motivo de extracción:</strong>
                                    <p className="mt-1 whitespace-pre-line">{u.reason || 'No especificado'}</p>
                                </div>

                                {/* Observaciones */}
                                {u.observations && (
                                    <div className="text-sm text-slate-700 mb-4 rounded-lg bg-amber-50 border border-amber-100 p-3">
                                        <strong className="text-amber-800">Observaciones:</strong>
                                        <p className="mt-1 whitespace-pre-line">{u.observations}</p>
                                    </div>
                                )}

                                {u.photos && u.photos.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-slate-100"><PhotoGallery photos={u.photos} /></div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* TAB CONTENT: Cuadros */}
                {tab === 'cuadros' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        {panels.map(p => (
                            <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                <ClientFormatHeader
                                    title="FORMATO DE CUADRO ELÉCTRICO"
                                    folio={p.folio}
                                    date={p.record_date}
                                    clientName={client.company_name}
                                    location={p.location || (p.well_name ? `Pozo: ${p.well_name}` : client.address)}
                                    technician={p.technician}
                                    equipment={p.motor_brand || p.arr_brand}
                                    onPrint={() => handlePrintPanel(p)}
                                />

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                                    {/* Transformador */}
                                    {(p.trans_capacity || p.trans_brand || p.trans_primary_voltage || p.trans_secondary_voltage) && (
                                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                            <h4 className="font-bold text-xs text-slate-500 mb-2 uppercase tracking-wide border-b border-slate-200 pb-1">Transformador</h4>
                                            <div className="space-y-1 text-sm">
                                                {p.trans_capacity && <p><span className="text-slate-400">Capacidad:</span> <span className="font-medium">{p.trans_capacity}</span></p>}
                                                {p.trans_brand && <p><span className="text-slate-400">Marca:</span> <span className="font-medium">{p.trans_brand}</span></p>}
                                                {p.trans_primary_voltage && <p><span className="text-slate-400">Voltaje Primario:</span> <span className="font-medium">{p.trans_primary_voltage} V</span></p>}
                                                {p.trans_secondary_voltage && <p><span className="text-slate-400">Voltaje Secundario:</span> <span className="font-medium">{p.trans_secondary_voltage} V</span></p>}
                                                {p.trans_phases && <p><span className="text-slate-400">Fases:</span> <span className="font-medium">{p.trans_phases}</span></p>}
                                            </div>
                                        </div>
                                    )}
                                    {/* Arrancador */}
                                    {(p.arr_voltage || p.arr_cabinet_type || p.arr_brand || p.arr_model) && (
                                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                            <h4 className="font-bold text-xs text-slate-500 mb-2 uppercase tracking-wide border-b border-slate-200 pb-1">Arrancador</h4>
                                            <div className="space-y-1 text-sm">
                                                {p.arr_voltage && <p><span className="text-slate-400">Voltaje:</span> <span className="font-medium">{p.arr_voltage} V</span></p>}
                                                {p.arr_cabinet_type && <p><span className="text-slate-400">Gabinete:</span> <span className="font-medium">{p.arr_cabinet_type}</span></p>}
                                                {p.arr_brand && <p><span className="text-slate-400">Marca:</span> <span className="font-medium">{p.arr_brand}</span></p>}
                                                {p.arr_model && <p><span className="text-slate-400">Modelo:</span> <span className="font-medium">{p.arr_model}</span></p>}
                                                {p.arr_hp && <p><span className="text-slate-400">HP:</span> <span className="font-medium">{p.arr_hp}</span></p>}
                                            </div>
                                        </div>
                                    )}
                                    {/* Motor */}
                                    {(p.motor_hp || p.motor_voltage || p.motor_brand || p.motor_model) && (
                                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                            <h4 className="font-bold text-xs text-slate-500 mb-2 uppercase tracking-wide border-b border-slate-200 pb-1">Motor</h4>
                                            <div className="space-y-1 text-sm">
                                                {p.motor_hp && <p><span className="text-slate-400">HP:</span> <span className="font-medium">{p.motor_hp}</span></p>}
                                                {p.motor_voltage && <p><span className="text-slate-400">Voltaje:</span> <span className="font-medium">{p.motor_voltage} V</span></p>}
                                                {p.motor_brand && <p><span className="text-slate-400">Marca:</span> <span className="font-medium">{p.motor_brand}</span></p>}
                                                {p.motor_model && <p><span className="text-slate-400">Modelo:</span> <span className="font-medium">{p.motor_model}</span></p>}
                                                {p.motor_nom_amps && <p><span className="text-slate-400">Amp. Nominal:</span> <span className="font-medium">{p.motor_nom_amps} A</span></p>}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Observaciones */}
                                {p.observations && (
                                    <div className="text-sm text-slate-700 mb-4 rounded-lg bg-amber-50 border border-amber-100 p-3">
                                        <strong className="text-amber-800">Observaciones:</strong>
                                        <p className="mt-1 whitespace-pre-line">{p.observations}</p>
                                    </div>
                                )}

                                {p.photos && p.photos.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-slate-100"><PhotoGallery photos={p.photos} /></div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* TAB CONTENT: Aforos */}
                {tab === 'aforos' && (
                    <div className="space-y-4 animate-in fade-in duration-500">
                        {aforos.map(a => (
                            <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                <ClientFormatHeader
                                    title={`FORMATO DE AFORO (${a.duration_hours || ''}H)`}
                                    folio={a.folio}
                                    date={a.created_at ? new Date(a.created_at).toLocaleDateString('es-MX') : ''}
                                    clientName={client.company_name}
                                    location={a.location || client.address}
                                    technician={a.technician}
                                    onPrint={() => handlePrintAforo(a)}
                                />
                                
                                {a.measurements && a.measurements.length > 0 ? (
                                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                                        <table className="w-full text-left text-sm text-slate-600">
                                            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                                <tr>
                                                    <th className="px-4 py-2 border-b border-slate-200">Día</th>
                                                    <th className="px-4 py-2 border-b border-slate-200">Hora</th>
                                                    <th className="px-4 py-2 border-b border-slate-200">N.D.</th>
                                                    <th className="px-4 py-2 border-b border-slate-200">Caudal (LPS)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(a.measurements as any[]).sort((x,y) => x.row_index - y.row_index).slice(0,5).map((m: any, i) => (
                                                    <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                                        <td className="px-4 py-2 font-medium">{m.day_label || '-'}</td>
                                                        <td className="px-4 py-2">{m.hour_label || '-'}</td>
                                                        <td className="px-4 py-2">{m.dynamic_level || '-'}</td>
                                                        <td className="px-4 py-2">{m.flow_lps || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {a.measurements.length > 5 && (
                                            <div className="bg-slate-50 py-2 text-center text-xs text-slate-500 border-t border-slate-200">
                                                Y {a.measurements.length - 5} lecturas más...
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-500">Sin lecturas registradas.</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
