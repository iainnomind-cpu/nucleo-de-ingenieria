-- MIGRATION: SEED DATA M9 — WhatsApp Marketing & Notificaciones
-- Usa los mismos UUIDs de clientes, equipos, facturas y schedules del seed_data.sql

-- =======================================================
-- PLANTILLAS DE WHATSAPP (aprobadas por Meta)
-- =======================================================
INSERT INTO wa_templates (id, name, category, language, header_type, header_content, body, footer, buttons, variables, meta_status) VALUES

-- Recordatorios de mantenimiento
('a1000001-0001-4001-a001-000000000001', 'recordatorio_mant_30d', 'utility', 'es_MX', 'text', '🔧 Recordatorio de Mantenimiento',
 'Hola {{1}}, le informamos que el servicio de *{{2}}* para su equipo en *{{3}}* está programado para el *{{4}}* (en 30 días).

¿Le gustaría confirmar o reagendar? Responda a este mensaje.',
 'Núcleo de Ingeniería · Soporte Técnico', '[{"type":"QUICK_REPLY","text":"✅ Confirmar"},{"type":"QUICK_REPLY","text":"📅 Reagendar"}]',
 '["client_name","service_type","well_name","next_service_date"]', 'approved'),

('a1000001-0001-4001-a001-000000000002', 'recordatorio_mant_15d', 'utility', 'es_MX', 'text', '⏰ Mantenimiento en 15 días',
 'Estimado(a) {{1}}, su servicio de *{{2}}* está a 15 días de realizarse ({{3}}).

Joel, nuestro técnico de campo, será el encargado de la visita. 

¿Confirma la fecha? 👇',
 'Núcleo de Ingeniería', '[{"type":"QUICK_REPLY","text":"✅ Confirmado"},{"type":"QUICK_REPLY","text":"📞 Llamar para ajustar"}]',
 '["client_name","service_type","next_service_date"]', 'approved'),

('a1000001-0001-4001-a001-000000000003', 'recordatorio_mant_7d', 'utility', 'es_MX', 'text', '🔔 ¡Servicio la próxima semana!',
 'Hola {{1}}, le recordamos que su *{{2}}* se realizará el *{{3}}*.

🧑‍🔧 Técnico: Joel
📍 Ubicación: {{4}}
⏰ Horario estimado: 8:00 AM

Por favor asegure el acceso al equipo. ¿Todo listo?',
 'Núcleo de Ingeniería', '[{"type":"QUICK_REPLY","text":"✅ Listo"},{"type":"QUICK_REPLY","text":"⚠️ Hay un problema"}]',
 '["client_name","service_type","next_service_date","location"]', 'approved'),

('a1000001-0001-4001-a001-000000000004', 'recordatorio_mant_hoy', 'utility', 'es_MX', 'text', '🚗 ¡Hoy es el día!',
 '¡Buenos días {{1}}! 🌤️

Hoy realizaremos el servicio de *{{2}}* en su instalación.

🧑‍🔧 Joel va en camino
📍 Ubicación en tiempo real: {{3}}
⏰ Llegada estimada: {{4}}

Cualquier duda, responda este mensaje.',
 'Núcleo de Ingeniería', '[]',
 '["client_name","service_type","maps_link","eta"]', 'approved'),

-- Confirmación de visita
('a1000001-0001-4001-a001-000000000005', 'confirmacion_visita', 'utility', 'es_MX', 'text', '✅ Visita Confirmada',
 'Hola {{1}}, confirmamos su visita de *{{2}}* para el *{{3}}*.

📋 Detalles:
• Técnico: Joel
• Equipo: {{4}}
• Duración estimada: {{5}}

Le enviaremos la ubicación en tiempo real el día del servicio. ¡Gracias por confiar en Núcleo!',
 'Núcleo de Ingeniería', '[]',
 '["client_name","service_type","date","equipment_name","duration"]', 'approved'),

