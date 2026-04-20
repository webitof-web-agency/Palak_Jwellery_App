const ThemeToggleIcon = ({ themeName }) => {
  const isLight = themeName === "roseLight";

  return isLight ? (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="6.75"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.35"
      />
      <circle
        cx="12"
        cy="12"
        r="4.25"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M12 2.8v2.4M12 18.8v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="8.5"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity="0.35"
      />
      <path
        d="M15.8 12.6A6.6 6.6 0 1 1 11.4 4.2a5.2 5.2 0 0 0 4.4 8.4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default function ThemeToggleButton({
  themeName,
  onClick,
  className = "",
  size = "md",
  position = "inline",
  ariaLabel,
}) {
  const sizeClass = size === "sm" ? "h-10 w-10" : "h-11 w-11";
  const positionClass =
    position === "floating"
      ? "hidden lg:flex absolute top-6 right-6 z-20"
      : "flex";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        ariaLabel ||
        (themeName === "midnightRose"
          ? "Switch to light mode"
          : "Switch to dark mode")
      }
      className={`${positionClass} ${sizeClass} items-center justify-center rounded-full border panel-border surface-panel text-heading shadow-none lg:shadow-lg lg:shadow-black/20 backdrop-blur-sm ${className}`.trim()}
    >
      <ThemeToggleIcon themeName={themeName} />
    </button>
  );
}
