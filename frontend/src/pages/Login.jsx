import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { login } = useAuth();
  const navigate   = useNavigate();
  const location   = useLocation();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      const storedRedirect = window.sessionStorage.getItem('postLoginRedirect');
      window.sessionStorage.removeItem('postLoginRedirect');
      const intended = location.state?.from
        ? `${location.state.from.pathname || ''}${location.state.from.search || ''}`
        : storedRedirect;
      if (intended && intended !== '/login') {
        navigate(intended, { replace: true });
        return;
      }
      if (user.role === 'admin' || user.role === 'coordinator') {
        navigate('/admin');
      } else {
        navigate('/score');
      }
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.page}>
      {/* Maroon header band */}
      <div style={s.headerBand} />

      <div style={s.card}>
        {/* Logo */}
        <div style={s.logoWrap}>
          <img src="/wyh-logo.jpeg" alt="Weymouth Youth Hockey" style={s.logo} />
        </div>

        <h1 style={s.title}>Weymouth Youth Hockey</h1>
        <p style={s.subtitle}>Tryout Management Portal</p>
        <div style={s.divider} />

        <form onSubmit={handleSubmit}>
          <div style={s.field}>
            <label style={s.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div style={s.errorBox}>{error}</div>
          )}

          <button type="submit" disabled={loading} style={{ ...s.btn, opacity: loading ? 0.75 : 1 }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={s.footer}>Weymouth, MA · Youth Hockey</p>
      </div>
    </div>
  );
}

const s = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '24px',
    background: 'var(--bg)',
    position: 'relative',
    overflow: 'hidden',
  },
  headerBand: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    background: 'linear-gradient(90deg, var(--maroon) 0%, var(--gold) 50%, var(--maroon) 100%)',
  },
  card: {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '36px 40px 28px',
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    position: 'relative',
  },
  logoWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 90,
    height: 90,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '3px solid var(--gold)',
    boxShadow: '0 0 0 4px var(--maroon-bg), 0 4px 16px rgba(240,180,41,0.25)',
  },
  title: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 4,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 13,
    color: 'var(--gold)',
    marginBottom: 0,
    letterSpacing: '0.03em',
  },
  divider: {
    height: 1,
    background: 'linear-gradient(90deg, transparent, var(--gold-dark), transparent)',
    margin: '20px 0',
    opacity: 0.5,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    marginBottom: 6,
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text2)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  errorBox: {
    background: 'var(--red-bg)',
    color: 'var(--red-txt)',
    border: '1px solid var(--red)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 14px',
    fontSize: 13,
    marginBottom: 16,
  },
  btn: {
    width: '100%',
    padding: '11px',
    background: 'var(--maroon)',
    color: '#fff',
    border: '1px solid var(--maroon-light)',
    borderRadius: 'var(--radius-sm)',
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
    letterSpacing: '0.04em',
    transition: 'background 0.15s',
    marginTop: 4,
  },
  footer: {
    textAlign: 'center',
    fontSize: 11,
    color: 'var(--text3)',
    marginTop: 24,
    letterSpacing: '0.05em',
  },
};
