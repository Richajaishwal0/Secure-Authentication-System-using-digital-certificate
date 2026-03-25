import axios from 'axios'

const http = axios.create({ baseURL: '/' })

// Attach token to every request if present
http.interceptors.request.use(cfg => {
  const token = sessionStorage.getItem('ca_token')
  if (token) cfg.headers['Authorization'] = `Bearer ${token}`
  return cfg
})

export const api = {
  // Auth
  login:         (data)   => http.post('/api/auth/login', data),
  logout:        ()       => http.post('/api/auth/logout'),
  me:            ()       => http.get('/api/auth/me'),
  initCA:        ()       => http.post('/api/ca/init'),
  regenerateCA:  (data)   => http.post('/api/ca/regenerate', data),
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
  deleteCert:    (serial) => http.delete(`/api/certs/${serial}`),

  // CRL
  getCRL:        ()       => http.get('/api/crl'),
  rebuildCRL:    ()       => http.post('/api/crl/rebuild'),

  // Audit
  getAudit:      ()       => http.get('/api/audit'),
  clearAudit:    ()       => http.delete('/api/audit/clear'),

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

  // Settings
  getSmtp:       ()       => http.get('/api/settings/smtp'),
  saveSmtp:      (data)   => http.post('/api/settings/smtp', data),
  testSmtp:      (data)   => http.post('/api/settings/smtp/test', data),

  // Download as PKCS#12 (.p12) bundle
  downloadP12:   (serial, password) => http.get(`/api/certs/${serial}/download/p12`, {
    params:       { password },
    responseType: 'blob',
  }),

  // Self-service requests
  submitRequest: (data)   => http.post('/api/requests/', data),
  listRequests:  (status) => http.get('/api/requests/', { params: status ? { status } : {} }),
  approveRequest:(id)     => http.post(`/api/requests/${id}/approve`),
  rejectRequest: (id, reason) => http.post(`/api/requests/${id}/reject`, { reason }),
}
