const lotusPetals = (cx, cy, r, petals, rotation = 0, fillOpacity = 0.16, strokeOpacity = 0.62) => {
  const nodes = []

  for (let index = 0; index < petals; index += 1) {
    const angle = rotation + ((Math.PI * 2) * index) / petals
    const x = cx + Math.cos(angle) * r * 0.58
    const y = cy + Math.sin(angle) * r * 0.58
    const rotate = (angle * 180) / Math.PI + 90

    nodes.push(
      <g key={`${cx}-${cy}-${index}`} transform={`translate(${x} ${y}) rotate(${rotate})`}>
        <ellipse
          cx="0"
          cy="0"
          rx={r * 0.20}
          ry={r * 0.92}
          fill={`rgba(247, 216, 155, ${fillOpacity})`}
          stroke="var(--jsm-gold-500)"
          strokeOpacity={strokeOpacity}
          strokeWidth="1.12"
        />
      </g>,
    )
  }

  return nodes
}

const lotusBud = (cx, cy, r, opacity = 0.66) => (
  <g>
    <path
      d={`M ${cx} ${cy - r * 0.56}
          C ${cx + r * 0.10} ${cy - r * 0.18}, ${cx + r * 0.08} ${cy + r * 0.16}, ${cx} ${cy + r * 0.38}
          C ${cx - r * 0.08} ${cy + r * 0.16}, ${cx - r * 0.10} ${cy - r * 0.18}, ${cx} ${cy - r * 0.56} Z`}
      fill={`rgba(247, 216, 155, ${opacity * 0.18})`}
      stroke="var(--jsm-gold-500)"
      strokeOpacity={opacity}
      strokeWidth="1.04"
    />
    <path
      d={`M ${cx - r * 0.20} ${cy - r * 0.06} C ${cx - r * 0.05} ${cy - r * 0.30}, ${cx - r * 0.02} ${cy - r * 0.06}, ${cx} ${cy + r * 0.22}`}
      fill="none"
      stroke="var(--jsm-gold-500)"
      strokeOpacity={opacity * 0.78}
      strokeWidth="0.95"
      strokeLinecap="round"
    />
    <path
      d={`M ${cx + r * 0.20} ${cy - r * 0.06} C ${cx + r * 0.05} ${cy - r * 0.30}, ${cx + r * 0.02} ${cy - r * 0.06}, ${cx} ${cy + r * 0.22}`}
      fill="none"
      stroke="var(--jsm-gold-500)"
      strokeOpacity={opacity * 0.78}
      strokeWidth="0.95"
      strokeLinecap="round"
    />
  </g>
)

const lotusRing = (cx, cy, r, petals, rotation = 0, opacity = 0.62) => (
  <g>
    <circle cx={cx} cy={cy} r={r * 0.14} fill={`rgba(214, 162, 79, ${opacity * 0.30})`} />
    <circle cx={cx} cy={cy} r={r * 0.20} fill={`rgba(247, 216, 155, ${opacity * 0.14})`} />
    <circle cx={cx} cy={cy} r={r * 0.78} fill="none" stroke="var(--jsm-gold-500)" strokeOpacity={opacity * 0.78} strokeWidth="1.05" />
    {lotusPetals(cx, cy, r, petals, rotation, 0.12, opacity)}
  </g>
)

const BrandDoodleBackground = () => {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-28 right-[-96px] h-[320px] w-[320px] rounded-full bg-gold-600/6 blur-[120px]" />
      <div className="absolute bottom-[-120px] left-[-96px] h-[260px] w-[260px] rounded-full bg-gold-500/6 blur-[120px]" />

      <svg
        className="absolute left-[8%] top-[8%] h-[420px] w-[420px] opacity-[0.24] dark:opacity-[0.18]"
        viewBox="0 0 520 520"
        fill="none"
      >
        <g strokeLinecap="round" strokeLinejoin="round">
          {lotusRing(210, 176, 48, 7, Math.PI / 10, 0.72)}
          {lotusBud(364, 150, 20, 0.58)}
        </g>
      </svg>

      <svg
        className="absolute right-[8%] bottom-[10%] h-[180px] w-[180px] opacity-[0.18] dark:opacity-[0.12]"
        viewBox="0 0 360 360"
        fill="none"
      >
        <g strokeLinecap="round" strokeLinejoin="round">
          {lotusBud(180, 180, 28, 0.54)}
        </g>
      </svg>
    </div>
  )
}

export default BrandDoodleBackground
