export default function SectionCard({
  eyebrow,
  title,
  description,
  actions,
  children,
  className = "",
}) {
  return (
    <section className={`surface-card ${className}`.trim()}>
      {eyebrow || title || description || actions ? (
        <div className="surface-card__header">
          <div>
            {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
            {title ? (
              <h2 className="text-xl font-bold font-display text-heading">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm text-muted">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex items-center gap-3">{actions}</div>
          ) : null}
        </div>
      ) : null}

      {children}
    </section>
  );
}
