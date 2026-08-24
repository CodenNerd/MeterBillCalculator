'use client'

import { useEffect, useState } from 'react'
import { AdminGate, useBilling } from '../../../components/providers/BillingProvider'
import { fetchComplexSettings, saveComplexSettings } from '../../../services/supabase'
import { defaultComplexSettings, RATE_PER_UNIT } from '../../../utils/billing'
import { navigate } from '../../../utils/navigation'

export default function SettingsPage() {
  const { complex, setComplex, showToast, href } = useBilling()
  const [form, setForm] = useState(() => defaultComplexSettings())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!complex?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    fetchComplexSettings(complex.id)
      .then(data => {
        setForm(defaultComplexSettings(data || complex))
      })
      .catch(() => setError('Failed to load settings.'))
      .finally(() => setLoading(false))
  }, [complex?.id])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!complex?.id) return
    setSaving(true)
    setError(null)
    try {
      const saved = await saveComplexSettings(complex.id, form)
      setComplex(saved)
      setForm(defaultComplexSettings(saved))
      showToast('Settings saved')
    } catch {
      setError('Could not save settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminGate showHome>
      <main className="main">
        <div className="page-nav">
          <button type="button" className="btn-text" onClick={() => navigate(href('/'))}>
            ← Home
          </button>
        </div>

        <header className="cycle-page-titles">
          <h1 className="page-title">Settings</h1>
          <p className="page-lede">
            Plaza defaults used on invoices, worksheets, and the home banner.
          </p>
        </header>

        {loading && (
          <div className="status-screen">
            <div className="spinner" />
            <p>Loading settings...</p>
          </div>
        )}

        {!loading && (
          <form className="card settings-card" onSubmit={handleSubmit}>
            {error && <p className="error-text">{error}</p>}

            <div className="settings-section">
              <h2 className="section-title">Billing rate</h2>
              <div className="input-wrap">
                <label htmlFor="rate">₦ per kWh</label>
                <input
                  id="rate"
                  type="number"
                  className="reading-input"
                  min="1"
                  step="1"
                  value={form.rate_per_unit}
                  onChange={e => setForm({ ...form, rate_per_unit: e.target.value })}
                />
                <p className="alloc-hint">Default is ₦{RATE_PER_UNIT}/kWh.</p>
              </div>
            </div>

            <div className="settings-section">
              <h2 className="section-title">Pay-into account</h2>
              <div className="settings-grid">
                <div className="input-wrap">
                  <label htmlFor="account-name">Account name</label>
                  <input
                    id="account-name"
                    className="reading-input"
                    value={form.account_name}
                    onChange={e => setForm({ ...form, account_name: e.target.value })}
                    placeholder="e.g. Demo Plaza Ltd"
                  />
                </div>
                <div className="input-wrap">
                  <label htmlFor="bank-name">Bank</label>
                  <input
                    id="bank-name"
                    className="reading-input"
                    value={form.bank_name}
                    onChange={e => setForm({ ...form, bank_name: e.target.value })}
                    placeholder="e.g. GTBank"
                  />
                </div>
                <div className="input-wrap">
                  <label htmlFor="account-number">Account number</label>
                  <input
                    id="account-number"
                    className="reading-input"
                    value={form.account_number}
                    onChange={e => setForm({ ...form, account_number: e.target.value })}
                    placeholder="0123456789"
                  />
                </div>
              </div>
            </div>

            <div className="settings-section">
              <h2 className="section-title">Home banner</h2>
              <label className="settings-check">
                <input
                  type="checkbox"
                  checked={form.banner_enabled}
                  onChange={e => setForm({ ...form, banner_enabled: e.target.checked })}
                />
                Show banner on Home
              </label>
              <div className="input-wrap" style={{ marginTop: 12 }}>
                <label htmlFor="banner-text">Banner text</label>
                <textarea
                  id="banner-text"
                  className="reading-input settings-textarea"
                  rows={3}
                  value={form.banner_text}
                  onChange={e => setForm({ ...form, banner_text: e.target.value })}
                  placeholder="e.g. Please pay March bills by the 10th."
                  disabled={!form.banner_enabled}
                />
              </div>
            </div>

            <div className="dialog-actions" style={{ marginTop: 8 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save settings'}
              </button>
            </div>
          </form>
        )}
      </main>
    </AdminGate>
  )
}
