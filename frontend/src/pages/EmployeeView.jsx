import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import { subscribeNotifications, markRead, sendAdminNotification } from '../notifications'
import {
  Bell, LogOut, RefreshCw, Download, Eye, EyeOff, CheckCircle2, XCircle,
  Clock, AlertTriangle, Package, Lock, Mail, Globe, Code2, ChevronRight,
  FileText, ShieldCheck, Search, Send, Inbox
} from 'lucide-react'

const SCREENS = ['my-certs', 'request', 'check']

export default function EmployeeView({ onSwitchRole, user }) {
  const [screen, setScreen] = useState('my-certs')
  const [notifs, setNotifs] = useState([])
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef(null)

  useEffect(() => {
    if (!user?.email) return
    const unsub = subscribeNotifications(user.email, setNotifs)
    return unsub
  }, [user?.email])

  // Close bell dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unread = notifs.filter(n => !n.read).length

  const handleBellClick = () => {
    setBellOpen(o => !o)
    // Mark all as read when opening
    if (!bellOpen && user?.email) {
      notifs.filter(n => !n.read).forEach(n => markRead(user.email, n.id))
    }
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="header-logo">🔐</div>
          <div>
            <h1>My Certificates</h1>
            <div className="header-subtitle">Digital Identity Portal</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}><FileText size={12} />{user?.name || 'Employee'}</span>

          {/* Notification Bell */}
          <div ref={bellRef} style={{ position: 'relative' }}>
            <button onClick={handleBellClick} style={{
              background: unread > 0 ? 'rgba(124,58,237,0.15)' : 'transparent',
              border: unread > 0 ? '1px solid rgba(124,58,237,0.4)' : '1px solid var(--border)',
              borderRadius: '8px', padding: '6px 10px', cursor: 'pointer',
              fontSize: '16px', position: 'relative', display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <Bell size={16} />
              {unread > 0 && (
                <span style={{
                  background: '#7c3aed', color: '#fff', borderRadius: '10px',
                  padding: '1px 6px', fontSize: '11px', fontWeight: 700,
                }}>{unread}</span>
              )}
            </button>

            {/* Dropdown */}
            {bellOpen && (
              <div style={{
                position: 'absolute', right: 0, top: '110%', width: '320px', zIndex: 200,
                background: 'var(--panel)', border: '1px solid var(--border)',
                borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden',
              }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', color: '#fff', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bell size={14} /> Notifications
                </div>
                {notifs.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No notifications yet</div>
                ) : (
                  <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                    {notifs.map(n => (
                      <div key={n.id} style={{
                        padding: '12px 16px', borderBottom: '1px solid var(--border)',
                        background: n.read ? 'transparent' : 'rgba(124,58,237,0.07)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span>{n.type === 'approved' ? <CheckCircle2 size={14} color='#4ade80' /> : <XCircle size={14} color='#f87171' />}</span>
                          <span style={{ color: n.type === 'approved' ? '#4ade80' : '#f87171', fontWeight: 700, fontSize: '13px' }}>{n.title}</span>
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

          <button
            onClick={onSwitchRole}
            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '12px' }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div style={{ background: 'var(--sidebar)', borderBottom: '1px solid var(--border)', display: 'flex', gap: '4px', padding: '10px 24px' }}>
        {[
          { id: 'my-certs', Icon: FileText,    label: 'My Certificates' },
          { id: 'request',  Icon: Send,         label: 'Request a Certificate' },
          { id: 'check',    Icon: ShieldCheck,  label: 'Check a Certificate' },
        ].map(t => (
          <button key={t.id} onClick={() => setScreen(t.id)} style={{
            background: screen === t.id ? 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(6,182,212,0.1))' : 'transparent',
            border: screen === t.id ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
            color: screen === t.id ? '#fff' : 'var(--text-dim)',
            borderRadius: '8px', padding: '8px 18px', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <t.Icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      <main style={{ flex: 1, overflow: 'auto', padding: '32px', background: 'var(--bg2)' }}>
        {screen === 'my-certs' && <MyCerts user={user} />}
        {screen === 'request'  && <RequestCert user={user} />}
        {screen === 'check'    && <CheckCert />}
      </main>
    </div>
  )
}

/* ── Screen 1: My Certificates ── */
function MyCerts({ user }) {
  const [certs, setCerts]   = useState([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [myRequests, setMyRequests] = useState([])

  const email = user?.email || ''

  const load = async () => {
    if (!email) return
    setLoading(true)
    try {
      const [certsRes, reqsRes] = await Promise.all([
        api.listCerts(),
        api.listRequests(),
      ])
      setCerts(certsRes.data.filter(c => c.email?.toLowerCase() === email.toLowerCase()))
      setMyRequests(reqsRes.data.filter(r => r.email?.toLowerCase() === email.toLowerCase()))
      setLoaded(true)
    } catch {
      setCerts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [email])

  const openDetail = async (cert) => {
    setDetailLoading(true)
    setSelected(cert)
    try {
      const res = await api.getCert(cert.serial)
      setSelected(res.data)
    } catch {}
    finally { setDetailLoading(false) }
  }

  const download = (cert) => {
    // Download certificate
    const certBlob = new Blob([cert.pem || ''], { type: 'application/x-pem-file' })
    const certUrl  = URL.createObjectURL(certBlob)
    const a1       = document.createElement('a')
    a1.href        = certUrl
    a1.download    = `${cert.common_name}_certificate.pem`
    a1.click()
    URL.revokeObjectURL(certUrl)

    // Download private key if available
    if (cert.private_key_pem) {
      setTimeout(() => {
        const keyBlob = new Blob([cert.private_key_pem], { type: 'application/x-pem-file' })
        const keyUrl  = URL.createObjectURL(keyBlob)
        const a2      = document.createElement('a')
        a2.href       = keyUrl
        a2.download   = `${cert.common_name}_private_key.pem`
        a2.click()
        URL.revokeObjectURL(keyUrl)
      }, 300)
    }
  }

  const daysLeft = (dateStr) => {
    if (!dateStr) return null
    return Math.floor((new Date(dateStr) - new Date()) / 86400000)
  }

  // Pending requests that haven't been issued yet
  const pendingReqs  = myRequests.filter(r => r.status === 'pending')
  const rejectedReqs = myRequests.filter(r => r.status === 'rejected')
  // Approved requests — find the matching cert in the list
  const newlyApproved = myRequests.filter(r =>
    r.status === 'approved' && r.issued_serial &&
    certs.some(c => c.serial === r.issued_serial && !c.revoked)
  )

  if (loading) return <div className="spinner" />

  return (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ color: '#fff', fontSize: '1.2rem' }}>Certificates for {email}</h2>
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>{certs.length} certificate{certs.length !== 1 ? 's' : ''} found</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><RefreshCw size={13} /> Refresh</button>
      </div>

      {/* Newly approved — certificate ready */}
      {newlyApproved.map(r => {
        const cert = certs.find(c => c.serial === r.issued_serial)
        return (
          <div key={r.id} style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: '10px', padding: '14px 18px', marginBottom: '1rem', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <CheckCircle2 size={28} color='#4ade80' style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ color: '#4ade80', fontWeight: 700, fontSize: '14px' }}>Your certificate is ready!</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '3px' }}>
                Request for <strong style={{ color: 'var(--text-dim)' }}>{r.purpose || r.template}</strong> was approved. Click below to download.
              </div>
            </div>
            <button className="btn btn-sm" onClick={() => openDetail(cert)}
              style={{ background: 'linear-gradient(135deg, var(--success), #059669)', color: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Download size={13} /> Download
            </button>
          </div>
        )
      })}

      {/* Pending requests notice */}
      {pendingReqs.length > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', padding: '14px 18px', marginBottom: '1.2rem', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <Clock size={22} color='#fbbf24' style={{ flexShrink: 0 }} />
          <div>
            <div style={{ color: '#fbbf24', fontWeight: 600, fontSize: '14px' }}>You have {pendingReqs.length} pending request{pendingReqs.length > 1 ? 's' : ''}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '3px', lineHeight: 1.6 }}>
              Your request is waiting for admin approval. Once approved, your certificate will appear below.
            </div>
            {pendingReqs.map(r => (
              <div key={r.id} style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-dim)' }}>
                • {r.purpose || r.template} — submitted {r.created_at?.slice(0, 10)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rejected requests notice */}
      {rejectedReqs.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '14px 18px', marginBottom: '1.2rem' }}>
          <div style={{ color: '#f87171', fontWeight: 600, fontSize: '14px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '7px' }}><XCircle size={15} /> Rejected Requests</div>
          {rejectedReqs.map(r => (
            <div key={r.id} style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '4px' }}>
              • {r.purpose || r.template} — <span style={{ color: '#f87171' }}>{r.reject_reason || 'No reason given'}</span>
            </div>
          ))}
        </div>
      )}

      {certs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--panel)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ marginBottom: '0.8rem' }}><Inbox size={40} color='var(--text-muted)' /></div>
          <div style={{ color: '#fff', fontWeight: 600, marginBottom: '0.4rem' }}>No certificates yet</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Request one using the "Request a Certificate" tab above.</div>
        </div>
      ) : selected ? (
        <CertDetail cert={selected} detailLoading={detailLoading} onBack={() => setSelected(null)} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {certs.map(c => {
            const days = daysLeft(c.not_after)
            const expiring = days !== null && days <= 30 && days > 0
            const expired  = days !== null && days <= 0
            return (
              <div key={c.serial} onClick={() => openDetail(c)} style={{
                background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '12px',
                padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', transition: 'border-color 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ flexShrink: 0 }}>{c.revoked ? <XCircle size={26} color='#f87171' /> : expired ? <Clock size={26} color='#f87171' /> : <CheckCircle2 size={26} color='#4ade80' />}</div>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>{c.common_name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>{c.template}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {c.revoked ? (
                    <span style={{ color: '#f87171', fontSize: '12px', fontWeight: 600 }}>Revoked</span>
                  ) : expired ? (
                    <span style={{ color: '#f87171', fontSize: '12px', fontWeight: 600 }}>Expired</span>
                  ) : expiring ? (
                    <span style={{ color: '#facc15', fontSize: '12px', fontWeight: 600 }}>Expires in {days} days</span>
                  ) : (
                    <span style={{ color: '#4ade80', fontSize: '12px', fontWeight: 600 }}>Valid · {days}d left</span>
                  )}
                  <ChevronRight size={15} color='var(--text-muted)' style={{ marginTop: '2px' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Certificate Detail — human-friendly view ── */
function CertDetail({ cert, detailLoading, onBack }) {
  const [p12Password, setP12Password] = useState('changeme')
  const [downloading, setDownloading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const TEMPLATE_INFO = {
    client_auth:   { Icon: Lock,  label: 'VPN / Login Certificate',   color: '#a78bfa' },
    email_signing: { Icon: Mail,  label: 'Email Signing Certificate',  color: '#4ade80' },
    tls_server:    { Icon: Globe, label: 'Web Server Certificate',     color: '#67e8f9' },
    code_signing:  { Icon: Code2, label: 'Code Signing Certificate',   color: '#fbbf24' },
  }

  const USAGE_STEPS = {
    client_auth: [
      { title: 'Download the .p12 file below', desc: 'Set a password you will remember — you need it when importing.' },
      { title: 'Windows: Double-click the .p12 file', desc: 'The Certificate Import Wizard opens. Choose "Current User", enter your password, and click Finish.' },
      { title: 'Mac: Double-click the .p12 file', desc: 'Keychain Access opens. Enter your password. The certificate appears under "My Certificates".' },
      { title: 'Configure your VPN client', desc: 'In your VPN settings, select "Certificate" as the auth method and choose this certificate from the store.' },
    ],
    email_signing: [
      { title: 'Download the .p12 file below', desc: 'Set a password you will remember.' },
      { title: 'Outlook: File → Options → Trust Center → Email Security', desc: 'Click "Import/Export", select your .p12 file, enter the password.' },
      { title: 'Thunderbird: Account Settings → End-To-End Encryption', desc: 'Click "Manage S/MIME Certificates" → Import, select your .p12 file.' },
      { title: 'Your emails will now show a digital signature', desc: 'Recipients can verify the email came from you and was not tampered with.' },
    ],
    tls_server: [
      { title: 'Download the .p12 file below', desc: 'This is for your web server, not your personal device.' },
      { title: 'Nginx: Convert to PEM files', desc: 'Run: openssl pkcs12 -in cert.p12 -nokeys -out cert.pem and openssl pkcs12 -in cert.p12 -nocerts -nodes -out key.pem' },
      { title: 'Apache: Same conversion, then set ssl_certificate and ssl_certificate_key', desc: 'Point your Apache config to the extracted cert.pem and key.pem files.' },
      { title: 'IIS: Import .p12 directly', desc: 'Open IIS Manager → Server Certificates → Import. Select the .p12 file and enter the password.' },
    ],
    code_signing: [
      { title: 'Download the .p12 file below', desc: 'Set a strong password — this protects your signing identity.' },
      { title: 'Windows: Import into certificate store', desc: 'Double-click the .p12 file → Import to "Personal" store.' },
      { title: 'Sign a PowerShell script', desc: 'Run: $cert = Get-ChildItem Cert:\\CurrentUser\\My | Where Subject -like "*YourName*"\nSet-AuthenticodeSignature script.ps1 $cert' },
      { title: 'Sign with signtool (EXE/DLL)', desc: 'Run: signtool sign /n "YourName" /t http://timestamp.url yourapp.exe' },
    ],
  }

  const downloadP12 = async () => {
    if (!p12Password || p12Password.length < 4) { alert('Password must be at least 4 characters.'); return }
    setDownloading(true)
    try {
      const res = await api.downloadP12(cert.serial, p12Password)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/x-pkcs12' }))
      const a   = document.createElement('a')
      a.href    = url
      a.download = `${cert.common_name?.replace(/\s+/g, '_')}_certificate.p12`
      a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Download failed. Make sure the backend is running.') }
    finally { setDownloading(false) }
  }

  const daysLeft = cert.not_after ? Math.floor((new Date(cert.not_after) - new Date()) / 86400000) : null
  const info = TEMPLATE_INFO[cert.template] || TEMPLATE_INFO.client_auth
  const steps = USAGE_STEPS[cert.template] || USAGE_STEPS.client_auth

  return (
    <div style={{ maxWidth: '680px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button className="btn btn-secondary btn-sm" onClick={onBack}>← Back</button>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>Your Certificate</div>
      </div>

      {detailLoading ? <div className="spinner" /> : (
        <>
          {/* Status card */}
          {cert.revoked ? (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '12px', padding: '20px', marginBottom: '1.2rem', display: 'flex', gap: '16px', alignItems: 'center' }}>
              <XCircle size={36} color='#f87171' style={{ flexShrink: 0 }} />
              <div>
                <div style={{ color: '#f87171', fontWeight: 700, fontSize: '15px' }}>This certificate has been revoked</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>It can no longer be used. Contact your IT admin to request a new one.</div>
              </div>
            </div>
          ) : (
            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', padding: '20px', marginBottom: '1.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <info.Icon size={28} color={info.color} />
                <div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>{info.label}</div>
                  <div style={{ color: '#4ade80', fontSize: '12px', marginTop: '2px' }}>
                    <CheckCircle2 size={12} style={{ display: 'inline', marginRight: 4 }} />Valid · expires {cert.not_after?.slice(0, 10)} ({daysLeft} days left)
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  ['Your Name',    cert.common_name],
                  ['Your Email',   cert.email],
                  ['Organisation', cert.org || '—'],
                  ['Issued By',    cert.issued_by === 'root' ? 'IT Department (Root CA)' : 'IT Department (Intermediate CA)'],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '3px' }}>{k}</div>
                    <div style={{ color: '#fff', fontSize: '13px', fontWeight: 500 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!cert.revoked && cert.private_key_pem && (
            <>
              {/* Download .p12 */}
              <div className="card" style={{ marginBottom: '1.2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.8rem' }}>
                  <Package size={22} color='#a78bfa' />
                  <div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '14px' }}>Download Your Certificate Package</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>One file containing everything — ready to import into Windows, Mac, browser, or VPN</div>
                  </div>
                </div>

                <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '8px', padding: '12px 14px', marginBottom: '1rem', fontSize: '12px', color: 'var(--text-dim)', lineHeight: 1.7 }}>
                  🔐 Set a password to protect your certificate file. You will need to enter this password when importing it on your device. Choose something you will remember.
                </div>

                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={p12Password}
                      onChange={e => setP12Password(e.target.value)}
                      placeholder="Set a password for the .p12 file"
                      className="input"
                      style={{ paddingRight: '40px' }}
                    />
                    <button onClick={() => setShowPassword(s => !s)} style={{
                      position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                    }}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                  </div>
                  <button className="btn" onClick={downloadP12} disabled={downloading} style={{
                    background: 'linear-gradient(135deg, var(--accent), #6d28d9)', color: '#fff',
                    flexShrink: 0, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '7px',
                  }}>
                    {downloading ? 'Preparing…' : <><Download size={14} /> Download .p12</>}
                  </button>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  💡 <strong style={{ color: 'var(--text-dim)' }}>What is a .p12 file?</strong> It's a single password-protected file that contains your certificate and private key together. It's the standard format accepted by Windows, macOS, browsers, VPN clients, and email apps.
                </div>
              </div>

              {/* How to use */}
              <div className="card">
                <div style={{ color: '#fff', fontWeight: 700, fontSize: '14px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><FileText size={15} /> How to Use This Certificate</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {steps.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: '13px', flexShrink: 0, minWidth: '20px' }}>{i + 1}.</span>
                      <div>
                        <div style={{ color: '#fff', fontSize: '13px', fontWeight: 600, marginBottom: '3px' }}>{s.title}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.6 }}>{s.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

/* ── Screen 2: Request a Certificate ── */
function RequestCert({ user }) {
  const PURPOSES = [
    { value: 'vpn',   Icon: Lock,      label: 'VPN Access',        template: 'client_auth',   desc: 'Connect to company VPN securely' },
    { value: 'email', Icon: Mail,      label: 'Email Signing',     template: 'email_signing', desc: 'Sign and encrypt your emails' },
    { value: 'web',   Icon: Globe,     label: 'Internal Website',  template: 'tls_server',    desc: 'HTTPS for an internal server or website' },
    { value: 'code',  Icon: Code2,     label: 'Code Signing',      template: 'code_signing',  desc: 'Sign scripts or software you deploy' },
    { value: 'other', Icon: FileText,  label: 'General / Other',   template: 'client_auth',   desc: 'General purpose identity certificate' },
  ]

  const [step, setStep]     = useState(1)
  const [purpose, setPurpose] = useState(null)
  const [form, setForm]     = useState({ common_name: user?.name || '', email: user?.email || '', org: '', country: 'IN', san_names: [] })
  const [sanInput, setSan]  = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.common_name || !form.email) { setError('Name and email are required.'); return }
    if (form.country.length !== 2) { setError('Country must be 2 letters (e.g. IN, US).'); return }
    setLoading(true); setError('')
    try {
      const res = await api.submitRequest({
        ...form,
        template: purpose.template,
        purpose:  purpose.label,
      })
      // Notify admin
      await sendAdminNotification({
        type:      'new_request',
        title:     'New certificate request',
        message:   `${form.common_name} (${form.email}) requested a ${purpose.label} certificate.`,
        fromEmail: form.email,
      })
      setResult(res.data)
      setStep(3)
    } catch (e) {
      setError(e.response?.data?.detail || 'Submission failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '600px' }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 700,
              background: step >= s ? 'linear-gradient(135deg, var(--accent), #6d28d9)' : 'var(--panel2)',
              color: step >= s ? '#fff' : 'var(--text-muted)',
              border: step === s ? '2px solid #a78bfa' : '2px solid transparent',
            }}>{s}</div>
            <span style={{ fontSize: '12px', color: step >= s ? 'var(--text)' : 'var(--text-muted)', fontWeight: step === s ? 600 : 400 }}>
              {s === 1 ? 'What do you need?' : s === 2 ? 'Your details' : 'Done'}
            </span>
            {s < 3 && <div style={{ width: 32, height: 1, background: step > s ? 'var(--accent)' : 'var(--border)' }} />}
          </div>
        ))}
      </div>

      {/* Step 1 — Purpose */}
      {step === 1 && (
        <div>
          <h2 style={{ color: '#fff', marginBottom: '0.5rem', fontSize: '1.2rem' }}>What do you need a certificate for?</h2>
          <p style={{ color: 'var(--text-dim)', marginBottom: '1.5rem', fontSize: '13px' }}>Choose the option that best describes your use case.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            {PURPOSES.map(p => (
              <div key={p.value} onClick={() => { setPurpose(p); setStep(2) }} style={{
                background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '12px',
                padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '16px',
                transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)'; e.currentTarget.style.background = 'rgba(124,58,237,0.07)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--panel)' }}
              >
                <p.Icon size={22} color='#a78bfa' style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>{p.label}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>{p.desc}</div>
                </div>
                <div style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>→</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 2 — Details */}
      {step === 2 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setStep(1)}>← Back</button>
            <div>
              <h2 style={{ color: '#fff', fontSize: '1.1rem' }}>Fill in your details</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>For: {purpose?.label}</p>
            </div>
          </div>

          {error && <div className="output error" style={{ marginBottom: '1rem' }}>{error}</div>}

          <div className="card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Field label="Your Full Name *" value={form.common_name} onChange={v => set('common_name', v)} placeholder="e.g. Rahul Sharma" />
              <Field label="Your Email Address *" value={form.email} onChange={v => set('email', v)} placeholder="rahul@company.com" type="email" />
              <Field label="Organisation / Company" value={form.org} onChange={v => set('org', v)} placeholder="e.g. Acme Pvt Ltd" />
              <Field label="Country Code (2 letters)" value={form.country} onChange={v => set('country', v.toUpperCase())} placeholder="IN" maxLength={2} />

              {purpose?.template === 'tls_server' && (
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>Domain Names</div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input className="input" value={sanInput} onChange={e => setSan(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && sanInput.trim()) { set('san_names', [...form.san_names, sanInput.trim()]); setSan('') }}}
                      placeholder="e.g. internal.company.com" />
                    <button className="btn btn-sm" onClick={() => { if (sanInput.trim()) { set('san_names', [...form.san_names, sanInput.trim()]); setSan('') }}}>Add</button>
                  </div>
                  {form.san_names.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                      {form.san_names.map(s => (
                        <span key={s} className="badge" style={{ cursor: 'pointer', background: 'rgba(124,58,237,0.15)', color: '#c4b5fd' }}
                          onClick={() => set('san_names', form.san_names.filter(x => x !== s))}>
                          {s} ✕
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button className="btn" onClick={submit} disabled={loading} style={{ marginTop: '1.5rem', width: '100%', justifyContent: 'center', padding: '12px' }}>
              {loading ? 'Submitting…' : '📤 Submit Request'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Done */}
      {step === 3 && result && (
        <div style={{ textAlign: 'center', paddingTop: '20px' }}>
          <div style={{ marginBottom: '1rem' }}>
            {result.auto_approved ? <CheckCircle2 size={52} color='#4ade80' /> : <Clock size={52} color='#fbbf24' />}
          </div>
          <h2 style={{ color: '#fff', marginBottom: '0.5rem', fontSize: '1.3rem' }}>
            {result.auto_approved ? 'Certificate Issued!' : 'Request Submitted!'}
          </h2>
          <p style={{ color: 'var(--text-dim)', marginBottom: '1.5rem', lineHeight: 1.7 }}>
            {result.auto_approved
              ? 'Your certificate was issued automatically. Go to My Certificates tab to download it.'
              : 'Your request has been sent to the IT admin for review.'}
          </p>

          {/* What happens next */}
          {!result.auto_approved && (
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '1.5rem', textAlign: 'left' }}>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: '13px', marginBottom: '12px' }}>What happens next?</div>
              {[
                ['⏳', 'Admin reviews your request', 'They can see your name, email, and purpose'],
                ['✅', 'Admin approves and issues the certificate', 'This happens in the Cert Requests tab'],
                ['📧', 'Admin sends it to your email', 'You\'ll receive the .pem certificate file'],
                ['🗂️', 'Come back here to download it', 'It will appear in My Certificates once issued'],
              ].map(([icon, title, desc]) => (
                <div key={title} style={{ display: 'flex', gap: '12px', marginBottom: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{icon}</span>
                  <div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '13px', fontWeight: 600 }}>{title}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {result.cert_serial && (
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', marginBottom: '1.5rem', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-dim)' }}>
              Certificate Serial: {result.cert_serial}
            </div>
          )}
          <button className="btn" onClick={() => { setStep(1); setPurpose(null); setForm({ common_name: '', email: '', org: '', country: 'IN', san_names: [] }); setResult(null) }}>
            {result.auto_approved ? 'Request Another' : 'Submit Another Request'}
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Screen 3: Check a Certificate ── */
function CheckCert() {
  const [file, setFile]     = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const check = async () => {
    if (!file) { setError('Please select a certificate file (.pem)'); return }
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await api.verifyCert(file)
      setResult(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Verification failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '560px' }}>
      <h2 style={{ color: '#fff', marginBottom: '0.5rem', fontSize: '1.2rem' }}>Check if a Certificate is Valid</h2>
      <p style={{ color: 'var(--text-dim)', marginBottom: '2rem', fontSize: '13px', lineHeight: 1.7 }}>
        Upload a certificate file (.pem) to check if it's still valid, not expired, and not cancelled.
      </p>

      {error && <div className="output error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="card">
        <div style={{ border: '2px dashed var(--border)', borderRadius: '10px', padding: '32px', textAlign: 'center', marginBottom: '1rem' }}>
          <div style={{ marginBottom: '0.5rem' }}><FileText size={32} color='var(--text-muted)' /></div>
          <div style={{ color: 'var(--text-dim)', fontSize: '13px', marginBottom: '1rem' }}>Select your certificate file</div>
          <input type="file" accept=".pem,.crt,.cer" onChange={e => setFile(e.target.files[0])}
            style={{ display: 'block', margin: '0 auto', maxWidth: '280px' }} />
          {file && <div style={{ color: '#4ade80', fontSize: '12px', marginTop: '0.5rem' }}>✓ {file.name}</div>}
        </div>
        <button className="btn" onClick={check} disabled={loading || !file} style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
          {loading ? 'Checking…' : <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}><Search size={14} /> Check Certificate</span>}
        </button>
      </div>

      {result && (
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.8rem' }}>{result.valid ? <CheckCircle2 size={48} color='#4ade80' /> : <XCircle size={48} color='#f87171' />}</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: result.valid ? '#4ade80' : '#f87171', marginBottom: '0.5rem' }}>
            {result.valid ? 'Certificate is Valid' : 'Certificate is NOT Valid'}
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: '13px', marginBottom: '1rem' }}>{result.subject}</div>
          {!result.valid && result.reason && (
            <div className="output error">Reason: {result.reason}</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.8rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {Object.entries(result.checks || {}).map(([k, v]) => (
              <span key={k} style={{
                background: v ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                color: v ? '#4ade80' : '#f87171',
                border: `1px solid ${v ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: 600,
              }}>
                {v ? '✓' : '✗'} {k.replace('_', ' ')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', maxLength }) {
  return (
    <div>
      <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>{label}</div>
      <input className="input" type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} maxLength={maxLength} />
    </div>
  )
}
