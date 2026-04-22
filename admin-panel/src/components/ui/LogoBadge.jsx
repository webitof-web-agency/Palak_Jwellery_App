export default function LogoBadge({
  src,
  alt = 'Logo',
  className = '',
  wrapperClassName = '',
}) {
  return (
    <div
      className={`overflow-hidden border panel-border surface-panel rounded-full ${wrapperClassName}`.trim()}
    >
      <img
        src={src}
        alt={alt}
        className={`h-full w-full object-cover rounded-full ${className}`.trim()}
      />
    </div>
  )
}