-- Recordatorios de pago
('a1000001-0001-4001-a001-000000000006', 'pago_previo_7d', 'utility', 'es_MX', 'text', '💳 Recordatorio de Pago',
 'Estimado(a) {{1}}, le recordamos que su factura *{{2}}* por *{{3}}* vence el *{{4}}* (en 7 días).

💰 Saldo pendiente: {{5}}
🏦 Cuenta: BBVA 0118 0012 3456 7890
📧 CLABE: 012320001234567890

¿Ya realizó el pago? Envíenos su comprobante por aquí.',
 'Núcleo de Ingeniería · Cobranza', '[{"type":"QUICK_REPLY","text":"✅ Ya pagué"},{"type":"QUICK_REPLY","text":"📅 Necesito prórroga"}]',
 '["client_name","invoice_number","total","due_date","balance"]', 'approved'),

('a1000001-0001-4001-a001-000000000007', 'pago_vencido_3d', 'utility', 'es_MX', 'text', '⚠️ Pago Vencido',
 'Estimado(a) {{1}}, su factura *{{2}}* venció hace {{3}} días.

💰 Saldo pendiente: *{{4}}*

Le solicitamos regularizar su pago a la brevedad para evitar la suspensión del servicio. Si ya realizó el pago, envíenos su comprobante.

¿Necesita hablar con nosotros?',
 'Núcleo de Ingeniería', '[{"type":"QUICK_REPLY","text":"📎 Enviar comprobante"},{"type":"QUICK_REPLY","text":"📞 Contactar cobranza"}]',
 '["client_name","invoice_number","days_overdue","balance"]', 'approved'),

('a1000001-0001-4001-a001-000000000008', 'pago_vencido_15d', 'utility', 'es_MX', 'text', '🚨 Aviso Importante de Pago',
 'Estimado(a) {{1}}, su factura *{{2}}* tiene un atraso de *{{3}} días*.

💰 Saldo: *{{4}}*

Este es un aviso formal previo a la suspensión de servicios. Por favor comuníquese con nosotros para acordar el pago.',
 'Núcleo de Ingeniería · Dirección', '[{"type":"QUICK_REPLY","text":"📞 Llamar ahora"},{"type":"QUICK_REPLY","text":"💬 Quiero negociar"}]',
 '["client_name","invoice_number","days_overdue","balance"]', 'approved'),

-- Alertas operativas
('a1000001-0001-4001-a001-000000000009', 'alerta_cotizacion_enviada', 'utility', 'es_MX', 'text', '📋 Cotización Lista',
 'Hola {{1}}, su cotización *{{2}}* por *{{3}}* ya está lista.

📄 Concepto: {{4}}
📅 Tiempo estimado: {{5}} días

Puede revisarla y aceptarla respondiendo a este mensaje. ¿Tiene alguna duda?',
 'Núcleo de Ingeniería', '[{"type":"QUICK_REPLY","text":"✅ Aceptar"},{"type":"QUICK_REPLY","text":"❓ Tengo dudas"}]',
 '["client_name","quote_number","total","description","estimated_days"]', 'approved'),

('a1000001-0001-4001-a001-000000000010', 'alerta_proyecto_inicio', 'utility', 'es_MX', 'text', '🚀 Proyecto Iniciado',
 '¡Hola {{1}}! Le informamos que su proyecto *{{2}}* ha comenzado oficialmente.

📋 Proyecto: {{3}}
🧑‍🔧 Equipo asignado: {{4}}
📅 Inicio: {{5}}

Le mantendremos informado del avance. ¡Vamos!',
 'Núcleo de Ingeniería', '[]',
 '["client_name","project_number","title","team","start_date"]', 'approved'),

('a1000001-0001-4001-a001-000000000011', 'alerta_proyecto_fin', 'utility', 'es_MX', 'text', '🎉 Proyecto Finalizado',
 '¡Felicidades {{1}}! Su proyecto *{{2}} — {{3}}* ha sido completado exitosamente. ✅

Próximos pasos:
• Recibirá su factura en las próximas horas
• Se programará el mantenimiento preventivo

¿Cómo calificaría nuestro servicio? (1-5) ⭐',
 'Núcleo de Ingeniería', '[]',
 '["client_name","project_number","title"]', 'approved'),

