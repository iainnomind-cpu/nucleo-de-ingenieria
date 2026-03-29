// ─── Space Types ───
export type SpaceType = 'general' | 'area' | 'project' | 'maintenance' | 'dm' | 'group_dm';
export type MemberRole = 'admin' | 'member' | 'observer';
export type NotificationLevel = 'urgent' | 'normal' | 'summary' | 'muted';
export type MessageType = 'text' | 'image' | 'file' | 'system' | 'checkin_summary' | 'task_created';

export interface Space {
    id: string;
    name: string;
    description: string | null;
    space_type: SpaceType;
    icon: string;
    project_id: string | null;
    contract_id: string | null;
    is_archived: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    members?: SpaceMember[];
    last_message?: Message;
    unread_count?: number;
}

export interface SpaceMember {
    id: string;
    space_id: string;
    user_name: string;
    role: MemberRole;
    notifications: NotificationLevel;
    joined_at: string;
}

export interface Message {
    id: string;
    space_id: string;
    parent_id: string | null;
    sender: string;
    content: string;
    message_type: MessageType;
    file_url: string | null;
    file_name: string | null;
    is_pinned: boolean;
    is_edited: boolean;
    task_id: string | null;
    created_at: string;
    updated_at: string;
    replies?: Message[];
    mentions?: MessageMention[];
    task?: TeamTask;
}

export interface MessageMention {
    id: string;
    message_id: string;
    space_id: string;
    mentioned_user: string;
    is_read: boolean;
    created_at: string;
    message?: Message;
    space?: Space;
}

// ─── Team Tasks ───
export type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface ChecklistItem {
    text: string;
    done: boolean;
}

export interface TeamTask {
    id: string;
    title: string;
    description: string | null;
    assigned_to: string;
    created_by: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string | null;
    completed_at: string | null;
    project_id: string | null;
    client_id: string | null;
    source_message_id: string | null;
    source_space_id: string | null;
    checklist: ChecklistItem[];
    tags: string[] | null;
    created_at: string;
    updated_at: string;
    project?: { id: string; project_number: string; title: string };
}

// ─── Check-ins ───
export interface CheckinResponse {
    id: string;
    prompt_id: string;
    user_name: string;
    completed_yesterday: string | null;
    working_today: string | null;
    blockers: string | null;
    responded_at: string;
}

// ─── Space Files ───
export interface SpaceFile {
    id: string;
    space_id: string;
    file_name: string;
    file_url: string;
    file_type: string | null;
    file_size: number | null;
    uploaded_by: string | null;
    description: string | null;
    is_pinned: boolean;
    created_at: string;
}

// ─── Labels ───
export const SPACE_TYPE_LABELS: Record<SpaceType, string> = {
    general: 'General', area: 'Área', project: 'Proyecto', maintenance: 'Mantenimiento', dm: 'Mensaje Directo', group_dm: 'Grupo Privado',
};
export const SPACE_TYPE_ICONS: Record<SpaceType, string> = {
    general: 'campaign', area: 'group', project: 'engineering', maintenance: 'build', dm: 'chat', group_dm: 'group',
};
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
    pending: 'Pendiente', in_progress: 'En Progreso', blocked: 'Bloqueada', completed: 'Completada',
};
export const TASK_STATUS_COLORS: Record<TaskStatus, { bg: string; text: string }> = {
    pending: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-400' },
    in_progress: { bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-400' },
    blocked: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
    completed: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
};
export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
    low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente',
};
export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
    low: 'text-slate-400', normal: 'text-sky-500', high: 'text-amber-500', urgent: 'text-red-500',
};
export const TASK_PRIORITY_ICONS: Record<TaskPriority, string> = {
    low: 'south', normal: 'remove', high: 'north', urgent: 'priority_high',
};

export const TEAM_MEMBERS = ['Director', 'Joel', 'Samara', 'Paulina', 'Alejandro'];

export const NOTIFICATION_LABELS: Record<NotificationLevel, string> = {
    urgent: 'Solo Urgentes', normal: 'Normal', summary: 'Resumen', muted: 'Silenciado',
};

// ─── Helpers ───
export function getInitials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function getAvatarColor(name: string): string {
    const colors = ['bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

export function timeAgo(dateStr: string): string {
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

export function parseMentions(text: string): string[] {
    const matches = text.match(/@\w+/g);
    return matches ? matches.map(m => m.slice(1)) : [];
}
