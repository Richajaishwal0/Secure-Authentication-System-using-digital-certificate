import { useState } from 'react'
import { api } from '../api'

export default function InitCA() {
  const [data, setData]     = useState(null)
  const [result, setResult] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleInit() {
    setLoading(true)
    setResult('')
    setStatus('')
    setData(null)
    try {
      const { data: d } = await api.initCA()
      setData(d)
      setResult(
        `Subject     : ${d.subject}\n` +
        `Issuer      : ${d.issuer}\n` +
        `Serial      : ${d.serial}\n` +
        `Valid From  : ${d.not_before}\n` +
        `Valid Until : ${d.not_after}\n` +
        `Key Size    : ${d.key_size} bits (RSA)\n` +
        `Algorithm   : ${d.algorithm}\n\n` +
        `✓  CA is ready to issue certificates.`
      )
      setStatus('success')
    } catch (e) {
      setResult(`Error: ${e.response?.data?.detail || e.message}`)
      setStatus('danger')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title">Root Certificate Authority</div>
        <div className="page-desc">Initialize and manage the Root CA — the trust anchor of your PKI system.</div>
      </div>

      {data && (
        <div className="stat-grid">
          {[
            { label: 'Key Algorithm', value: 'RSA-2048',   sub: 'Asymmetric' },
            { label: 'Signature',     value: 'SHA-256',    sub: 'Hash algorithm' },
            { label: 'Certificate',   value: 'X.509 v3',  sub: 'Standard' },
            { label: 'Status',        value: 'Active',     sub: 'CA is ready' },
          ].map(s => (
            <div className="stat-card" key={s.label}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-title">
          <span className="card-title-icon">🏛️</span>
          Initialize Root CA
        </div>
        <div className="card-divider" />
        <div className="info-box">
          <span className="info-box-icon">ℹ️</span>
          Generates an RSA-2048 key pair and a self-signed X.509 v3 certificate.
          Safe to run multiple times — loads the existing CA if already initialized.
        </div>
        <div className="btn-row">
          <button className="btn btn-accent" onClick={handleInit} disabled={loading}>
            {loading ? <><span className="btn-spinner" /> Initializing…</> : '🏛️  Initialize CA'}
          </button>
          {status && (
            <span className={`badge badge-${status}`}>
              {status === 'success' ? '✓ CA READY' : '✗ FAILED'}
            </span>
          )}
        </div>
        {result && <pre className={`result-box ${status}`}>{result}</pre>}
      </div>
    </>
  )
}
