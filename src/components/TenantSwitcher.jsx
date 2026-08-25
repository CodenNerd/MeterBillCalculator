'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { memo, useEffect, useMemo } from 'react'

const SELECT_THRESHOLD = 6

/**
 * Named tenant control: segmented buttons when few, select when many.
 * Uses replace + scroll:false so switching tenants does not feel like a reload.
 *
 * @param {{ id: string|number, name: string, href: string }[]} tenants
 */
function TenantSwitcher({
  tenants = [],
  currentId,
  ariaLabel = 'Switch tenant',
  showBounds = true,
}) {
  const router = useRouter()
  const list = useMemo(
    () => (tenants || []).filter(t => t && t.href),
    [tenants],
  )
  const index = list.findIndex(t => String(t.id) === String(currentId))
  const current = index >= 0 ? list[index] : null
  const prev = index > 0 ? list[index - 1] : null
  const next = index >= 0 && index < list.length - 1 ? list[index + 1] : null
  const useSelect = list.length > SELECT_THRESHOLD

  function go(href) {
    if (!href) return
    router.replace(href, { scroll: false })
  }

  useEffect(() => {
    for (const t of list) {
      if (t.href) router.prefetch(t.href)
    }
  }, [list, router])

  if (list.length < 2) return null

  return (
    <div className="tenant-switcher" role="navigation" aria-label={ariaLabel}>
      {showBounds && (
        <button
          type="button"
          className="btn btn-sm btn-ghost tenant-switcher-bound"
          disabled={!prev}
          onClick={() => go(prev?.href)}
        >
          ‹
        </button>
      )}

      {useSelect ? (
        <label className="tenant-switcher-select-wrap">
          <span className="sr-only">{ariaLabel}</span>
          <select
            className="tenant-switcher-select reading-input"
            value={String(currentId)}
            onChange={e => {
              const t = list.find(row => String(row.id) === e.target.value)
              if (t) go(t.href)
            }}
          >
            {list.map(t => (
              <option key={t.id} value={String(t.id)}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="tenant-switcher-toggle" role="group">
          {list.map(t => {
            const active = String(t.id) === String(currentId)
            return (
              <Link
                key={t.id}
                href={t.href}
                prefetch
                scroll={false}
                replace
                className={`tenant-switcher-tab ${active ? 'is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {t.name}
              </Link>
            )
          })}
        </div>
      )}

      {showBounds && (
        <button
          type="button"
          className="btn btn-sm btn-ghost tenant-switcher-bound"
          disabled={!next}
          onClick={() => go(next?.href)}
          title={next ? next.name : undefined}
        >
          ›
        </button>
      )}

      {current && useSelect && (
        <span className="sr-only">Current: {current.name}</span>
      )}
    </div>
  )
}

export default memo(TenantSwitcher)
