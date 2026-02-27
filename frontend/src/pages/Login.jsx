import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { Video, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Login() {
  const [form, setForm]     = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const { login } = useAuth()
  const navigate  = useNavigate()

  const handle = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await authAPI.login(form)
      login(res.data)
      toast.success(`Welcome back, ${res.data.username}!`)
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen auth-bg flex">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex w-[48%] flex-col items-center justify-center p-16 relative overflow-hidden">
        {/* decorative blobs */}
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-brand-purple/15 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-brand-cyan/12 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />

        <div className="relative z-10 max-w-sm text-center">
          <div className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center mb-6 animate-float shadow-2xl"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}>
            <Video size={36} className="text-white" />
          </div>
          <h1 className="text-5xl font-black mb-3 grad-text">VideoIQ</h1>
          <p className="text-slate-400 text-lg mb-10">AI-powered educational video QA platform</p>

          <div className="space-y-3 text-left">
            {[
              ['🎯', 'Progressive 3-pass AI review'],
              ['⚡', 'Parallel multi-video processing'],
              ['🔍', 'Audio-visual mismatch detection'],
              ['📊', 'Team collaboration & history'],
            ].map(([icon, text]) => (
              <div key={text} className="glass flex items-center gap-3 px-4 py-3">
                <span className="text-xl">{icon}</span>
                <span className="text-slate-300 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right / form ── */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md animate-slide-up">
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#7c3aed,#06b6d4)' }}>
              <Video size={16} className="text-white" />
            </div>
            <span className="text-2xl font-black grad-text">VideoIQ</span>
          </div>

          <div className="glass p-8">
            <h2 className="text-2xl font-bold text-white mb-1">Sign in</h2>
            <p className="text-slate-500 text-sm mb-7">Access your review dashboard</p>

            <form onSubmit={handle} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Email</label>
                <input
                  type="email" required
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="you@company.com"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'} required
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••"
                    className="input pr-11"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
                {loading
                  ? <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Signing in…</>
                  : 'Sign In'
                }
              </button>
            </form>

            <p className="text-center text-slate-500 text-sm mt-6">
              No account?{' '}
              <Link to="/register" className="text-purple-400 hover:text-purple-300 font-semibold transition-colors">
                Create one free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
