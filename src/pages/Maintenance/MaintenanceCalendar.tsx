import { useState, useMemo } from 'react';
import {
    MaintenanceSchedule, ScheduleStatus,
    SERVICE_TYPE_LABELS, SERVICE_TYPE_ICONS,
    SCHEDULE_STATUS_LABELS, SCHEDULE_STATUS_COLORS,
    getDaysUntil, getUrgencyColor,
} from '../../types/maintenance';

interface Props {
    schedules: MaintenanceSchedule[];
    onStatusChange: (id: string, status: ScheduleStatus) => void;
    onDayClick: (date: string) => void;
}

const DAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

interface CalendarDay {
    date: Date;
    dateStr: string;
    isCurrentMonth: boolean;
    isToday: boolean;
    schedules: MaintenanceSchedule[];
}

export default function MaintenanceCalendar({ schedules, onStatusChange, onDayClick }: Props) {
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedSchedule, setSelectedSchedule] = useState<MaintenanceSchedule | null>(null);

    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Build calendar grid
    const calendarDays = useMemo(() => {
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        
        // Get the day of week for the first day (Monday=0 adjustment)
        let startDow = firstDay.getDay() - 1;
        if (startDow < 0) startDow = 6;

        const days: CalendarDay[] = [];

        // Previous month fill
        for (let i = startDow - 1; i >= 0; i--) {
            const d = new Date(currentYear, currentMonth, -i);
            const str = formatDateStr(d);
            days.push({
                date: d,
                dateStr: str,
                isCurrentMonth: false,
                isToday: str === todayStr,
                schedules: schedules.filter(s => s.next_service_date === str),
            });
        }

        // Current month
        for (let i = 1; i <= lastDay.getDate(); i++) {
            const d = new Date(currentYear, currentMonth, i);
            const str = formatDateStr(d);
            days.push({
                date: d,
                dateStr: str,
                isCurrentMonth: true,
                isToday: str === todayStr,
                schedules: schedules.filter(s => s.next_service_date === str),
            });
        }

        // Next month fill to complete 6 rows
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            const d = new Date(currentYear, currentMonth + 1, i);
            const str = formatDateStr(d);
            days.push({
                date: d,
                dateStr: str,
                isCurrentMonth: false,
                isToday: str === todayStr,
                schedules: schedules.filter(s => s.next_service_date === str),
            });
        }

        return days;
    }, [currentMonth, currentYear, schedules, todayStr]);

    const prevMonth = () => {
        if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
        else setCurrentMonth(currentMonth - 1);
    };
    const nextMonth = () => {
        if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
        else setCurrentMonth(currentMonth + 1);
    };
    const goToday = () => { setCurrentMonth(today.getMonth()); setCurrentYear(today.getFullYear()); setSelectedDate(todayStr); };

    // Selected day schedules
    const selectedDaySchedules = selectedDate ? schedules.filter(s => s.next_service_date === selectedDate) : [];

    // Monthly stats
    const monthSchedules = schedules.filter(s => {
        const d = new Date(s.next_service_date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const monthCompleted = monthSchedules.filter(s => s.status === 'completed').length;
    const monthOverdue = monthSchedules.filter(s => s.status !== 'completed' && s.status !== 'cancelled' && s.next_service_date < todayStr).length;
    const monthPending = monthSchedules.filter(s => s.status !== 'completed' && s.status !== 'cancelled' && s.next_service_date >= todayStr).length;

    return (
        <div className="space-y-4">
            {/* Monthly Stats Bar */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="flex items-center gap-3 rounded-xl border border-slate-200/60 bg-white/70 px-4 py-3 dark:border-slate-800/60 dark:bg-slate-900/50">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
                        <span className="material-symbols-outlined text-violet-600 text-[18px]">calendar_month</span>
                    </div>
                    <div>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{monthSchedules.length}</p>
                        <p className="text-[10px] font-semibold uppercase text-slate-400">Este Mes</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-slate-200/60 bg-white/70 px-4 py-3 dark:border-slate-800/60 dark:bg-slate-900/50">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                        <span className="material-symbols-outlined text-amber-600 text-[18px]">pending_actions</span>
                    </div>
                    <div>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{monthPending}</p>
                        <p className="text-[10px] font-semibold uppercase text-slate-400">Pendientes</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-red-200/60 bg-white/70 px-4 py-3 dark:border-red-900/30 dark:bg-slate-900/50">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                        <span className="material-symbols-outlined text-red-600 text-[18px]">event_busy</span>
                    </div>
                    <div>
                        <p className="text-lg font-bold text-red-600">{monthOverdue}</p>
                        <p className="text-[10px] font-semibold uppercase text-slate-400">Vencidos</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200/60 bg-white/70 px-4 py-3 dark:border-emerald-900/30 dark:bg-slate-900/50">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                        <span className="material-symbols-outlined text-emerald-600 text-[18px]">check_circle</span>
                    </div>
                    <div>
                        <p className="text-lg font-bold text-emerald-600">{monthCompleted}</p>
                        <p className="text-[10px] font-semibold uppercase text-slate-400">Completados</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                {/* Calendar Grid */}
                <div className="xl:col-span-2 rounded-xl border border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50 overflow-hidden">
                    {/* Month Navigation */}
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <button onClick={prevMonth} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white">
                                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                            </button>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white min-w-[200px] text-center">
                                {MONTHS_ES[currentMonth]} {currentYear}
                            </h3>
                            <button onClick={nextMonth} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white">
                                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                            </button>
                        </div>
                        <button onClick={goToday} className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary/20">
                            <span className="material-symbols-outlined text-[14px]">today</span>
                            Hoy
                        </button>
                    </div>

                    {/* Day Headers */}
                    <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800">
                        {DAYS_ES.map(day => (
                            <div key={day} className="py-2.5 text-center text-xs font-bold uppercase tracking-wider text-slate-400">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Cells */}
                    <div className="grid grid-cols-7">
                        {calendarDays.map((day, idx) => {
                            const hasSchedules = day.schedules.length > 0;
                            const hasOverdue = day.schedules.some(s => s.status !== 'completed' && s.status !== 'cancelled' && day.dateStr < todayStr);
                            const allCompleted = day.schedules.length > 0 && day.schedules.every(s => s.status === 'completed');
                            const isSelected = selectedDate === day.dateStr;

                            return (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        setSelectedDate(day.dateStr);
                                        setSelectedSchedule(null);
                                        if (day.schedules.length === 0) onDayClick(day.dateStr);
                                    }}
                                    className={`relative flex min-h-[80px] flex-col items-start border-b border-r border-slate-100 px-2 py-1.5 text-left transition-all dark:border-slate-800/60
                                        ${!day.isCurrentMonth ? 'bg-slate-50/50 dark:bg-slate-900/30' : 'hover:bg-primary/5 dark:hover:bg-primary/5'}
                                        ${day.isToday ? 'bg-primary/5 dark:bg-primary/10' : ''}
                                        ${isSelected ? 'ring-2 ring-inset ring-primary bg-primary/10 dark:bg-primary/15' : ''}
                                    `}
                                >
                                    {/* Day Number */}
                                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold
                                        ${day.isToday ? 'bg-primary text-white' : ''}
                                        ${!day.isCurrentMonth ? 'text-slate-300 dark:text-slate-600' : 'text-slate-700 dark:text-slate-300'}
                                    `}>
                                        {day.date.getDate()}
                                    </span>

                                    {/* Schedule dots/pills */}
                                    {hasSchedules && (
                                        <div className="mt-0.5 flex w-full flex-col gap-0.5 overflow-hidden">
                                            {day.schedules.slice(0, 3).map(s => {
                                                let pillColor = 'bg-sky-500';
                                                if (s.status === 'completed') pillColor = 'bg-emerald-500';
                                                else if (s.status === 'cancelled') pillColor = 'bg-slate-300';
                                                else if (s.status === 'in_progress') pillColor = 'bg-amber-500';
                                                else if (s.status === 'confirmed') pillColor = 'bg-indigo-500';
                                                else if (day.dateStr < todayStr) pillColor = 'bg-red-500';

                                                return (
                                                    <div key={s.id} className={`flex items-center gap-1 rounded px-1 py-0.5 ${pillColor}/15`}>
                                                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${pillColor}`} />
                                                        <span className={`truncate text-[9px] font-semibold ${pillColor.replace('bg-', 'text-').replace('-500', '-700')} dark:${pillColor.replace('bg-', 'text-').replace('-500', '-400')}`}>
                                                            {s.title || SERVICE_TYPE_LABELS[s.service_type]}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                            {day.schedules.length > 3 && (
                                                <span className="text-[9px] font-semibold text-slate-400 pl-1">+{day.schedules.length - 3} más</span>
                                            )}
                                        </div>
                                    )}

                                    {/* Overdue indicator */}
                                    {hasOverdue && (
                                        <span className="absolute top-1 right-1 flex h-2 w-2">
                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                                        </span>
                                    )}

                                    {/* All completed checkmark */}
                                    {allCompleted && !hasOverdue && (
                                        <span className="absolute top-1 right-1 text-emerald-500">
                                            <span className="material-symbols-outlined text-[12px]">check_circle</span>
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
                        {[
                            { color: 'bg-sky-500', label: 'Programado' },
                            { color: 'bg-indigo-500', label: 'Confirmado' },
                            { color: 'bg-amber-500', label: 'En Proceso' },
                            { color: 'bg-emerald-500', label: 'Completado' },
                            { color: 'bg-red-500', label: 'Vencido' },
                        ].map(l => (
                            <span key={l.label} className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
                                <span className={`h-2.5 w-2.5 rounded-full ${l.color}`} />
                                {l.label}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Right Panel: Day Detail */}
                <div className="rounded-xl border border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50 overflow-hidden flex flex-col">
                    <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                        <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                            <span className="material-symbols-outlined text-primary text-[18px]">event_note</span>
                            {selectedDate
                                ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                                : 'Selecciona un día'
                            }
                        </h4>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                        {!selectedDate ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <span className="material-symbols-outlined text-[48px] text-slate-200 dark:text-slate-700 mb-3">event_note</span>
                                <p className="text-sm text-slate-500">Haz clic en un día del calendario para ver los servicios programados.</p>
                            </div>
                        ) : selectedDaySchedules.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <span className="material-symbols-outlined text-[48px] text-slate-200 dark:text-slate-700 mb-3">event_available</span>
                                <p className="text-sm text-slate-500">No hay servicios programados para este día.</p>
                                <button
                                    onClick={() => onDayClick(selectedDate)}
                                    className="mt-4 flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-md transition-all hover:bg-primary-dark"
                                >
                                    <span className="material-symbols-outlined text-[16px]">add</span>
                                    Programar Mantenimiento
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {selectedDaySchedules.map(s => (
                                    <DayScheduleCard
                                        key={s.id}
                                        schedule={s}
                                        isExpanded={selectedSchedule?.id === s.id}
                                        onToggle={() => setSelectedSchedule(selectedSchedule?.id === s.id ? null : s)}
                                        onStatusChange={onStatusChange}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* Detail card for side panel */
function DayScheduleCard({ schedule: s, isExpanded, onToggle, onStatusChange }: {
    schedule: MaintenanceSchedule;
    isExpanded: boolean;
    onToggle: () => void;
    onStatusChange: (id: string, status: ScheduleStatus) => void;
}) {
    const days = getDaysUntil(s.next_service_date);
    const statusColor = SCHEDULE_STATUS_COLORS[s.status] || SCHEDULE_STATUS_COLORS.scheduled;

    // Status-based accent color
    let accentColor = 'border-l-sky-500';
    if (s.status === 'completed') accentColor = 'border-l-emerald-500';
    else if (s.status === 'in_progress') accentColor = 'border-l-amber-500';
    else if (s.status === 'confirmed') accentColor = 'border-l-indigo-500';
    else if (days < 0) accentColor = 'border-l-red-500';

    return (
        <div className={`rounded-xl border border-slate-200/60 bg-white shadow-sm transition-all dark:border-slate-700/60 dark:bg-slate-800/80 border-l-4 ${accentColor} ${isExpanded ? 'ring-1 ring-primary/30' : 'hover:shadow-md'}`}>
            <button onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-left">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <span className="material-symbols-outlined text-primary text-[20px]">{SERVICE_TYPE_ICONS[s.service_type]}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{s.title || SERVICE_TYPE_LABELS[s.service_type]}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400">
                        {s.equipment?.well_name && <span>{s.equipment.well_name}</span>}
                        {s.equipment?.name && <><span>·</span><span className="truncate">{s.equipment.name}</span></>}
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColor.bg} ${statusColor.text}`}>
                        {SCHEDULE_STATUS_LABELS[s.status]}
                    </span>
                </div>
            </button>

            {isExpanded && (
                <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-700/60">
                    <div className="space-y-2 text-xs">
                        {s.client?.company_name && (
                            <div className="flex items-center gap-2 text-slate-500">
                                <span className="material-symbols-outlined text-[14px]">business</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">{s.client.company_name}</span>
                            </div>
                        )}
                        {s.assigned_to && (
                            <div className="flex items-center gap-2 text-slate-500">
                                <span className="material-symbols-outlined text-[14px]">person</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">{s.assigned_to}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2 text-slate-500">
                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                            <span className={`font-bold ${getUrgencyColor(days)}`}>
                                {days < 0 ? `${Math.abs(days)} días vencido` : days === 0 ? 'Hoy' : `En ${days} días`}
                            </span>
                        </div>
                        {s.frequency_months && (
                            <div className="flex items-center gap-2 text-slate-500">
                                <span className="material-symbols-outlined text-[14px]">repeat</span>
                                <span>Cada {s.frequency_months} meses</span>
                            </div>
                        )}
                        {s.description && (
                            <p className="mt-1 text-slate-500 italic">{s.description}</p>
                        )}
                    </div>

                    {/* Actions */}
                    {s.status !== 'completed' && s.status !== 'cancelled' && (
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-700/60">
                            {s.status === 'scheduled' && (
                                <button onClick={() => onStatusChange(s.id, 'confirmed')}
                                    className="flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-[11px] font-semibold text-indigo-600 transition-all hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40">
                                    <span className="material-symbols-outlined text-[14px]">check</span>Confirmar
                                </button>
                            )}
                            {(s.status === 'confirmed' || s.status === 'notified') && (
                                <button onClick={() => onStatusChange(s.id, 'in_progress')}
                                    className="flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-600 transition-all hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40">
                                    <span className="material-symbols-outlined text-[14px]">play_arrow</span>Iniciar
                                </button>
                            )}
                            {s.status === 'in_progress' && (
                                <button onClick={() => onStatusChange(s.id, 'completed')}
                                    className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-600 transition-all hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40">
                                    <span className="material-symbols-outlined text-[14px]">check_circle</span>Completar
                                </button>
                            )}
                            <button onClick={() => onStatusChange(s.id, 'completed')}
                                className="flex items-center gap-1 rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-500 transition-all hover:bg-slate-100 dark:bg-slate-700/30 dark:text-slate-400 dark:hover:bg-slate-700/60">
                                <span className="material-symbols-outlined text-[14px]">done_all</span>Marcar Completado
                            </button>
                            <button onClick={() => onStatusChange(s.id, 'cancelled')}
                                className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-500 transition-all hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40">
                                <span className="material-symbols-outlined text-[14px]">cancel</span>Cancelar
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function formatDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
