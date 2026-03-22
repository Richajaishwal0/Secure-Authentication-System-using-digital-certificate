import { useState } from 'react'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { auth, ADMIN_EMAIL } from '../firebase'
import { Lock, AlertTriangle } from 'lucide-react'

export default function LoginPage({ role, onSuccess, onBack }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const isAdmin = role === 'admin'

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) { setError('Enter email and password.'); return }

    // Admin must use the fixed admin email
    if (isAdmin && email !== ADMIN_EMAIL) {
      setError('Only the admin account can access the admin panel.')
      return
    }
    // Employee must NOT use the admin email
    if (!isAdmin && email === ADMIN_EMAIL) {
      setError('Admin account cannot log in as employee.')
      return
    }

    setLoading(true); setError('')
    try {
      let userCred
      if (isSignUp && !isAdmin) {
        userCred = await createUserWithEmailAndPassword(auth, email, password)
      } else {
        userCred = await signInWithEmailAndPassword(auth, email, password)
      }
      const user = userCred.user
      onSuccess({
        uid:   user.uid,
        email: user.email,
        role,
        name:  user.displayName || email.split('@')[0],
      })
    } catch (e) {
      const msg = {
        'auth/user-not-found':     'No account found with this email.',
        'auth/wrong-password':     'Incorrect password.',
        'auth/invalid-credential': 'Incorrect email or password.',
        'auth/email-already-in-use': 'An account with this email already exists.',
        'auth/weak-password':      'Password must be at least 6 characters.',
        'auth/invalid-email':      'Invalid email address.',
      }
      setError(msg[e.code] || e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '2rem',
    }}>
      {/* Logo */}
      <div style={{
        width: 56, height: 56, borderRadius: '16px', marginBottom: '1.2rem',
        background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.6rem', boxShadow: '0 0 32px var(--accent-glow)',
      }}><Lock size={26} color='#fff' /></div>

      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', marginBottom: '0.3rem', letterSpacing: '-0.5px' }}>
        {isAdmin ? 'Admin Login' : isSignUp ? 'Create Employee Account' : 'Employee Login'}
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '2rem' }}>
        {isAdmin
          ? 'Sign in to manage the Certificate Authority'
          : isSignUp
            ? 'Create your account to request certificates'
            : 'Sign in to request and view your certificates'}
      </p>

      <form onSubmit={handleSubmit} style={{
        background: 'var(--panel)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '380px',
      }}>
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label>Email</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder={isAdmin ? 'admin@gmail.com' : 'you@example.com'}
            autoFocus
          />
        </div>

        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label>Password</label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '8px', padding: '10px 14px', color: '#f87171',
            fontSize: '13px', marginBottom: '1rem',
          }}>
            <AlertTriangle size={14} style={{ flexShrink: 0 }} /> {error}
          </div>
        )}

        <button type="submit" className="btn" disabled={loading}
          style={{ width: '100%', justifyContent: 'center' }}>
          {loading
            ? <><span className="btn-spinner" /> Please wait…</>
            : isSignUp ? 'Create Account →' : `Sign in as ${isAdmin ? 'Admin' : 'Employee'} →`}
        </button>

        {/* Sign up toggle — employees only */}
        {!isAdmin && (
          <div style={{ textAlign: 'center', marginTop: '1.2rem', fontSize: '13px', color: 'var(--text-muted)' }}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <button type="button" onClick={() => { setIsSignUp(s => !s); setError('') }}
              style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </div>
        )}
      </form>

      <button onClick={onBack} style={{
        marginTop: '1.5rem', background: 'none', border: 'none',
        color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px',
      }}>
        ← Back to role selection
      </button>
    </div>
  )
}
