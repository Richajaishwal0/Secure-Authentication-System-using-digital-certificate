import { useState } from 'react'
import { api } from '../api'

export default function Certificates() {
  const [list, setList]           = useState(null)
  const [serial, setSerial]       = useState('')
  const [detail, setDetail]       = useState('')
  const [detailStatus, setDetailStatus] = useState('')
  const [listLoading, setListLoading]   = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  async function handleList() {
    setListLoading(true)
    setList(null)
    try {
      const { data } = await api.listCerts()
      setList(data)
    } catch { setList([]) }
    finally { setListLoading(false) }
  }

  async function handleLookup() {
    if (!serial.trim()) return
    setDetailLoading(true)
    setDetail('')
    setDetailStatus('')
    try {
      const { data } = await api.getCert(serial.trim())
      setDetail(
        `Serial      : ${data.serial}\n` +
        `Common Name : ${data.common_name}\n` +
        `Email       : ${data.email}\n` +
        `Org         : ${data.org}\n` +
        `Template    : ${data.template}\n` +
        `Issued By   : ${data.issued_by}\n` +
        `Not Before  : ${data.not_before}\n` +
        `Not After   : ${data.not_after}\n` +
        `Revoked     : ${data.revoked ? 'YES' : 'NO'}` +
        (data.revocation ? `\nRev Reason  : ${data.revocation.reason}\nRevoked At  : ${data.revocation.revoked_at}` : '') +
        `\n\n--- PEM CERTIFICATE ---\n${data.pem}`
      )
      setDetailStatus(data.revoked ? 'warning' : 'success')
    } catch (e) {
      setDetail(e.response?.data?.detail || e.message)
      setDetailStatus('danger')
    } finally { setDetailLoading(false) }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title">Certificates</div>
        <div className="page-desc">Browse all issued certificates and inspect details by serial number.</div>
      </div>

      <div className="card">
        <div className="card-title"><span className="card-title-icon">🗂️</span>All Issued Certificates</div>
        <div className="card-divider" />
        <div className="btn-row" style={{ marginTop: 0 }}>
          <button className="btn btn-accent" onClick={handleList} disabled={listLoading}>
            {listLoading ? <><span className="btn-spinner" /> Loading…</> : '🗂️  Load Certificates'}
          </button>
          {list && <span className="badge badge-cyan">{list.length} total</span>}
        </div>

        {list !== null && (
          list.length === 0
            ? <pre className="result-box">No certificates issued yet.</pre>
            : <div style={{ overflowX: 'auto', marginTop: 4 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      {['Serial', 'Name', 'Email', 'Template', 'Issued By', 'Expires', 'Status'].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.map(c => (
                      <tr key={c.serial} onClick={() => setSerial(c.serial)}>
                        <td className="mono">{c.serial.slice(0, 14)}…</td>
                        <td style={{ color: 'var(--text)', fontWeight: 500 }}>{c.common_name}</td>
                        <td>{c.email}</td>
                        <td><span className="badge badge-cyan" style={{ fontSize: 10 }}>{c.template}</span></td>
                        <td>{c.issued_by}</td>
                        <td className="mono">{c.not_after?.slice(0, 10)}</td>
                        <td>
                          <span className={`status-dot ${c.revoked ? 'revoked' : 'valid'}`}>
                            {c.revoked ? 'Revoked' : 'Valid'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="desc" style={{ marginTop: 10, marginBottom: 0 }}>
                  Click any row to populate the serial number below.
                </p>
              </div>
        )}
      </div>

      <div className="card">
        <div className="card-title"><span className="card-title-icon">🔎</span>Certificate Detail Lookup</div>
        <div className="card-divider" />
        <div className="form-group">
          <label>Serial Number</label>
          <input type="text" value={serial} onChange={e => setSerial(e.target.value)}
            placeholder="Paste serial or click a row above" />
        </div>
        <div className="btn-row">
          <button className="btn btn-cyan" onClick={handleLookup} disabled={detailLoading || !serial.trim()}>
            {detailLoading ? <><span className="btn-spinner" /> Looking up…</> : '🔎  Get Certificate'}
          </button>
        </div>
        {detail && <pre className={`result-box ${detailStatus}`}>{detail}</pre>}
      </div>
    </>
  )
}
