import { useState, useEffect, useRef } from 'react'
import { signOut } from 'firebase/auth'
import { auth, ADMIN_EMAIL } from './firebase'
import { subscribeNotifications, markRead } from './notifications'
import { LayoutDashboard, Building2, FileText, FolderOpen, ShieldCheck, List, ClipboardList, Settings2, Lock, Bell, User, LogOut, BookOpen, X, GitBranch } from 'lucide-react'
import LoginPage     from './pages/LoginPage'
import EmployeeView  from './pages/EmployeeView'
import Guide         from './pages/Guide'
import Dashboard     from './pages/Dashboard'
import InitCA        from './pages/InitCA'
import IssueCert     from './pages/IssueCert'
import Certificates  from './pages/Certificates'
import VerifyCert    from './pages/VerifyCert'
import RevokeCert    from './pages/RevokeCert'
import AuditLog      from './pages/AuditLog'
import CRL           from './pages/CRL'
import PolicyManager from './pages/PolicyManager'
import RequestPortal from './pages/RequestPortal'

const ADMIN_NAV = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard',         Icon: LayoutDashboard, component: <Dashboard /> },
    ],
  },
  {
    section: 'Certificates',
    items: [
      { label: 'CA Status',         Icon: Building2,    component: <InitCA /> },
      { label: 'Issue Certificate', Icon: FileText,     component: <IssueCert /> },
      { label: 'All Certificates',  Icon: FolderOpen,   component: <Certificates /> },
      { label: 'Verify & Revoke',   Icon: ShieldCheck,  component: <VerifyCert /> },
      { label: 'Revocation List',   Icon: List,         component: <CRL /> },
    ],
  },
  {
    section: 'Management',
    items: [
      { label: 'Cert Requests',     Icon: ClipboardList, component: <RequestPortal /> },
      { label: 'Policy Rules',      Icon: Settings2,     component: <PolicyManager /> },
      { label: 'Audit Log',         Icon: Lock,          component: <AuditLog /> },
    ],
  },
]

const ALL_ITEMS = ADMIN_NAV.flatMap(g => g.items)

