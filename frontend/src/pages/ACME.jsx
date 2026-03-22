import { useState } from 'react'
import { api } from '../api'
import { RefreshCw, Bell, Info } from 'lucide-react'

export default function ACME() {
  const [domain, setDomain] = useState('example.com')
  const [email, setEmail]   = useState('admin@example.com')
  const [result, setResult] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState('')

  async function handleOrder() {
    setLoading('order'); setResult(''); setStatus('')
    try {
      const { data } = await api.acmeOrder({ domain, email, account_key: 'demo-key' })
      setResult(
        `Order ID      : ${data.order_id}\n` +
        `Domain        : ${data.domain}\n` +
        `Status        : ${data.status}\n` +
        `Token         : ${data.token.slice(0,20)}…\n` +
        `Challenge URL : ${data.challenge_url}\n` +
        `Validate URL  : ${data.validate_url}\n` +
        `Finalize URL  : ${data.finalize_url}\n` +
        `Expires At    : ${data.expires_at}\n\n` +
        `Next steps:\n` +
        `  1. Place key_auth at the challenge URL\n` +
        `  2. Call validate endpoint\n` +
        `  3. Submit CSR to finalize and receive certificate`
      )
      setStatus('success')
    } catch (e) {
      setResult(`${e.response?.data?.detail || e.message}\n\nMake sure the API server is running:\n  uvicorn api.main:app --reload --port 8000`)
      setStatus('danger')
    } finally { setLoading('') }
  }

  async function handleRenewals() {
    setLoading('renewals'); setResult(''); setStatus('')
    try {
      const { data } = await api.acmeRenewals(30)
      if (!data.length) {
        setResult('✓  No certificates expiring in the next 30 days.')
        setStatus('success')
        return
      }
      setResult(
        `${data.length} certificate(s) due for renewal:\n\n` +
        data.map(c =>
          `Serial    : ${c.serial}\n` +
          `Name      : ${c.common_name}\n` +
          `Email     : ${c.email}\n` +
          `Expires   : ${c.not_after}\n` +
          `Days Left : ${c.days_left}\n`
        ).join('\n')
      )
      setStatus('warning')
    } catch (e) {
      setResult(`${e.response?.data?.detail || e.message}\n\nMake sure the API server is running:\n  uvicorn api.main:app --reload --port 8000`)
      setStatus('danger')
    } finally { setLoading('') }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title">ACME Protocol</div>
        <div className="page-desc">Automated Certificate Management Environment (RFC 8555) — the protocol used by Let's Encrypt.</div>
      </div>

      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><RefreshCw size={15} /> ACME Certificate Order</div>
        <div className="card-divider" />
        <div className="info-box">
          <Info size={14} style={{ flexShrink: 0 }} />
          ACME automates certificate issuance and renewal without human interaction.
          The CA issues a challenge token the client must serve at a well-known URL to prove domain ownership.
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label>Domain</label>
            <input type="text" value={domain} onChange={e => setDomain(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
        </div>
        <div className="btn-row">
          <button className="btn btn-warning" onClick={handleOrder} disabled={!!loading}>
            {loading === 'order' ? <><span className="btn-spinner" /> Ordering…</> : <><RefreshCw size={14} style={{ marginRight: 6 }} />Simulate ACME Order</>}
          </button>
          <button className="btn btn-cyan" onClick={handleRenewals} disabled={!!loading}>
            {loading === 'renewals' ? <><span className="btn-spinner" /> Checking…</> : <><Bell size={14} style={{ marginRight: 6 }} />Check Renewals Due</>}
          </button>
        </div>
        {result && <pre className={`result-box ${status}`}>{result}</pre>}
      </div>
    </>
  )
}