('a1000001-0001-4001-a001-000000000012', 'alerta_falla', 'utility', 'es_MX', 'text', '🚨 Alerta de Equipo',
 'Atención {{1}}: se ha detectado una anomalía en su equipo *{{2}}* ubicado en *{{3}}*.

⚠️ Detalle: {{4}}
🧑‍🔧 Acción: Joel será contactado para una inspección urgente

¿Autoriza la visita de emergencia?',
 'Núcleo de Ingeniería · Soporte', '[{"type":"QUICK_REPLY","text":"✅ Autorizar visita"},{"type":"QUICK_REPLY","text":"📞 Llamar primero"}]',
 '["client_name","equipment_name","location","issue_description"]', 'approved'),

-- Encuesta post-servicio
('a1000001-0001-4001-a001-000000000013', 'encuesta_post_servicio', 'utility', 'es_MX', 'text', '⭐ ¿Cómo fue su experiencia?',
 'Hola {{1}}, ayer realizamos el servicio de *{{2}}* en su instalación.

Su opinión es muy importante para nosotros. ¿Cómo calificaría el servicio? Responda con un número del 1 al 5:

1️⃣ Muy malo
2️⃣ Malo
3️⃣ Regular
4️⃣ Bueno
5️⃣ Excelente

¡Gracias!',
 'Núcleo de Ingeniería', '[]',
 '["client_name","service_type"]', 'approved'),

-- Campaña de reactivación
('a1000001-0001-4001-a001-000000000014', 'reactivacion_sin_visita', 'marketing', 'es_MX', 'text', '👋 Te extrañamos',
 'Hola {{1}}, notamos que su equipo en *{{2}}* no ha tenido mantenimiento en los últimos *{{3}} meses*.

Sabemos que un equipo bien mantenido ahorra hasta un 30% en consumo eléctrico. 💡

¿Le gustaría agendar una revisión preventiva?',
 'Núcleo de Ingeniería', '[{"type":"QUICK_REPLY","text":"📅 Agendar revisión"},{"type":"QUICK_REPLY","text":"🚫 No por ahora"}]',
 '["client_name","well_name","months_since_last"]', 'approved');


-- =======================================================
-- CAMPAÑAS AUTOMATIZADAS
-- =======================================================
INSERT INTO wa_campaigns (id, name, description, campaign_type, is_active, total_sent, total_delivered, total_read, total_responded, total_conversions, revenue_generated) VALUES

('b1000001-0001-4001-a001-000000000001', 'Recordatorio Mantenimiento Preventivo', 
 'Secuencia automática de 4 mensajes a 30, 15, 7 días y día del servicio para todos los mantenimientos programados.',
 'maintenance_reminder', true, 48, 46, 38, 28, 12, 540000),

('b1000001-0001-4001-a001-000000000002', 'Recordatorio de Pago Pre-vencimiento',
 'Secuencia de 3 etapas: 7 días antes, 3 días después, y 15 días después del vencimiento.',
 'payment_reminder', true, 32, 31, 27, 15, 10, 875000),

('b1000001-0001-4001-a001-000000000003', 'Notificaciones Operativas de Proyecto',
 'Notificaciones automáticas al cliente cuando hay cambios en su proyecto: cotización, inicio, finalización, alertas.',
 'operational', true, 24, 24, 22, 8, 6, 180000),

('b1000001-0001-4001-a001-000000000004', 'Reactivación Clientes Inactivos',
 'Campaña para clientes con equipo instalado sin visita en los últimos 6+ meses.',
 'reactivation', true, 15, 14, 10, 6, 3, 135000);


-- =======================================================
-- PASOS DE CAMPAÑAS (secuencias)
-- =======================================================

