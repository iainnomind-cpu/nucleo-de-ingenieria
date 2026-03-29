import { useState, FormEvent } from 'react';
import { useAuth } from '../../lib/AuthContext';

export default function Login() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(email, password);
        if (!result.success) {
            setError(result.message || 'Error al iniciar sesión');
        }
        setLoading(false);
    };

    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-4">
            {/* Background decoration */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
                <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl" />
                <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />
            </div>

            {/* Login Card */}
            <div className="relative w-full max-w-md">
                {/* Logo */}
                <div className="mb-8 flex flex-col items-center gap-4">
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-2xl shadow-indigo-500/30">
                        <img src="/logo.png" alt="Logo de la empresa" className="h-full w-full object-contain p-2" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-3xl font-bold text-white">Núcleo de Ingeniería ERP</h1>
                        <p className="mt-1 text-sm font-medium text-slate-400">Engineering Hub — Iniciar Sesión</p>
                    </div>
                </div>

                {/* Card */}
                <form
                    onSubmit={handleSubmit}
                    className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl"
                >
                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
                            <span className="material-symbols-outlined text-red-400 text-[20px]">error</span>
                            <span className="font-medium text-red-300">{error}</span>
                        </div>
                    )}

                    {/* Email */}
                    <div className="mb-5">
                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                            Correo electrónico
                        </label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-[20px]">
                                mail
                            </span>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                autoFocus
                                placeholder="usuario@empresa.com"
                                className="w-full rounded-xl border border-white/10 bg-white/5 py-3.5 pl-12 pr-4 text-sm font-medium text-white outline-none transition-all placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="mb-6">
                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                            Contraseña
                        </label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-[20px]">
                                lock
                            </span>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                                className="w-full rounded-xl border border-white/10 bg-white/5 py-3.5 pl-12 pr-12 text-sm font-medium text-white outline-none transition-all placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[20px]">
                                    {showPassword ? 'visibility_off' : 'visibility'}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading || !email || !password}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition-all hover:shadow-xl hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                    >
                        {loading ? (
                            <>
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Verificando...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-[20px]">login</span>
                                Ingresar al Sistema
                            </>
                        )}
                    </button>
                </form>

                {/* Footer */}
                <p className="mt-6 text-center text-xs text-slate-500">
                    Núcleo de Ingeniería © {new Date().getFullYear()} — Sistema ERP v2.0
                </p>
            </div>
        </div>
    );
}
