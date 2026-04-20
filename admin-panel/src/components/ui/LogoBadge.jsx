export default function LogoBadge({
  src,
  alt = 'Logo',
  className = '',
  wrapperClassName = '',
}) {
  return (
    <div className={`overflow-hidden border panel-border surface-panel ${wrapperClassName}`.trim()}>
      <img src={src} alt={alt} className={`h-full w-full object-cover ${className}`.trim()} />
    </div>
  )
}
