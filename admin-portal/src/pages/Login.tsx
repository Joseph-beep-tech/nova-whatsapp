import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden">
        {/* Background texture */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #C9A84C 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800" />

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gold-500 rounded-xl flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 5C3 3.9 3.9 3 5 3h10c1.1 0 2 .9 2 2v2H3V5z" fill="white"/>
                <path d="M3 9h14v6c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V9z" fill="white" fillOpacity=".7"/>
                <circle cx="7" cy="14" r="1.5" fill="white"/>
                <circle cx="13" cy="14" r="1.5" fill="white"/>
              </svg>
            </div>
            <div>
              <p className="text-white font-bold text-lg tracking-tight">NovaGo</p>
              <p className="text-slate-400 text-xs">Restaurant Management</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <div>
            <h1 className="font-display text-5xl text-white leading-tight">
              The operating system<br />
              <span className="text-gold-500">for modern restaurants.</span>
            </h1>
            <p className="text-slate-400 mt-4 text-base leading-relaxed max-w-sm">
              AI-powered ordering, voice customer care, WhatsApp automation, and real-time analytics — all in one place.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { value: '99.9%', label: 'Uptime SLA' },
              { value: 'AI-First', label: 'Order Engine' },
              { value: 'M-Pesa', label: 'Payments' },
            ].map((s) => (
              <div key={s.label} className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
                <p className="text-gold-400 font-bold text-xl">{s.value}</p>
                <p className="text-slate-400 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-slate-600 text-xs">© 2025 NovaGo Technologies. All rights reserved.</p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-surface">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-9 h-9 bg-gold-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">N</span>
            </div>
            <span className="font-bold text-xl text-gray-900">NovaGo</span>
          </div>

          <div className="mb-8">
            <h2 className="font-display text-3xl text-gray-900">Welcome back</h2>
            <p className="text-gray-500 mt-1 text-sm">Sign in to your management portal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                required className="input-field" placeholder="you@novago.com" autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required className="input-field pr-10" placeholder="••••••••" autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full py-3 text-base">
              {loading ? <Loader2 size={18} className="animate-spin" /> : 'Sign In'}
            </button>
          </form>

          <div className="mt-8 p-4 bg-surface-muted rounded-xl border border-surface-border">
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Demo Access</p>
            <div className="space-y-1.5">
              {[
                { role: 'Admin', creds: 'admin@novago.com / admin123' },
                { role: 'Restaurant', creds: 'restaurant@novago.com / restaurant123' },
              ].map((d) => (
                <button key={d.role} onClick={() => { const [e, p] = d.creds.split(' / '); setEmail(e); setPassword(p); }}
                  className="w-full flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-surface-border hover:border-gold-400 hover:shadow-sm transition-all text-left group">
                  <span className="text-xs font-medium text-gray-600 group-hover:text-gold-600">{d.role}</span>
                  <span className="text-xs font-mono text-gray-400 group-hover:text-gray-600">{d.creds}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
