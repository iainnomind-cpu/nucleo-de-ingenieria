// ─── M9: WhatsApp Marketing & Notificaciones ───

export type TemplateCategory = 'utility' | 'marketing' | 'authentication';
export type TemplateHeaderType = 'none' | 'text' | 'image' | 'document' | 'video';
export type MetaStatus = 'draft' | 'pending' | 'approved' | 'rejected';
export type CampaignType = 'maintenance_reminder' | 'payment_reminder' | 'reactivation' | 'operational' | 'custom';
export type ConversationStatus = 'active' | 'archived' | 'blocked';
export type MessageDirection = 'inbound' | 'outbound';
export type WaMessageType = 'text' | 'template' | 'image' | 'document' | 'location' | 'quick_reply';
export type WaMessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
export type NotificationType = 'quote_sent' | 'project_start' | 'project_complete' | 'fault_alert' | 'visit_confirmation' | 'payment_reminder' | 'maintenance_reminder';
export type SurveyStatus = 'sent' | 'answered' | 'expired';

// ─── Interfaces ───

export interface WaTemplate {
    id: string;
    name: string;
    category: TemplateCategory;
    language: string;
    header_type: TemplateHeaderType | null;
    header_content: string | null;
    body: string;
    footer: string | null;
    buttons: Array<{ type: string; text: string }>;
    variables: string[];
    usage_type: 'marketing' | 'team';
    meta_status: MetaStatus;
    meta_template_id: string | null;
    meta_name: string | null;
    example_values: string[];
    created_at: string;
    updated_at: string;
}

export interface WaCampaign {
    id: string;
    name: string;
    description: string | null;
    campaign_type: CampaignType;
    is_active: boolean;
    target_filter: Record<string, unknown>;
    total_sent: number;
    total_delivered: number;
    total_read: number;
    total_responded: number;
    total_conversions: number;
    revenue_generated: number;
    created_at: string;
    updated_at: string;
    steps?: WaCampaignStep[];
}

export interface WaCampaignStep {
    id: string;
    campaign_id: string;
    template_id: string | null;
    step_order: number;
    trigger_days: number;
    trigger_reference: string;
    delay_hours: number;
    send_time: string;
    is_active: boolean;
    created_at: string;
    template?: WaTemplate;
}

export interface WaConversation {
    id: string;
    client_id: string | null;
    phone_number: string;
    client_name: string | null;
    status: ConversationStatus;
    last_message_at: string | null;
    last_message_preview: string | null;
    unread_count: number;
    assigned_to: string | null;
    tags: string[];
    created_at: string;
    updated_at: string;
    client?: { id: string; company_name: string };
    messages?: WaMessage[];
}

export interface WaMessage {
    id: string;
    conversation_id: string;
    template_id: string | null;
    direction: MessageDirection;
    message_type: WaMessageType;
    content: string | null;
    media_url: string | null;
    media_type: string | null;
    template_variables: string[];
    wa_message_id: string | null;
    status: WaMessageStatus;
    error_message: string | null;
    sent_by: string | null;
    campaign_id: string | null;
    schedule_id: string | null;
    invoice_id: string | null;
    location_lat: number | null;
    location_lng: number | null;
    location_label: string | null;
    created_at: string;
}

export interface WaNotification {
    id: string;
    client_id: string;
    template_id: string | null;
    notification_type: NotificationType;
    reference_type: string | null;
    reference_id: string | null;
    variables_used: Record<string, unknown>;
    status: WaMessageStatus;
    sent_at: string | null;
    delivered_at: string | null;
    read_at: string | null;
    error_message: string | null;
    created_at: string;
    client?: { id: string; company_name: string };
}

export interface WaSurvey {
    id: string;
    client_id: string;
    schedule_id: string | null;
    conversation_id: string | null;
    question: string;
    rating: number | null;
    comment: string | null;
    status: SurveyStatus;
    sent_at: string;
    answered_at: string | null;
    created_at: string;
    client?: { id: string; company_name: string };
}

// ─── Labels ───

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
    utility: 'Utilidad', marketing: 'Marketing', authentication: 'Autenticación',
};
export const TEMPLATE_CATEGORY_ICONS: Record<TemplateCategory, string> = {
    utility: 'build', marketing: 'campaign', authentication: 'lock',
};

