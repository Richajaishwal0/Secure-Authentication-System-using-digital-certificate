import { useEffect, useState } from 'react'
import { api } from '../api'
import { sendNotification } from '../notifications'
import { User, Shield, CheckCircle2, XCircle, Clock, Lock, Globe, Mail, Code2, FileText, RefreshCw, Download, Copy, X, Inbox } from 'lucide-react'

const STATUS_STYLE = {
  pending:  { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)',  text: '#fbbf24', label: 'Pending'  },
  approved: { bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.35)',  text: '#4ade80', label: 'Approved' },
  rejected: { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)',   text: '#f87171', label: 'Rejected' },
}

const STATUS_ICON = {
  pending:  <Clock size={11} />,
  approved: <CheckCircle2 size={11} />,
  rejected: <XCircle size={11} />,
}

const TEMPLATE_LABEL = {
  client_auth:   { Icon: Lock,  label: 'Client Auth'   },
  tls_server:    { Icon: Globe, label: 'TLS Server'    },
  email_signing: { Icon: Mail,  label: 'Email Signing' },
  code_signing:  { Icon: Code2, label: 'Code Signing'  },
}

export default function RequestPortal() {
  const [requests, setRequests] = useState([])
  const [filter, setFilter]     = useState('pending')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  // issuedMap: { [req_id]: { cert_serial, cert_pem, not_after, recipient_email, recipient_name, template } }
  const [issuedMap, setIssuedMap] = useState({})
  const [rejectTarget, setRejectTarget] = useState(null) // req id for RejectModal

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.listRequests(filter || undefined)
      setRequests(res.data)
    } catch {
      setError('Failed to load requests.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filter])

  const handleApprove = async (req) => {
    try {
      const res = await api.approveRequest(req.id)
      const d   = res.data
      setIssuedMap(m => ({ ...m, [req.id]: {
        cert_serial:     d.cert_serial,
        cert_pem:        d.cert_pem,
        not_after:       d.not_after,
        recipient_email: d.recipient_email,
        recipient_name:  d.recipient_name,
        template:        d.template,
      }}))
      // Notify employee
      await sendNotification(req.email, {
        type:    'approved',
        title:   'Your certificate is ready! 🎉',
        message: `Your request for "${req.purpose || req.template}" has been approved. Log in to download your certificate.`,
        serial:  d.cert_serial,
      })
      load()
    } catch (e) {
      setError(e.response?.data?.detail || 'Approval failed.')
    }
  }

  const handleReject = async (id, reason) => {
    try {
      const req = requests.find(r => r.id === id)
      await api.rejectRequest(id, reason)
      // Notify employee
      if (req) {
        await sendNotification(req.email, {
          type:    'rejected',
          title:   'Certificate request rejected',
          message: `Your request for "${req.purpose || req.template}" was rejected. Reason: ${reason}`,
        })
      }
      setRejectTarget(null)
      load()
    } catch (e) {
      setError(e.response?.data?.detail || 'Rejection failed.')
    }
  }

  const counts = { pending: 0, approved: 0, rejected: 0 }
  requests.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++ })

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div className="page-title">Certificate Requests</div>
        <div className="page-desc">
          Employees submit requests from their portal. Review each request, approve to issue the certificate, then send it to the user.
        </div>
      </div>

      {/* How it works banner */}
      <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '12px', padding: '16px 20px', marginBottom: '1.5rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        {[
          ['1', <User size={14} />,        'Employee submits',  'Fills a simple form on their portal — no CA knowledge needed'],
          ['2', <Shield size={14} />,       'Admin reviews',     'You see their name, email, purpose, and certificate type here'],
          ['3', <CheckCircle2 size={14} />, 'Approve → Issue',   'One click issues the certificate automatically'],
          ['4', <Mail size={14} />,         'Send to user',      'Download the .pem and send it, or use the Send button to log delivery'],
        ].map(([n, icon, title, desc]) => (
          <div key={n} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flex: '1 1 180px' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0, marginTop: '2px' }}>{n}</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>{icon} {title}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px', lineHeight: 1.5 }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs + refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[['pending', <Clock size={13} />], ['approved', <CheckCircle2 size={13} />], ['rejected', <XCircle size={13} />], ['', <FileText size={13} />]].map(([s, icon]) => (
            <button key={s} onClick={() => setFilter(s)} style={{
              background: filter === s ? 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(6,182,212,0.1))' : 'var(--panel)',
              border: filter === s ? '1px solid rgba(124,58,237,0.4)' : '1px solid var(--border)',
              color: filter === s ? '#fff' : 'var(--text-dim)',
              borderRadius: '8px', padding: '7px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              {icon} {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
              {s && counts[s] > 0 && (
                <span style={{ background: s === 'pending' ? '#fbbf24' : s === 'approved' ? '#4ade80' : '#f87171', color: '#000', borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: 700 }}>
                  {counts[s]}
                </span>
              )}
            </button>
          ))}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><RefreshCw size={13} /> Refresh</button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px 16px', color: '#f87171', fontSize: '13px', marginBottom: '1rem' }}>
          ⚠ {error}
        </div>
      )}

      {loading ? (
        <div className="spinner" />
      ) : requests.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ marginBottom: '0.8rem' }}><Inbox size={40} color='var(--text-muted)' /></div>
          <div style={{ color: '#fff', fontWeight: 600, marginBottom: '0.4rem' }}>No {filter || ''} requests</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            {filter === 'pending' ? 'No requests waiting for approval.' : 'Nothing here yet.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {requests.map(req => {
            const ss     = STATUS_STYLE[req.status] || STATUS_STYLE.pending
            const issued = issuedMap[req.id]  // cert data if just approved this session
            return (
              <div key={req.id} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>

                {/* Request card header */}
                <div style={{ padding: '18px 22px', display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  {/* Avatar */}
                  <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(6,182,212,0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <User size={20} color='#a78bfa' />
                  </div>

                  {/* Main info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>{req.common_name}</span>
                      <span style={{ background: ss.bg, border: `1px solid ${ss.border}`, color: ss.text, borderRadius: '20px', padding: '2px 10px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {STATUS_ICON[req.status]} {ss.label}
                      </span>
                      <span style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.25)', borderRadius: '20px', padding: '2px 10px', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {TEMPLATE_LABEL[req.template] ? (() => { const T = TEMPLATE_LABEL[req.template]; return <><T.Icon size={11} /> {T.label}</>; })() : req.template}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '6px' }}>{req.email}</div>
                    {req.purpose && (
                      <div style={{ background: 'var(--panel2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Purpose: </span>
                        {req.purpose}
                      </div>
                    )}
                  </div>

                  {/* Meta + submitted time */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Submitted</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '12px', fontWeight: 600 }}>{req.created_at?.slice(0, 10)}</div>
                    {req.org && <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>{req.org}</div>}
                    {req.san_names && <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>SANs: {req.san_names}</div>}
                  </div>
                </div>

                {/* Reject reason */}
                {req.status === 'rejected' && req.reject_reason && (
                  <div style={{ margin: '0 22px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#f87171' }}>
                    Rejection reason: {req.reject_reason}
                  </div>
                )}

                {/* Issued serial (from DB, for already-approved requests) */}
                {req.status === 'approved' && req.issued_serial && !issued && (
                  <div style={{ margin: '0 22px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>✅ Certificate issued</span>
                    <code style={{ fontSize: '11px', color: 'var(--text-dim)', background: '#080812', padding: '2px 8px', borderRadius: '4px' }}>
                      {req.issued_serial.slice(0, 24)}…
                    </code>
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Go to All Certificates to download and send.</span>
                  </div>
                )}

                {/* Just-approved: show cert + send button inline */}
                {issued && (
                  <div style={{ margin: '0 22px 16px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '10px', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <CheckCircle2 size={22} color='#4ade80' />
                      <div>
                        <div style={{ color: '#4ade80', fontWeight: 700, fontSize: '14px' }}>Certificate issued successfully!</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                          Now send it to <strong style={{ color: '#fff' }}>{issued.recipient_name}</strong> at <strong style={{ color: '#fff' }}>{issued.recipient_email}</strong>
                        </div>
                      </div>
                    </div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--text-dim)', background: '#080812', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', marginBottom: '12px', wordBreak: 'break-all' }}>
                      Serial: {issued.cert_serial}
                    </div>
                    <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                      <button className="btn" onClick={() => downloadPem(issued)}
                        style={{ background: 'linear-gradient(135deg, var(--success), #059669)', color: '#fff', display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <Download size={14} /> Download .pem
                      </button>
                      <button className="btn btn-secondary" onClick={() => navigator.clipboard.writeText(issued.cert_pem)} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <Copy size={14} /> Copy PEM
                      </button>
                    </div>
                  </div>
                )}

                {/* Action buttons for pending */}
                {req.status === 'pending' && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '14px 22px', display: 'flex', gap: '0.8rem', background: 'rgba(0,0,0,0.15)' }}>
                    <button className="btn" onClick={() => handleApprove(req)}
                      style={{ background: 'linear-gradient(135deg, #059669, #047857)', color: '#fff', boxShadow: '0 4px 14px rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <CheckCircle2 size={14} /> Approve & Issue Certificate
                    </button>
                    <button className="btn btn-secondary" onClick={() => setRejectTarget(req.id)}
                      style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#f87171', display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Reject Modal */}
      {rejectTarget !== null && (
        <RejectModal
          onConfirm={(reason) => handleReject(rejectTarget, reason)}
          onClose={() => setRejectTarget(null)}
        />
      )}
    </div>
  )
}

/* ── Download helper ── */
function downloadPem(issued) {
  const blob = new Blob([issued.cert_pem], { type: 'application/x-pem-file' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${issued.recipient_name?.replace(/\s+/g, '_') || 'cert'}_${issued.cert_serial?.slice(0, 8)}.pem`
  a.click()
  URL.revokeObjectURL(url)
}

/* ── Send Certificate Modal ── */
function SendModal({ cert, onClose }) {
  const [email, setEmail]     = useState(cert.recipient_email || '')
  const [message, setMessage] = useState(
    `Hi ${cert.recipient_name || 'there'},\n\nYour digital certificate has been issued and is ready to use.\n\nCertificate Details:\n  Serial  : ${cert.cert_serial}\n  Type    : ${cert.template}\n  Valid Until: ${cert.not_after?.slice(0, 10)}\n\nTo use it:\n1. Save the attached .pem file to your computer\n2. Import it into your application (VPN client, email client, etc.)\n3. Contact IT if you need help\n\nRegards,\nIT Admin`
  )
  const [status, setStatus] = useState('')
  const [errMsg, setErrMsg] = useState('')

  async function handleSend() {
    if (!email) { setErrMsg('Email is required.'); return }
    setStatus('sending'); setErrMsg('')
    try {
      const res = await api.sendCert({ serial: cert.cert_serial, email, message })
      setStatus(res.data.sent ? 'sent' : 'logged')
      if (!res.data.sent) setErrMsg(res.data.email_error || '')
    } catch (e) {
      setErrMsg(e.response?.data?.detail || e.message)
      setStatus('error')
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}>

        {(status === 'sent' || status === 'logged') ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{status === 'sent' ? '✅' : '📝'}</div>
            <div style={{ color: status === 'sent' ? '#4ade80' : '#fbbf24', fontWeight: 700, fontSize: '16px', marginBottom: '0.5rem' }}>
              {status === 'sent' ? 'Email Sent!' : 'Delivery Logged'}
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: '13px', marginBottom: '1.5rem', lineHeight: 1.7 }}>
              {status === 'sent'
                ? <>Certificate emailed to <strong style={{ color: '#fff' }}>{email}</strong>. The employee will receive it in their inbox.</>
                : <>SMTP not configured — delivery logged to audit trail. Download the .pem and send it manually.</>}
            </div>
            {status === 'logged' && errMsg && (
              <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#fbbf24', marginBottom: '1.2rem', textAlign: 'left' }}>
                {errMsg} — Configure SMTP in <strong>Settings</strong>.
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              {status === 'logged' && <button className="btn" onClick={() => downloadPem(cert)} style={{ background: 'linear-gradient(135deg, var(--success), #059669)', color: '#fff' }}>⬇ Download .pem</button>}
              <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: '16px' }}>📧 Send Certificate to User</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
                  This logs the delivery to the audit trail. Download the .pem to attach to your email.
                </div>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>✕</button>
            </div>

            {/* Cert summary pill */}
            <div style={{ background: 'var(--panel2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', marginBottom: '1.2rem', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '1.5rem' }}>📜</span>
              <div>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: '13px' }}>{cert.recipient_name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
                  {cert.template} · Valid until {cert.not_after?.slice(0, 10)}
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Recipient Email *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" />
            </div>

            <div className="form-group" style={{ marginBottom: '1.2rem' }}>
              <label>Message</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={9}
                style={{ width: '100%', background: 'var(--panel2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text-dim)', fontSize: '12px', fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box' }} />
            </div>

            {errMsg && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#f87171', fontSize: '12px', marginBottom: '1rem' }}>
                ⚠ {errMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn" onClick={handleSend} disabled={status === 'sending'}
                style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', color: '#fff' }}>
                {status === 'sending' ? <><span className="btn-spinner" /> Logging…</> : '📧 Log Delivery & Get .pem'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Reject Modal ── */
function RejectModal({ onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div style={{ background: 'var(--panel)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '420px' }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><XCircle size={15} color='#f87171' /> Reject Request</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '1.2rem' }}>
          The employee will see this reason. Be clear and helpful.
        </div>
        <div className="form-group" style={{ marginBottom: '1.2rem' }}>
          <label>Reason for rejection *</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="e.g. Please provide your manager's approval before requesting a code signing certificate."
            style={{ width: '100%', background: 'var(--panel2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text-dim)', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={!reason.trim()}
            style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: '#fff', opacity: reason.trim() ? 1 : 0.5 }}>
            Reject Request
          </button>
        </div>
      </div>
    </div>
  )
}