-- Campaña 1: Mantenimiento (30d, 15d, 7d, día)
INSERT INTO wa_campaign_steps (campaign_id, template_id, step_order, trigger_days, send_time, is_active) VALUES
('b1000001-0001-4001-a001-000000000001', 'a1000001-0001-4001-a001-000000000001', 1, -30, '09:00', true),
('b1000001-0001-4001-a001-000000000001', 'a1000001-0001-4001-a001-000000000002', 2, -15, '09:00', true),
('b1000001-0001-4001-a001-000000000001', 'a1000001-0001-4001-a001-000000000003', 3, -7,  '09:00', true),
('b1000001-0001-4001-a001-000000000001', 'a1000001-0001-4001-a001-000000000004', 4,  0,  '07:30', true);

-- Campaña 2: Pago (7d antes, 3d después, 15d después)
INSERT INTO wa_campaign_steps (campaign_id, template_id, step_order, trigger_days, send_time, is_active) VALUES
('b1000001-0001-4001-a001-000000000002', 'a1000001-0001-4001-a001-000000000006', 1, -7,  '10:00', true),
('b1000001-0001-4001-a001-000000000002', 'a1000001-0001-4001-a001-000000000007', 2,  3,  '10:00', true),
('b1000001-0001-4001-a001-000000000002', 'a1000001-0001-4001-a001-000000000008', 3,  15, '10:00', true);

-- Campaña 3: Operativas (cotización, inicio, fin)
INSERT INTO wa_campaign_steps (campaign_id, template_id, step_order, trigger_days, send_time, is_active) VALUES
('b1000001-0001-4001-a001-000000000003', 'a1000001-0001-4001-a001-000000000009', 1, 0, '09:00', true),
('b1000001-0001-4001-a001-000000000003', 'a1000001-0001-4001-a001-000000000010', 2, 0, '09:00', true),
('b1000001-0001-4001-a001-000000000003', 'a1000001-0001-4001-a001-000000000011', 3, 0, '09:00', true);

-- Campaña 4: Reactivación (1 mensaje)
INSERT INTO wa_campaign_steps (campaign_id, template_id, step_order, trigger_days, send_time, is_active) VALUES
('b1000001-0001-4001-a001-000000000004', 'a1000001-0001-4001-a001-000000000014', 1, 0, '10:00', true);


-- =======================================================
-- CONVERSACIONES CON CLIENTES
-- =======================================================
INSERT INTO wa_conversations (id, client_id, phone_number, client_name, status, last_message_at, last_message_preview, unread_count, assigned_to) VALUES
('c1000001-0001-4001-a001-000000000001', '47e70259-21cb-4bc9-93b5-7c0ef95cfdbf', '526621002030', 'José Martínez — Agrícola San José', 'active',
 NOW() - INTERVAL '2 hours', '✅ Confirmado, los esperamos el jueves', 0, 'Joel'),

('c1000001-0001-4001-a001-000000000002', 'bd94e772-c518-472b-8a16-6cdaaab54c9a', '526628009010', 'María de la Cruz — Inmobiliaria Bosques', 'active',
 NOW() - INTERVAL '30 minutes', '📎 Adjunto comprobante de transferencia', 1, 'Samara');


-- =======================================================
-- MENSAJES DE EJEMPLO (conversación Agrícola San José)
-- =======================================================
INSERT INTO wa_messages (conversation_id, direction, message_type, content, status, sent_by, campaign_id, created_at) VALUES

-- Secuencia de recordatorio de mantenimiento
('c1000001-0001-4001-a001-000000000001', 'outbound', 'template',
 '🔧 Recordatorio de Mantenimiento
Hola José, le informamos que el servicio de *Revisión Trimestral Bomba Norte* para su equipo en *Pozo Agrícola Norte 1* está programado para el *' || (CURRENT_DATE + INTERVAL '80 days')::text || '* (en 30 días).

¿Le gustaría confirmar o reagendar? Responda a este mensaje.',
 'read', 'sistema', 'b1000001-0001-4001-a001-000000000001', NOW() - INTERVAL '5 days'),

('c1000001-0001-4001-a001-000000000001', 'inbound', 'text',
 '✅ Confirmado, los esperamos. ¿Va Joel verdad?',
 'read', null, null, NOW() - INTERVAL '5 days' + INTERVAL '3 hours'),

