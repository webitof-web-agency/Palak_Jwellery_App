export default function LogoBadge({
  src,
  alt = "Logo",
  className = "",
  wrapperClassName = "",
}) {
  return (
    <div
      className={`inline-flex my-4 aspect-square flex-none items-center border border-gold-600/50 justify-center overflow-hidden rounded-full ${wrapperClassName}`.trim()}
    >
      <img
        src={src}
        alt={alt}
        className={`block h-full w-full object-cover rounded-full ${className}`.trim()}
      />
    </div>
  );
}