export default function App() {
  const [role, setRole]   = useState(null)
  const [step, setStep]   = useState('landing')
  const [user, setUser]   = useState(null)
  const [active, setActive] = useState(0)
  const [adminNotifs, setAdminNotifs] = useState([])
  const bellRef = useRef(null)
  const [bellOpen, setBellOpen] = useState(false)

  // Subscribe to admin notifications when logged in as admin
  useEffect(() => {
    if (role !== 'admin') return
    const unsub = subscribeNotifications(ADMIN_EMAIL, setAdminNotifs)
    return unsub
  }, [role])

  // Close bell on outside click
  useEffect(() => {
    const handler = (e) => { if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unread = adminNotifs.filter(n => !n.read).length

  const handleBellClick = () => {
    setBellOpen(o => !o)
    if (!bellOpen) adminNotifs.filter(n => !n.read).forEach(n => markRead(ADMIN_EMAIL, n.id))
  }

  function selectRole(r) { setRole(r); setStep('login') }

  function handleLoginSuccess(userData) { setUser(userData); setStep('app') }

  function handleLogout() {
    signOut(auth).catch(() => {})
    setRole(null); setUser(null); setStep('landing')
  }

  if (step === 'landing') return <LandingPage onSelect={selectRole} />
  if (step === 'login')   return <LoginPage role={role} onSuccess={handleLoginSuccess} onBack={() => setStep('landing')} />
  if (role === 'employee') return <EmployeeView onSwitchRole={handleLogout} user={user} />

  // Admin view
  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="header-logo"><Lock size={22} color='#a78bfa' /></div>
          <div>
            <h1>Certificate Authority</h1>
            <div className="header-subtitle">Admin Panel</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="header-badges">
            <span className="header-badge purple">RSA-2048</span>
            <span className="header-badge purple">X.509 v3</span>
            <span className="header-badge cyan">OCSP</span>
            <span className="header-badge">SHA-256</span>
          </div>
          <span style={{ color: 'var(--text-dim)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}><User size={13} /> {user?.name}</span>

          {/* Admin notification bell */}
          <div ref={bellRef} style={{ position: 'relative' }}>
            <button onClick={handleBellClick} style={{
              background: unread > 0 ? 'rgba(124,58,237,0.15)' : 'transparent',
              border: unread > 0 ? '1px solid rgba(124,58,237,0.4)' : '1px solid var(--border)',
              borderRadius: '8px', padding: '6px 10px', cursor: 'pointer',
              fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <Bell size={16} />
              {unread > 0 && (
                <span style={{ background: '#7c3aed', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '11px', fontWeight: 700 }}>
                  {unread}
                </span>
              )}
            </button>
            {bellOpen && (
              <div style={{
                position: 'absolute', right: 0, top: '110%', width: '320px', zIndex: 200,
                background: 'var(--panel)', border: '1px solid var(--border)',
                borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden',
              }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', color: '#fff', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}><Bell size={14} /> Notifications</div>
                {adminNotifs.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No notifications yet</div>
                ) : (
                  <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                    {adminNotifs.map(n => (
                      <div key={n.id} style={{
                        padding: '12px 16px', borderBottom: '1px solid var(--border)',
                        background: n.read ? 'transparent' : 'rgba(124,58,237,0.07)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span>{n.type === 'new_request' ? <ClipboardList size={14} color='#a78bfa' /> : <Bell size={14} color='#a78bfa' />}</span>
                          <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: '13px' }}>{n.title}</span>
                          {!n.read && <span style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#7c3aed', flexShrink: 0 }} />}
                        </div>
                        <div style={{ color: 'var(--text-dim)', fontSize: '12px', lineHeight: 1.5 }}>{n.message}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>
                          {n.createdAt?.toDate?.()?.toLocaleString() || ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <button onClick={handleLogout} style={{
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text-dim)', borderRadius: '8px', padding: '6px 14px',
            cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      </header>

      <div className="body-wrap">
        <nav className="sidebar">
          {ADMIN_NAV.map((group) => (
            <div key={group.section}>
              <div className="sidebar-section-label">{group.section}</div>
              {group.items.map((item) => {
                const idx = ALL_ITEMS.indexOf(item)
                return (
                  <button
                    key={item.label}
                    className={`nav-btn${active === idx ? ' active' : ''}`}
                    onClick={() => setActive(idx)}
                  >
                    <span className="nav-icon"><item.Icon size={15} /></span>
                    {item.label}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <main className="main-content">
          {ALL_ITEMS[active].component}
        </main>
      </div>

      <GuidePopup />
    </div>
  )
}

function GuidePopup() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
          width: '48px', height: '48px', borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
          border: 'none', cursor: 'pointer', fontSize: '1.3rem',
          boxShadow: '0 4px 20px var(--accent-glow)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.2s ease',
        }}
        title="Open Guide"
      >
        <BookOpen size={20} color='#fff' />
      </button>
      {open && (
        <div style={{
          position: 'fixed', bottom: '84px', right: '24px', zIndex: 999,
          width: '480px', maxHeight: '70vh', overflowY: 'auto',
          background: 'var(--panel)', border: '1px solid var(--border)',
          borderRadius: '16px', boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          padding: '0',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px', borderBottom: '1px solid var(--border)',
            position: 'sticky', top: 0, background: 'var(--panel)', zIndex: 1,
          }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}><BookOpen size={15} /> Guide</span>
            <button onClick={() => setOpen(false)} style={{
              background: 'none', border: 'none', color: 'var(--text-dim)',
              cursor: 'pointer', lineHeight: 1,
            }}><X size={18} /></button>
          </div>
          <div style={{ padding: '20px' }}>
            <Guide />
          </div>
        </div>
      )}
    </>
  )
}

/* ── Landing Page ── */
function LandingPage({ onSelect }) {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '2rem',
    }}>
      {/* Logo */}
        <div style={{
        width: 72, height: 72, borderRadius: '20px', marginBottom: '1.5rem',
        background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 40px var(--accent-glow)',
      }}><Lock size={32} color='#fff' /></div>

      <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem', textAlign: 'center', letterSpacing: '-0.5px' }}>
        Digital Certificate Authority
      </h1>
      <p style={{ color: 'var(--text-dim)', fontSize: '15px', marginBottom: '3rem', textAlign: 'center', maxWidth: '420px', lineHeight: 1.7 }}>
        A self-managing PKI system for issuing, verifying, and revoking digital certificates.
      </p>

      {/* Role cards */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '700px' }}>
        <RoleCard
          Icon={User}
          title="I'm an Employee"
          subtitle="Request or check a certificate"
          points={['Request a certificate for VPN, email, or web', 'Download your existing certificates', 'Check if a certificate is still valid']}
          color="var(--accent2)"
          glow="var(--accent2-glow)"
          onClick={() => onSelect('employee')}
        />
        <RoleCard
          Icon={ShieldCheck}
          title="I'm an IT Admin"
          subtitle="Manage the certificate authority"
          points={['Issue and revoke certificates', 'Set up automation policies', 'View audit logs and dashboard', 'Approve certificate requests']}
          color="var(--accent)"
          glow="var(--accent-glow)"
          onClick={() => onSelect('admin')}
        />
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '3rem', textAlign: 'center' }}>
        Not sure? Read the <button onClick={() => onSelect('admin')} style={{ background: 'none', border: 'none', color: '#c4b5fd', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>Guide</button> in the Admin panel.
      </p>
    </div>
  )
}

function RoleCard({ Icon, title, subtitle, points, color, glow, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? `rgba(${color === 'var(--accent2)' ? '6,182,212' : '124,58,237'},0.08)` : 'var(--panel)',
        border: `1px solid ${hovered ? color : 'var(--border)'}`,
        borderRadius: '16px', padding: '28px 32px', cursor: 'pointer',
        width: '300px', transition: 'all 0.2s ease',
        boxShadow: hovered ? `0 8px 32px ${glow}` : 'none',
        transform: hovered ? 'translateY(-4px)' : 'none',
      }}
    >
      <div style={{ marginBottom: '1rem' }}><Icon size={40} color={color} /></div>
      <div style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.3rem' }}>{title}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '1.2rem' }}>{subtitle}</div>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {points.map(p => (
          <li key={p} style={{ color: 'var(--text-dim)', fontSize: '13px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span style={{ color, flexShrink: 0, marginTop: '1px' }}>✓</span> {p}
          </li>
        ))}
      </ul>
      <div style={{
        marginTop: '1.5rem', padding: '10px', borderRadius: '8px', textAlign: 'center',
        background: `linear-gradient(135deg, ${color === 'var(--accent2)' ? 'var(--accent2), #0891b2' : 'var(--accent), #6d28d9'})`,
        color: '#fff', fontWeight: 600, fontSize: '13px',
        boxShadow: `0 4px 14px ${glow}`,
      }}>
        Enter as {title.split("'")[1] || title} →
      </div>
    </div>
  )
}
