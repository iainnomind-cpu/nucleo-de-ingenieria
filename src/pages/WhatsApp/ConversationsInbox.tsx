import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    WaConversation, WaMessage,
    CONVERSATION_STATUS_LABELS, ConversationStatus,
    WA_MESSAGE_STATUS_ICONS,
    formatPhoneNumber, timeAgoWa,
} from '../../types/whatsapp';

export default function ConversationsInbox() {
    const navigate = useNavigate();
    const [conversations, setConversations] = useState<WaConversation[]>([]);
    const [messages, setMessages] = useState<WaMessage[]>([]);
    const [selectedConv, setSelectedConv] = useState<WaConversation | null>(null);
    const [loading, setLoading] = useState(true);
    const [input, setInput] = useState('');
    const [filterStatus, setFilterStatus] = useState<ConversationStatus | 'all'>('all');
    const [search, setSearch] = useState('');
    const [showNewConv, setShowNewConv] = useState(false);
    const [newConvForm, setNewConvForm] = useState({ phone_number: '', client_name: '' });
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const fetchConversations = useCallback(async () => {
        let query = supabase.from('wa_conversations').select('*, client:clients(id, company_name)').order('last_message_at', { ascending: false });
        if (filterStatus !== 'all') query = query.eq('status', filterStatus);
        const { data } = await query;
        setConversations((data as WaConversation[]) || []);
        setLoading(false);
    }, [filterStatus]);

    const fetchMessages = useCallback(async (convId: string) => {
        const { data } = await supabase.from('wa_messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: true });
        setMessages((data as WaMessage[]) || []);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    }, []);

    useEffect(() => { fetchConversations(); }, [fetchConversations]);

    useEffect(() => {
        if (selectedConv) fetchMessages(selectedConv.id);
    }, [selectedConv, fetchMessages]);

    const selectConv = (conv: WaConversation) => {
        setSelectedConv(conv);
        // Mark as read
        if (conv.unread_count > 0) {
            supabase.from('wa_conversations').update({ unread_count: 0 }).eq('id', conv.id).then(() => fetchConversations());
        }
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !selectedConv) return;
        
        const messageText = input.trim();
        setInput(''); // clear early for UI responsiveness
        
        try {
            const res = await fetch('/api/whatsapp-send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: selectedConv.phone_number,
                    type: 'text',
                    text: messageText,
                    conversation_id: selectedConv.id
                })
            });
            const data = await res.json();
            if (!data.success) {
                alert(`Error al enviar mensaje: ${data.message}`);
                // Restore input on failure
                setInput(messageText);
            }
        } catch (error) {
            console.error('Network error sending message:', error);
            alert('Error de conectividad al intentar enviar el mensaje.');
            setInput(messageText);
        }
        
        // Refresh UI
        fetchMessages(selectedConv.id);
        fetchConversations();
    };

    const createConversation = async (e: React.FormEvent) => {
        e.preventDefault();
        const { data } = await supabase.from('wa_conversations').insert({
            phone_number: newConvForm.phone_number,
            client_name: newConvForm.client_name || null,
            status: 'active',
        }).select().single();
        if (data) {
            setShowNewConv(false);
            setNewConvForm({ phone_number: '', client_name: '' });
            fetchConversations();
            setSelectedConv(data as WaConversation);
        }
    };

    const filteredConvs = conversations.filter(c => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (c.client_name || '').toLowerCase().includes(s) || c.phone_number.includes(s);
    });

    const tabs = [
        { label: 'Dashboard', icon: 'space_dashboard', path: '/whatsapp' },
        { label: 'Conversaciones', icon: 'chat', path: '/whatsapp/conversations' },
        { label: 'Envío Directo', icon: 'send', path: '/whatsapp/send' },
        { label: 'Campañas', icon: 'campaign', path: '/whatsapp/campaigns' },
        { label: 'Plantillas', icon: 'description', path: '/whatsapp/templates' },
        { label: 'Reportes', icon: 'analytics', path: '/whatsapp/reports' },
        { label: 'Automatizaciones', icon: 'bolt', path: '/whatsapp/automations' },
    ];

    const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            {/* Header with tabs */}
            <div className="border-b border-slate-200 bg-white/80 backdrop-blur-lg dark:border-slate-800 dark:bg-slate-900/80">
                <div className="px-6 pt-6 pb-0">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
                            <span className="material-symbols-outlined text-white text-[22px]">chat</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 dark:text-white">WhatsApp Marketing</h1>
                            <p className="text-xs text-slate-500">Bandeja de entrada unificada</p>
                        </div>
                    </div>
                    <div className="flex gap-1">
                        {tabs.map(tab => (
                            <button key={tab.path} onClick={() => navigate(tab.path)}
                                className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2.5 text-xs font-semibold transition-all ${tab.path === '/whatsapp/conversations'
                                        ? 'bg-white text-emerald-700 border-b-2 border-emerald-500 dark:bg-slate-800 dark:text-emerald-400'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                    }`}>
                                <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Inbox area */}
            <div className="flex flex-1 overflow-hidden">
                {/* Conversation list sidebar */}
                <div className="flex w-80 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    {/* Search + filter */}
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="relative mb-2">
                            <span className="material-symbols-outlined absolute left-3 top-2.5 text-[16px] text-slate-400">search</span>
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar conversación..."
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                        </div>
                        <div className="flex gap-1">
                            {(['all', 'active', 'archived'] as const).map(st => (
                                <button key={st} onClick={() => setFilterStatus(st)}
                                    className={`flex-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold transition-all ${filterStatus === st ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                    {st === 'all' ? 'Todas' : CONVERSATION_STATUS_LABELS[st]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* New conversation button */}
                    <button onClick={() => setShowNewConv(true)} className="flex items-center gap-2 mx-3 mt-3 rounded-lg border border-dashed border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-600 transition-all hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/20">
                        <span className="material-symbols-outlined text-[16px]">add</span>Nueva Conversación
                    </button>

                    {/* Conversation list */}
                    <div className="flex-1 overflow-y-auto mt-2">
                        {loading ? (
                            <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" /></div>
                        ) : filteredConvs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                <span className="material-symbols-outlined text-[40px] mb-2">chat_bubble_outline</span>
                                <p className="text-xs">Sin conversaciones</p>
                            </div>
                        ) : (
                            filteredConvs.map(conv => (
                                <button key={conv.id} onClick={() => selectConv(conv)}
                                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-all ${selectedConv?.id === conv.id ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                    <div className="relative">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-bold">
                                            {(conv.client_name || conv.phone_number).slice(0, 2).toUpperCase()}
                                        </div>
                                        {conv.unread_count > 0 && (
                                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">{conv.unread_count}</span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{conv.client_name || formatPhoneNumber(conv.phone_number)}</p>
                                            {conv.last_message_at && <span className="text-[10px] text-slate-400 ml-1 flex-shrink-0">{timeAgoWa(conv.last_message_at)}</span>}
                                        </div>
                                        <p className="text-[11px] text-slate-400 truncate">{conv.last_message_preview || 'Sin mensajes'}</p>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Chat area */}
                <div className="flex flex-1 flex-col bg-slate-50 dark:bg-slate-950">
                    {!selectedConv ? (
                        <div className="flex flex-1 items-center justify-center">
                            <div className="text-center">
                                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-100 mx-auto mb-4 dark:bg-emerald-900/30">
                                    <span className="material-symbols-outlined text-emerald-500 text-[40px]">chat</span>
                                </div>
                                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Selecciona una conversación</p>
                                <p className="text-xs text-slate-400 mt-1">o crea una nueva para comenzar</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Chat header */}
                            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-bold">
                                        {(selectedConv.client_name || selectedConv.phone_number).slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{selectedConv.client_name || formatPhoneNumber(selectedConv.phone_number)}</h3>
                                        <p className="text-[11px] text-slate-400">{formatPhoneNumber(selectedConv.phone_number)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {selectedConv.client_id && (
                                        <button onClick={() => navigate('/crm/' + selectedConv.client_id)} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                                            <span className="material-symbols-outlined text-[14px]">person</span>Ver en CRM
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto px-5 py-4">
                                <div className="mx-auto max-w-2xl space-y-3">
                                    {messages.map(msg => {
                                        const isOutbound = msg.direction === 'outbound';
                                        return (
                                            <div key={msg.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${isOutbound
                                                        ? 'bg-emerald-500 text-white rounded-br-md'
                                                        : 'bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-200 rounded-bl-md'
                                                    }`}>
                                                    {msg.message_type === 'location' && msg.location_lat && msg.location_lng && (
                                                        <a href={`https://www.google.com/maps?q=${msg.location_lat},${msg.location_lng}`}
                                                            target="_blank" rel="noopener noreferrer"
                                                            className={`flex items-center gap-1 mb-1 text-xs font-medium ${isOutbound ? 'text-emerald-100' : 'text-emerald-600'}`}>
                                                            <span className="material-symbols-outlined text-[14px]">location_on</span>
                                                            {msg.location_label || 'Ver ubicación'}
                                                        </a>
                                                    )}
                                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                                    <div className={`flex items-center gap-1 mt-1 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                                                        <span className={`text-[10px] ${isOutbound ? 'text-emerald-200' : 'text-slate-400'}`}>{timeAgoWa(msg.created_at)}</span>
                                                        {isOutbound && (
                                                            <span className={`material-symbols-outlined text-[12px] ${msg.status === 'read' ? 'text-sky-300' : 'text-emerald-200'}`}>
                                                                {WA_MESSAGE_STATUS_ICONS[msg.status]}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </div>
                            </div>

                            {/* Input */}
                            <form onSubmit={sendMessage} className="border-t border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
                                <div className="flex items-center gap-2">
                                    <input value={input} onChange={e => setInput(e.target.value)} placeholder="Escribe un mensaje..."
                                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                                    <button type="submit" className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600 transition-all">
                                        <span className="material-symbols-outlined text-[20px]">send</span>
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </div>
            </div>

            {/* New Conversation Modal */}
            {showNewConv && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <form onSubmit={createConversation} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
                        <h3 className="mb-4 text-base font-bold text-slate-900 dark:text-white">Nueva Conversación WhatsApp</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Número de Teléfono *</label>
                                <input value={newConvForm.phone_number} onChange={e => setNewConvForm({ ...newConvForm, phone_number: e.target.value })} placeholder="+52 (XXX) XXX-XXXX" required className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Nombre del Cliente</label>
                                <input value={newConvForm.client_name} onChange={e => setNewConvForm({ ...newConvForm, client_name: e.target.value })} placeholder="Nombre del contacto" className={inputClass} />
                            </div>
                        </div>
                        <div className="mt-5 flex gap-2">
                            <button type="submit" className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600">Crear</button>
                            <button type="button" onClick={() => setShowNewConv(false)} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm text-slate-500 dark:border-slate-700">Cancelar</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
