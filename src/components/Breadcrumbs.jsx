'use client'

import Link from 'next/link'

/**
 * @param {{ label: string, href?: string }[]} items
 * Last item is current page (no link) unless href is set.
 */
export default function Breadcrumbs({ items = [] }) {
  if (!items.length) return null

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol className="breadcrumbs-list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className="breadcrumbs-item">
              {index > 0 && (
                <span className="breadcrumbs-sep" aria-hidden="true">
                  /
                </span>
              )}
              {item.href && !isLast ? (
                <Link href={item.href} className="breadcrumbs-link" prefetch>
                  {item.label}
                </Link>
              ) : isLast ? (
                <span className="breadcrumbs-current" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <span className="breadcrumbs-muted">{item.label}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
