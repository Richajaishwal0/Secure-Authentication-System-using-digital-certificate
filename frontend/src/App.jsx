import { useState } from 'react'
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
      { label: 'Guide',              icon: '📖', component: <Guide /> },
      { label: 'Dashboard',          icon: '📊', component: <Dashboard /> },
    ],
  },
  {
    section: 'Certificates',
    items: [
      { label: 'Setup CA',           icon: '🏛️', component: <InitCA /> },
      { label: 'Issue Certificate',  icon: '📜', component: <IssueCert /> },
      { label: 'All Certificates',   icon: '🗂️', component: <Certificates /> },
      { label: 'Verify & Revoke',    icon: '✅', component: <VerifyCert /> },
      { label: 'Revocation List',    icon: '📄', component: <CRL /> },
    ],
  },
  {
    section: 'Management',
    items: [
      { label: 'Cert Requests',      icon: '📝', component: <RequestPortal /> },
      { label: 'Policy Rules',       icon: '⚙️', component: <PolicyManager /> },
      { label: 'Audit Log',          icon: '🔐', component: <AuditLog /> },
    ],
  },
]

const ALL_ITEMS = ADMIN_NAV.flatMap(g => g.items)

export default function App() {
  const [role, setRole]     = useState(null)   // null = landing, 'employee', 'admin'
  const [active, setActive] = useState(0)

  if (!role) return <LandingPage onSelect={setRole} />
  if (role === 'employee') return <EmployeeView onSwitchRole={() => setRole(null)} />

  // Admin view
  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="header-logo">🔐</div>
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
          <button onClick={() => setRole(null)} style={{
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text-dim)', borderRadius: '8px', padding: '6px 14px',
            cursor: 'pointer', fontSize: '12px',
          }}>
            Switch Role
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
                    <span className="nav-icon">{item.icon}</span>
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
    </div>
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
        fontSize: '2rem', boxShadow: '0 0 40px var(--accent-glow)',
      }}>🔐</div>

      <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem', textAlign: 'center', letterSpacing: '-0.5px' }}>
        Digital Certificate Authority
      </h1>
      <p style={{ color: 'var(--text-dim)', fontSize: '15px', marginBottom: '3rem', textAlign: 'center', maxWidth: '420px', lineHeight: 1.7 }}>
        A self-managing PKI system for issuing, verifying, and revoking digital certificates.
      </p>

      {/* Role cards */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '700px' }}>
        <RoleCard
          icon="👤"
          title="I'm an Employee"
          subtitle="Request or check a certificate"
          points={['Request a certificate for VPN, email, or web', 'Download your existing certificates', 'Check if a certificate is still valid']}
          color="var(--accent2)"
          glow="var(--accent2-glow)"
          onClick={() => onSelect('employee')}
        />
        <RoleCard
          icon="🛡️"
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

function RoleCard({ icon, title, subtitle, points, color, glow, onClick }) {
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
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{icon}</div>
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