('c1000001-0001-4001-a001-000000000001', 'outbound', 'text',
 '¡Perfecto José! Sí, Joel será quien los visite. Le enviaremos un recordatorio una semana antes con más detalles. 👍',
 'read', 'Director', null, NOW() - INTERVAL '5 days' + INTERVAL '3 hours 15 minutes'),

-- Notificación de proyecto completado
('c1000001-0001-4001-a001-000000000001', 'outbound', 'template',
 '🎉 Proyecto Finalizado
¡Felicidades José! Su proyecto *PRY-2026-0001 — Renovación Pozo Norte* ha sido completado exitosamente. ✅

Próximos pasos:
• Recibirá su factura en las próximas horas
• Se programará el mantenimiento preventivo

¿Cómo calificaría nuestro servicio? (1-5) ⭐',
 'read', 'sistema', 'b1000001-0001-4001-a001-000000000003', NOW() - INTERVAL '3 days'),

('c1000001-0001-4001-a001-000000000001', 'inbound', 'text',
 '5 ⭐ Excelente trabajo como siempre, Joel es un crack. Quedó perfecto el pozo.',
 'read', null, null, NOW() - INTERVAL '3 days' + INTERVAL '1 hour'),

('c1000001-0001-4001-a001-000000000001', 'outbound', 'text',
 '¡Muchas gracias José! 🙏 Su confianza nos motiva. Le pasaremos su comentario a Joel. La factura ya fue emitida, revise su correo. ¡Saludos!',
 'read', 'Director', null, NOW() - INTERVAL '3 days' + INTERVAL '1 hour 10 minutes'),

-- Confirmación de visita con ubicación
('c1000001-0001-4001-a001-000000000001', 'outbound', 'template',
 '✅ Visita Confirmada
Hola José, confirmamos su visita de *Inspección Termográfica Tablero* para hoy.

📋 Detalles:
• Técnico: Joel
• Equipo: Bomba Principal Norte
• Duración estimada: 3 horas

Le enviaremos la ubicación en tiempo real. ¡Gracias por confiar en Núcleo!',
 'read', 'sistema', null, NOW() - INTERVAL '2 hours 30 minutes'),

('c1000001-0001-4001-a001-000000000001', 'outbound', 'location',
 '📍 Joel va en camino a su instalación',
 'delivered', 'sistema', null, NOW() - INTERVAL '2 hours'),

('c1000001-0001-4001-a001-000000000001', 'inbound', 'text',
 '✅ Confirmado, los esperamos el jueves',
 'read', null, null, NOW() - INTERVAL '2 hours');


-- =======================================================
-- MENSAJES DE EJEMPLO (conversación Inmobiliaria Bosques)
-- =======================================================
INSERT INTO wa_messages (conversation_id, direction, message_type, content, status, sent_by, campaign_id, invoice_id, created_at) VALUES

-- Recordatorio de pago
('c1000001-0001-4001-a001-000000000002', 'outbound', 'template',
 '⚠️ Pago Vencido
Estimado(a) María, su factura *FAC-2026-0002* venció hace 5 días.

💰 Saldo pendiente: *$25,000.00*

Le solicitamos regularizar su pago a la brevedad para evitar la suspensión del servicio. Si ya realizó el pago, envíenos su comprobante.',
 'read', 'sistema', 'b1000001-0001-4001-a001-000000000002', '32222222-2222-4222-a222-222222222222', NOW() - INTERVAL '1 day'),

('c1000001-0001-4001-a001-000000000002', 'inbound', 'text',
 'Sí, ya lo transferí ayer. Déjeme buscar el comprobante.',
 'read', null, null, null, NOW() - INTERVAL '23 hours'),

('c1000001-0001-4001-a001-000000000002', 'outbound', 'text',
 'Perfecto María, quedo al pendiente del comprobante. Gracias. 🙏',
 'read', 'Samara', null, null, NOW() - INTERVAL '22 hours 45 minutes'),

('c1000001-0001-4001-a001-000000000002', 'inbound', 'text',
 '📎 Adjunto comprobante de transferencia',
 'delivered', null, null, null, NOW() - INTERVAL '30 minutes');


