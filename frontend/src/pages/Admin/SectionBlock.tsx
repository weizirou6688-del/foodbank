import type { ReactNode } from 'react'

interface SectionBlockProps {
  id?: string
  title: string
  description?: string
  subtitle?: string
  children: ReactNode
}

export function SectionBlock({
  id,
  title,
  description,
  subtitle,
  children,
}: SectionBlockProps) {
  const supportingText = description ?? subtitle

  return (
    <section className="section" id={id}>
      <div className="container">
        <h2 className="section-title">{title}</h2>
        {supportingText ? <p className="section-subtitle">{supportingText}</p> : null}
        {children}
      </div>
    </section>
  )
}
