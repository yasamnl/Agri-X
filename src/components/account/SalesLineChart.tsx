// src/components/account/SalesLineChart.tsx
'use client';

import type { ChartDataPoint } from '@/lib/seller-api';

interface SalesLineChartProps {
  data: ChartDataPoint[];
  height?: number;
  mode?: 'revenue' | 'orders';
}

export function SalesLineChart({
  data,
  height = 250,
  mode = 'revenue',
}: SalesLineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-text-secondary">
        <p className="text-sm">Belum ada data penjualan</p>
      </div>
    );
  }

  const width = 600;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // ✅ Get values based on mode
  const values = data.map((d) => (mode === 'revenue' ? d.revenue : d.orders));
  const maxValue = Math.max(...values, 1);
  const minValue = 0;

  // Generate points
  const points = data.map((d, i) => {
    const value = mode === 'revenue' ? d.revenue : d.orders;
    const x = padding.left + (i / (data.length - 1 || 1)) * chartWidth;
    const y =
      padding.top +
      chartHeight -
      ((value - minValue) / (maxValue - minValue || 1)) * chartHeight;
    return { x, y, data: d, value };
  });

  // Generate paths
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${
    padding.top + chartHeight
  } L ${points[0].x} ${padding.top + chartHeight} Z`;

  // Y-axis labels
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    value: minValue + (maxValue - minValue) * pct,
    y: padding.top + chartHeight - pct * chartHeight,
  }));

  const formatYLabel = (value: number) => {
    if (mode === 'revenue') {
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
      return value.toFixed(0);
    }
    return Math.round(value).toString();
  };

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto min-w-[400px]"
      >
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#166534" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#166534" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#166534" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yLabels.map((label, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              y1={label.y}
              x2={width - padding.right}
              y2={label.y}
              stroke="currentColor"
              strokeOpacity="0.1"
              strokeDasharray="4 4"
              className="text-text-primary"
            />
            <text
              x={padding.left - 10}
              y={label.y + 4}
              textAnchor="end"
              fontSize="10"
              fill="currentColor"
              className="text-text-secondary"
            >
              {formatYLabel(label.value)}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#areaGradient)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="url(#lineGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points & Labels */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r="6"
              fill="white"
              stroke="#166534"
              strokeWidth="2"
            />
            <circle cx={p.x} cy={p.y} r="3" fill="#166534" />
            <text
              x={p.x}
              y={height - 10}
              textAnchor="middle"
              fontSize="11"
              fill="currentColor"
              className="text-text-secondary"
            >
              {p.data.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}