-- =======================================================
-- NOTIFICACIONES OPERATIVAS DISPARADAS
-- =======================================================
INSERT INTO wa_notifications (client_id, template_id, notification_type, reference_type, reference_id, status, sent_at, delivered_at, read_at) VALUES

-- Cotización enviada a Inmobiliaria Bosques
('bd94e772-c518-472b-8a16-6cdaaab54c9a', 'a1000001-0001-4001-a001-000000000009', 'quote_sent', 'quote', 'fa93297f-44eb-4a24-9f87-c10ba249f056', 'read',
 NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days' + INTERVAL '2 hours'),

-- Proyecto iniciado para Agrícola San José
('47e70259-21cb-4bc9-93b5-7c0ef95cfdbf', 'a1000001-0001-4001-a001-000000000010', 'project_start', 'project', '8a513d6a-5435-43a9-a78b-d7d8c7c93cb5', 'read',
 NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days' + INTERVAL '30 minutes'),

-- Proyecto completado para Agrícola San José
('47e70259-21cb-4bc9-93b5-7c0ef95cfdbf', 'a1000001-0001-4001-a001-000000000011', 'project_complete', 'project', '8a513d6a-5435-43a9-a78b-d7d8c7c93cb5', 'read',
 NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '1 hour'),

-- Recordatorio de mantenimiento 
('47e70259-21cb-4bc9-93b5-7c0ef95cfdbf', 'a1000001-0001-4001-a001-000000000001', 'maintenance_reminder', 'maintenance_schedule', null, 'read',
 NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '3 hours'),

-- Confirmación de visita
('47e70259-21cb-4bc9-93b5-7c0ef95cfdbf', 'a1000001-0001-4001-a001-000000000005', 'visit_confirmation', 'maintenance_schedule', null, 'delivered',
 NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours', null),

-- Recordatorio de pago a Inmobiliaria Bosques
('bd94e772-c518-472b-8a16-6cdaaab54c9a', 'a1000001-0001-4001-a001-000000000007', 'payment_reminder', 'invoice', '32222222-2222-4222-a222-222222222222', 'read',
 NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours'),

-- Alerta de falla pendiente
('bd94e772-c518-472b-8a16-6cdaaab54c9a', 'a1000001-0001-4001-a001-000000000012', 'fault_alert', 'project', '86ea25f1-34e8-46eb-8e5f-e5cb09abcddf', 'sent',
 NOW() - INTERVAL '6 hours', null, null);


-- =======================================================
-- ENCUESTAS POST-SERVICIO
-- =======================================================
INSERT INTO wa_surveys (client_id, schedule_id, conversation_id, question, rating, comment, status, sent_at, answered_at) VALUES

('47e70259-21cb-4bc9-93b5-7c0ef95cfdbf', null, 'c1000001-0001-4001-a001-000000000001',
 '¿Cómo calificaría el servicio recibido? (1-5)', 5,
 'Excelente trabajo como siempre, Joel es un crack. Quedó perfecto el pozo.',
 'answered', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '1 hour'),

('bd94e772-c518-472b-8a16-6cdaaab54c9a', null, 'c1000001-0001-4001-a001-000000000002',
 '¿Cómo calificaría el servicio recibido? (1-5)', 4,
 'Buen servicio, solo llegaron un poco tarde.',
 'answered', NOW() - INTERVAL '15 days', NOW() - INTERVAL '14 days'),

('47e70259-21cb-4bc9-93b5-7c0ef95cfdbf', null, 'c1000001-0001-4001-a001-000000000001',
 '¿Cómo calificaría el servicio recibido? (1-5)', 5,
 null,
 'answered', NOW() - INTERVAL '45 days', NOW() - INTERVAL '44 days'),

('bd94e772-c518-472b-8a16-6cdaaab54c9a', null, null,
 '¿Cómo calificaría el servicio recibido? (1-5)', null,
 null,
 'sent', NOW() - INTERVAL '1 day', null);

-- Fin de seed data M9
