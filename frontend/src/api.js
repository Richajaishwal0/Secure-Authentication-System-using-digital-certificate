import axios from 'axios'

const http = axios.create({ baseURL: '/' })

export const api = {
  // CA
  initCA:        ()       => http.post('/api/ca/init'),
  caStatus:      ()       => http.get('/api/ca/status'),

  // Certificates
  issueCert:     (data)   => http.post('/api/certs/issue', data),
  listCerts:     ()       => http.get('/api/certs/'),
  getCert:       (serial) => http.get(`/api/certs/${serial}`),
  verifyCert:    (file)   => {
    const fd = new FormData()
    fd.append('file', file)
    return http.post('/api/certs/verify', fd)
  },
  revokeCert:    (data)   => http.post('/api/certs/revoke', data),

  // CRL
  getCRL:        ()       => http.get('/api/crl'),
  rebuildCRL:    ()       => http.post('/api/crl/rebuild'),

  // Audit
  getAudit:      ()       => http.get('/api/audit'),

  // OCSP
  ocspStatus:    (serial) => http.get(`/ocsp/status/${serial}`),

  // ACME
  acmeOrder:     (data)   => http.post('/acme/order', data),
  acmeRenewals:  (days)   => http.get(`/acme/renewals/due?days_ahead=${days}`),
  acmeValidate:  (token)  => http.post(`/acme/challenge/${token}/validate`),
  acmeFinalize:  (id, data) => http.post(`/acme/finalize/${id}`, data),

  // Dashboard
  dashStats:     ()       => http.get('/api/dashboard/stats'),
  dashExpiring:  (days)   => http.get(`/api/dashboard/expiring?days=${days}`),
  dashRenewals:  ()       => http.get('/api/dashboard/renewals'),

  // Policy
  listPolicies:  ()       => http.get('/api/policy/'),
  upsertPolicy:  (data)   => http.post('/api/policy/', data),
  deletePolicy:  (tmpl)   => http.delete(`/api/policy/${tmpl}`),
  triggerJob:    (job)    => http.post(`/api/policy/trigger/${job}`),

  // Self-service requests
  submitRequest: (data)   => http.post('/api/requests/', data),
  listRequests:  (status) => http.get('/api/requests/', { params: status ? { status } : {} }),
  approveRequest:(id)     => http.post(`/api/requests/${id}/approve`),
  rejectRequest: (id, reason) => http.post(`/api/requests/${id}/reject`, { reason }),
}
