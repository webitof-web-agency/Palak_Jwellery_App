export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="page-hero">
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1 className="text-4xl font-bold font-display gold-gradient-text tracking-tight">{title}</h1>
        {description ? <p className="mt-2 text-muted">{description}</p> : null}
      </div>

      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </header>
  )
}
