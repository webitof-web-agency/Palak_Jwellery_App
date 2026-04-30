export default function LogoBadge({
  src,
  alt = 'Logo',
  className = '',
  wrapperClassName = '',
}) {
  return (
    <div
      className={`inline-flex aspect-square flex-none items-center justify-center overflow-hidden rounded-full ${wrapperClassName}`.trim()}
    >
      <img
        src={src}
        alt={alt}
        className={`block h-full w-full object-cover rounded-full ${className}`.trim()}
      />
    </div>
  )
}
