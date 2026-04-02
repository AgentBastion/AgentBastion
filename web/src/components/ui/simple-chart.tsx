interface BarChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
}

export function SimpleBarChart({ data, height = 192, color = 'hsl(var(--primary))', formatValue }: BarChartProps) {
  if (data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.value), 1);
  const barWidth = Math.max(4, Math.min(32, Math.floor(600 / data.length) - 4));
  const chartWidth = data.length * (barWidth + 4);
  const chartH = height - 32; // leave room for labels

  return (
    <div className="w-full overflow-x-auto">
      <svg width={Math.max(chartWidth, 200)} height={height} className="mx-auto" role="img">
        {data.map((d, i) => {
          const barH = (d.value / max) * chartH;
          const x = i * (barWidth + 4) + 2;
          const y = chartH - barH;
          return (
            <g key={i}>
              <title>{`${d.label}: ${formatValue ? formatValue(d.value) : d.value.toLocaleString()}`}</title>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barH, 1)}
                rx={2}
                fill={color}
                opacity={0.85}
              />
              {/* Show label for every Nth bar to avoid overlap */}
              {(data.length <= 15 || i % Math.ceil(data.length / 15) === 0) && (
                <text
                  x={x + barWidth / 2}
                  y={chartH + 14}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  fontSize={10}
                >
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
        {/* Y-axis baseline */}
        <line x1={0} y1={chartH} x2={chartWidth} y2={chartH} stroke="currentColor" strokeOpacity={0.1} />
      </svg>
    </div>
  );
}

interface LineChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
}

export function SimpleLineChart({ data, height = 192, color = 'hsl(var(--primary))', formatValue }: LineChartProps) {
  if (data.length < 2) return null;

  const max = Math.max(...data.map((d) => d.value), 1);
  const chartW = Math.max(data.length * 40, 200);
  const chartH = height - 32;
  const stepX = (chartW - 20) / (data.length - 1);

  const points = data.map((d, i) => {
    const x = 10 + i * stepX;
    const y = chartH - (d.value / max) * chartH + 4;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartH} L ${points[0].x} ${chartH} Z`;

  return (
    <div className="w-full overflow-x-auto">
      <svg width={chartW} height={height} className="mx-auto" role="img">
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#areaFill)" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} />
        {points.map((p, i) => (
          <g key={i}>
            <title>{`${p.label}: ${formatValue ? formatValue(p.value) : p.value.toLocaleString()}`}</title>
            <circle cx={p.x} cy={p.y} r={3} fill={color} />
            {(data.length <= 12 || i % Math.ceil(data.length / 12) === 0) && (
              <text
                x={p.x}
                y={chartH + 16}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize={10}
              >
                {p.label}
              </text>
            )}
          </g>
        ))}
        <line x1={0} y1={chartH} x2={chartW} y2={chartH} stroke="currentColor" strokeOpacity={0.1} />
      </svg>
    </div>
  );
}
