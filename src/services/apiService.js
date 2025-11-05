const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

function trimTrailingSlash(s) {
  return typeof s === 'string' ? s.replace(/\/+$/, '') : s
}

function trimLeadingSlash(s) {
  return typeof s === 'string' ? s.replace(/^\/+/, '') : s
}

function joinUrl(base, path) {
  const b = trimTrailingSlash(base || '')
  const p = `/${trimLeadingSlash(path || '')}`
  return `${b}${p}`
}

function baseEndsWithApi(base) {
  if (!base) return false
  const b = trimTrailingSlash(base)
  return /\/api$/i.test(b)
}

async function request(path, options = {}) {
  const primaryUrl = joinUrl(API_BASE, path)

  let res = await fetch(primaryUrl, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })

  // Fallback: si 404 y la base no termina en /api, reintentar agregando /api
  if (!res.ok && res.status === 404 && !baseEndsWithApi(API_BASE) && !/^\/api\b/.test(path)) {
    const fallbackUrl = joinUrl(joinUrl(API_BASE, '/api'), path)
    res = await fetch(fallbackUrl, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`[${res.status}] ${fallbackUrl}\n${text || res.statusText}`)
    }
    return res.json()
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`[${res.status}] ${primaryUrl}\n${text || res.statusText}`)
  }
  return res.json()
}

export const apiService = {
  health() {
    return request('/health')
  },
  getPropertiesWithTotals(year) {
    const qs = year ? `?year=${encodeURIComponent(year)}` : ''
    return request(`/properties${qs}`)
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
  createBill(payload) {
    return request('/parcel-taxes', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },
  registerPayment(payload) {
    return request('/payments/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  }
}


