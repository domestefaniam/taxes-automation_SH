const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed ${res.status}`)
  }
  return res.json()
}

export const apiService = {
  health() {
    return request('/health')
  },
  getPayments() {
    return request('/payments')
  },
  getPaymentsSummary() {
    return request('/payments/summary')
  },
  getPendingBills() {
    return request('/parcel-taxes/pending')
  },
  registerPayment(payload) {
    return request('/payments/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  }
}


