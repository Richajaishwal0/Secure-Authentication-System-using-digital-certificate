import { Lock, Globe, Mail, Code2, Lightbulb } from 'lucide-react'

const TEMPLATES = [
  {
    name: 'client_auth',
    Icon: Lock,
    description: 'End-user client authentication and email protection',
    days: 365,
    key_usage: ['Digital Signature', 'Key Encipherment', 'Content Commitment'],
    ext_ku: ['CLIENT_AUTH', 'EMAIL_PROTECTION'],
    color: 'var(--accent)',
  },
  {
    name: 'tls_server',
    Icon: Globe,
    description: 'TLS/HTTPS server certificate with Subject Alternative Names',
    days: 365,
    key_usage: ['Digital Signature', 'Key Encipherment'],
    ext_ku: ['SERVER_AUTH', 'CLIENT_AUTH'],
    color: 'var(--accent2)',
  },
  {
    name: 'email_signing',
    Icon: Mail,
    description: 'S/MIME email signing and encryption certificate',
    days: 730,
    key_usage: ['Digital Signature', 'Key Encipherment', 'Data Encipherment', 'Content Commitment'],
    ext_ku: ['EMAIL_PROTECTION'],
    color: 'var(--success)',
  },
  {
    name: 'code_signing',
    Icon: Code2,
    description: 'Software and firmware code signing certificate',
    days: 365,
    key_usage: ['Digital Signature', 'Content Commitment'],
    ext_ku: ['CODE_SIGNING'],
    color: 'var(--warning)',
  },
]

export default function Templates() {
  return (
    <>
      <div className="page-header">
        <div className="page-title">Certificate Templates</div>
        <div className="page-desc">Each template applies the correct X.509 v3 extensions for its specific use case.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {TEMPLATES.map(t => (
          <div className="card" key={t.name} style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${t.color}22`, border: `1px solid ${t.color}44`,
              }}>
                <t.Icon size={20} color={t.color} />
              </div>
              <div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: 14 }}>{t.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.days} days default</div>
              </div>
            </div>
            <p className="desc" style={{ marginBottom: 12 }}>{t.description}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Key Usage</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {t.key_usage.map(k => (
                  <span key={k} className="badge badge-cyan" style={{ fontSize: 10 }}>{k}</span>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 }}>Extended Key Usage</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {t.ext_ku.map(k => (
                  <span key={k} className="badge" style={{ fontSize: 10, background: `${t.color}22`, color: t.color, border: `1px solid ${t.color}44` }}>{k}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Lightbulb size={15} /> Usage</div>
        <div className="card-divider" />
        <p className="desc" style={{ marginBottom: 0 }}>
          Select a template in the <strong style={{ color: 'var(--text)' }}>Issue Cert</strong> tab, or pass it via the REST API:
          <br /><br />
          <code style={{ background: 'var(--input-bg)', padding: '2px 8px', borderRadius: 4, fontSize: 12, color: 'var(--accent2)' }}>
            POST /api/certs/issue  →  {`{ "template": "tls_server", "san_names": ["example.com"] }`}
          </code>
        </p>
      </div>
    </>
  )
}
