import { useState } from 'react'
import InitCA         from './pages/InitCA'
import IssueCert      from './pages/IssueCert'
import Certificates   from './pages/Certificates'
import VerifyCert     from './pages/VerifyCert'
import RevokeCert     from './pages/RevokeCert'
import AuditLog       from './pages/AuditLog'
import CRL            from './pages/CRL'
import IntermediateCA from './pages/IntermediateCA'
import Templates      from './pages/Templates'
import ACME           from './pages/ACME'
import OCSP           from './pages/OCSP'

const NAV = [
  {
    section: 'Certificate Authority',
    items: [
      { label: 'Init CA',         icon: '🏛️',  component: <InitCA /> },
      { label: 'Issue Cert',      icon: '📜',  component: <IssueCert /> },
      { label: 'Certificates',    icon: '🗂️',  component: <Certificates /> },
      { label: 'Intermediate CA', icon: '🔗',  component: <IntermediateCA /> },
      { label: 'Templates',       icon: '📋',  component: <Templates /> },
    ],
  },
  {
    section: 'Validation',
    items: [
      { label: 'Verify',          icon: '✅',  component: <VerifyCert /> },
      { label: 'Revoke',          icon: '🚫',  component: <RevokeCert /> },
      { label: 'OCSP',            icon: '🔍',  component: <OCSP /> },
    ],
  },
  {
    section: 'Management',
    items: [
      { label: 'CRL',             icon: '📄',  component: <CRL /> },
      { label: 'Audit Log',       icon: '🔐',  component: <AuditLog /> },
      { label: 'ACME Renewal',    icon: '♻️',  component: <ACME /> },
    ],
  },
]

// Flatten for index lookup
const ALL_ITEMS = NAV.flatMap(g => g.items)

export default function App() {
  const [active, setActive] = useState(0)

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-left">
          <div className="header-logo">🔐</div>
          <div>
            <h1>Digital Certificate Authority</h1>
            <div className="header-subtitle">PKI Management System</div>
          </div>
        </div>
        <div className="header-badges">
          <span className="header-badge purple">RSA-2048</span>
          <span className="header-badge purple">X.509 v3</span>
          <span className="header-badge cyan">OCSP</span>
          <span className="header-badge cyan">ACME RFC 8555</span>
          <span className="header-badge">SHA-256</span>
        </div>
      </header>

      <div className="body-wrap">
        {/* ── Sidebar ── */}
        <nav className="sidebar">
          {NAV.map((group) => (
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

        {/* ── Main Content ── */}
        <main className="main-content">
          {ALL_ITEMS[active].component}
        </main>
      </div>
    </div>
  )
}