export const META_STATUS_LABELS: Record<MetaStatus, string> = {
    draft: 'Borrador', pending: 'En Revisión', approved: 'Aprobada', rejected: 'Rechazada',
};
export const META_STATUS_COLORS: Record<MetaStatus, { bg: string; text: string }> = {
    draft: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-400' },
    pending: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
    approved: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
    rejected: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
};

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
    maintenance_reminder: 'Recordatorio Mantenimiento', payment_reminder: 'Recordatorio de Pago',
    reactivation: 'Reactivación', operational: 'Operativa', custom: 'Personalizada',
};
export const CAMPAIGN_TYPE_ICONS: Record<CampaignType, string> = {
    maintenance_reminder: 'build', payment_reminder: 'payments', reactivation: 'refresh',
    operational: 'notifications', custom: 'tune',
};
export const CAMPAIGN_TYPE_COLORS: Record<CampaignType, { bg: string; text: string }> = {
    maintenance_reminder: { bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-400' },
    payment_reminder: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
    reactivation: { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-400' },
    operational: { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-400' },
    custom: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400' },
};

export const CONVERSATION_STATUS_LABELS: Record<ConversationStatus, string> = {
    active: 'Activa', archived: 'Archivada', blocked: 'Bloqueada',
};

export const MESSAGE_DIRECTION_LABELS: Record<MessageDirection, string> = {
    inbound: 'Entrante', outbound: 'Saliente',
};

export const WA_MESSAGE_STATUS_LABELS: Record<WaMessageStatus, string> = {
    pending: 'Pendiente', sent: 'Enviado', delivered: 'Entregado', read: 'Leído', failed: 'Fallido',
};
export const WA_MESSAGE_STATUS_COLORS: Record<WaMessageStatus, { bg: string; text: string }> = {
    pending: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-400' },
    sent: { bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-400' },
    delivered: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400' },
    read: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
    failed: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
};
export const WA_MESSAGE_STATUS_ICONS: Record<WaMessageStatus, string> = {
    pending: 'schedule', sent: 'check', delivered: 'done_all', read: 'done_all', failed: 'error',
};

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
    quote_sent: 'Cotización Enviada', project_start: 'Inicio de Proyecto', project_complete: 'Proyecto Finalizado',
    fault_alert: 'Alerta de Falla', visit_confirmation: 'Confirmación de Visita',
    payment_reminder: 'Recordatorio de Pago', maintenance_reminder: 'Recordatorio Mantenimiento',
};
export const NOTIFICATION_TYPE_ICONS: Record<NotificationType, string> = {
    quote_sent: 'request_quote', project_start: 'rocket_launch', project_complete: 'task_alt',
    fault_alert: 'warning', visit_confirmation: 'event_available',
    payment_reminder: 'payments', maintenance_reminder: 'build',
};

export const SURVEY_STATUS_LABELS: Record<SurveyStatus, string> = {
    sent: 'Enviada', answered: 'Respondida', expired: 'Expirada',
};
export const SURVEY_STATUS_COLORS: Record<SurveyStatus, { bg: string; text: string }> = {
    sent: { bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-400' },
    answered: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
    expired: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-500 dark:text-slate-400' },
};

// ─── Helpers ───

export function formatWaCurrency(value: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
}

export function getDeliveryRate(sent: number, delivered: number): number {
    return sent > 0 ? Math.round((delivered / sent) * 100) : 0;
}

export function getReadRate(delivered: number, read: number): number {
    return delivered > 0 ? Math.round((read / delivered) * 100) : 0;
}

export function getResponseRate(read: number, responded: number): number {
    return read > 0 ? Math.round((responded / read) * 100) : 0;
}

export function getConversionRate(responded: number, conversions: number): number {
    return responded > 0 ? Math.round((conversions / responded) * 100) : 0;
}

export function formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    if (cleaned.length === 12 && cleaned.startsWith('52')) return `+52 (${cleaned.slice(2, 5)}) ${cleaned.slice(5, 8)}-${cleaned.slice(8)}`;
    return phone;
}

export function timeAgoWa(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString('es-MX');
}
