import React, { useState, useMemo } from 'react';

export type ChartType = 'bar' | 'line' | 'pie' | 'area';

interface ChartData {
  rows: Record<string, any>[];
  columns: string[];
}

interface DataChartProps {
  data: ChartData;
  onClose?: () => void;
}

export function DataChart({ data, onClose }: DataChartProps) {
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [labelColumn, setLabelColumn] = useState<string>('');
  const [valueColumns, setValueColumns] = useState<string[]>([]);
  const { numericColumns, stringColumns } = useMemo(() => {
    const numeric: string[] = [];
    const strings: string[] = [];

    if (data.rows.length > 0) {
      data.columns.forEach(col => {
        const sampleValues = data.rows.slice(0, 10).map(row => row[col]);
        const isNumeric = sampleValues.every(v => 
          v === null || v === undefined || !isNaN(Number(v))
        );
        if (isNumeric) {
          numeric.push(col);
        } else {
          strings.push(col);
        }
      });
    }

    return { numericColumns: numeric, stringColumns: strings };
  }, [data]);
  React.useEffect(() => {
    if (stringColumns.length > 0 && !labelColumn) {
      setLabelColumn(stringColumns[0]);
    }
    if (numericColumns.length > 0 && valueColumns.length === 0) {
      setValueColumns([numericColumns[0]]);
    }
  }, [numericColumns, stringColumns]);
  const chartData = useMemo(() => {
    if (!labelColumn || valueColumns.length === 0) return [];

    return data.rows.slice(0, 50).map(row => ({
      label: String(row[labelColumn] || ''),
      values: valueColumns.map(col => Number(row[col]) || 0)
    }));
  }, [data.rows, labelColumn, valueColumns]);
  const maxValue = useMemo(() => {
    let max = 0;
    chartData.forEach(item => {
      item.values.forEach(v => {
        if (v > max) max = v;
      });
    });
    return max || 1;
  }, [chartData]);
  const colors = [
    'var(--ctp-blue)',
    'var(--ctp-green)',
    'var(--ctp-peach)',
    'var(--ctp-mauve)',
    'var(--ctp-pink)',
    'var(--ctp-teal)',
    'var(--ctp-yellow)',
    'var(--ctp-red)'
  ];
  const toggleValueColumn = (col: string) => {
    if (valueColumns.includes(col)) {
      if (valueColumns.length > 1) {
        setValueColumns(valueColumns.filter(c => c !== col));
      }
    } else {
      setValueColumns([...valueColumns, col]);
    }
  };

  if (numericColumns.length === 0) {
    return (
      <div className="chart-container">
        <div className="chart-header">
          <h3>📊 Визуализация</h3>
          {onClose && (
            <button className="icon-btn" onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </button>
          )}
        </div>
        <div className="chart-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <path d="M3 3v18h18" stroke="currentColor" strokeWidth="2"/>
            <path d="M7 14l4-4 4 4 6-6" stroke="currentColor" strokeWidth="2"/>
          </svg>
          <p>Нет числовых данных для визуализации</p>
          <small>Для построения графика нужны столбцы с числовыми значениями</small>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h3>📊 Визуализация данных</h3>
        {onClose && (
          <button className="icon-btn" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </button>
        )}
      </div>

      <div className="chart-controls">
        <div className="control-group">
          <label>Тип графика:</label>
          <div className="chart-type-buttons">
            <button 
              className={`type-btn ${chartType === 'bar' ? 'active' : ''}`}
              onClick={() => setChartType('bar')}
              title="Столбчатая диаграмма"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="12" width="4" height="9" fill="currentColor"/>
                <rect x="10" y="6" width="4" height="15" fill="currentColor"/>
                <rect x="17" y="3" width="4" height="18" fill="currentColor"/>
              </svg>
            </button>
            <button 
              className={`type-btn ${chartType === 'line' ? 'active' : ''}`}
              onClick={() => setChartType('line')}
              title="Линейный график"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M3 17l6-6 4 4 8-8" stroke="currentColor" strokeWidth="2"/>
                <circle cx="3" cy="17" r="2" fill="currentColor"/>
                <circle cx="9" cy="11" r="2" fill="currentColor"/>
                <circle cx="13" cy="15" r="2" fill="currentColor"/>
                <circle cx="21" cy="7" r="2" fill="currentColor"/>
              </svg>
            </button>
            <button 
              className={`type-btn ${chartType === 'pie' ? 'active' : ''}`}
              onClick={() => setChartType('pie')}
              title="Круговая диаграмма"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8v8l6.93 4a7.963 7.963 0 01-6.93 4z" fill="currentColor"/>
              </svg>
            </button>
            <button 
              className={`type-btn ${chartType === 'area' ? 'active' : ''}`}
              onClick={() => setChartType('area')}
              title="Площадная диаграмма"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M3 21V12l6-6 4 4 8-7v18H3z" fill="currentColor" opacity="0.3"/>
                <path d="M3 12l6-6 4 4 8-7" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="control-group">
          <label>Метки (X):</label>
          <select 
            value={labelColumn} 
            onChange={(e) => setLabelColumn(e.target.value)}
            className="chart-select"
          >
            {data.columns.map(col => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>Значения (Y):</label>
          <div className="value-columns">
            {numericColumns.map((col, index) => (
              <button
                key={col}
                className={`value-btn ${valueColumns.includes(col) ? 'active' : ''}`}
                onClick={() => toggleValueColumn(col)}
                style={{ 
                  borderColor: valueColumns.includes(col) ? colors[index % colors.length] : undefined,
                  background: valueColumns.includes(col) 
                    ? `color-mix(in srgb, ${colors[index % colors.length]} 20%, transparent)` 
                    : undefined
                }}
              >
                {col}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="chart-area">
        {chartType === 'bar' && (
          <BarChart data={chartData} maxValue={maxValue} colors={colors} valueLabels={valueColumns} />
        )}
        {chartType === 'line' && (
          <LineChart data={chartData} maxValue={maxValue} colors={colors} valueLabels={valueColumns} />
        )}
        {chartType === 'pie' && (
          <PieChart data={chartData} colors={colors} valueLabels={valueColumns} />
        )}
        {chartType === 'area' && (
          <AreaChart data={chartData} maxValue={maxValue} colors={colors} valueLabels={valueColumns} />
        )}
      </div>

      {valueColumns.length > 1 && (
        <div className="chart-legend">
          {valueColumns.map((col, index) => (
            <div key={col} className="legend-item">
              <span 
                className="legend-color" 
                style={{ background: colors[index % colors.length] }}
              />
              <span>{col}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function BarChart({ data, maxValue, colors, valueLabels }: {
  data: { label: string; values: number[] }[];
  maxValue: number;
  colors: string[];
  valueLabels: string[];
}) {
  const barWidth = Math.max(20, Math.min(60, 600 / data.length / valueLabels.length));

  return (
    <svg className="chart-svg" viewBox={`0 0 ${Math.max(600, data.length * barWidth * valueLabels.length * 1.5)} 300`} preserveAspectRatio="xMinYMid meet">
      {/* Y-axis grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
        <g key={i}>
          <line 
            x1="50" y1={250 - ratio * 200} 
            x2={Math.max(600, data.length * barWidth * valueLabels.length * 1.5)} y2={250 - ratio * 200}
            stroke="var(--border)" strokeDasharray="4"
          />
          <text x="45" y={255 - ratio * 200} fill="var(--text-secondary)" fontSize="10" textAnchor="end">
            {Math.round(maxValue * ratio)}
          </text>
        </g>
      ))}

      {/* Bars */}
      {data.map((item, i) => (
        <g key={i}>
          {item.values.map((value, j) => {
            const height = (value / maxValue) * 200;
            const x = 60 + i * (barWidth * valueLabels.length + 20) + j * barWidth;
            return (
              <g key={j}>
                <rect
                  x={x}
                  y={250 - height}
                  width={barWidth - 2}
                  height={height}
                  fill={colors[j % colors.length]}
                  rx="2"
                />
                <title>{`${item.label}: ${valueLabels[j]} = ${value}`}</title>
              </g>
            );
          })}
          <text 
            x={60 + i * (barWidth * valueLabels.length + 20) + (barWidth * valueLabels.length) / 2}
            y="270"
            fill="var(--text-secondary)"
            fontSize="10"
            textAnchor="middle"
            transform={`rotate(-45, ${60 + i * (barWidth * valueLabels.length + 20) + (barWidth * valueLabels.length) / 2}, 270)`}
          >
            {item.label.length > 10 ? item.label.substring(0, 10) + '...' : item.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
function LineChart({ data, maxValue, colors, valueLabels }: {
  data: { label: string; values: number[] }[];
  maxValue: number;
  colors: string[];
  valueLabels: string[];
}) {
  const width = Math.max(600, data.length * 50);
  const pointSpacing = (width - 100) / Math.max(1, data.length - 1);

  return (
    <svg className="chart-svg" viewBox={`0 0 ${width} 300`} preserveAspectRatio="xMinYMid meet">
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
        <g key={i}>
          <line 
            x1="50" y1={250 - ratio * 200} 
            x2={width - 20} y2={250 - ratio * 200}
            stroke="var(--border)" strokeDasharray="4"
          />
          <text x="45" y={255 - ratio * 200} fill="var(--text-secondary)" fontSize="10" textAnchor="end">
            {Math.round(maxValue * ratio)}
          </text>
        </g>
      ))}

      {/* Lines for each series */}
      {valueLabels.map((_, seriesIndex) => {
        const points = data.map((item, i) => {
          const x = 60 + i * pointSpacing;
          const y = 250 - (item.values[seriesIndex] / maxValue) * 200;
          return `${x},${y}`;
        }).join(' ');

        return (
          <g key={seriesIndex}>
            <polyline
              points={points}
              fill="none"
              stroke={colors[seriesIndex % colors.length]}
              strokeWidth="2"
            />
            {data.map((item, i) => {
              const x = 60 + i * pointSpacing;
              const y = 250 - (item.values[seriesIndex] / maxValue) * 200;
              return (
                <g key={i}>
                  <circle
                    cx={x}
                    cy={y}
                    r="4"
                    fill={colors[seriesIndex % colors.length]}
                  />
                  <title>{`${item.label}: ${valueLabels[seriesIndex]} = ${item.values[seriesIndex]}`}</title>
                </g>
              );
            })}
          </g>
        );
      })}

      {/* X-axis labels */}
      {data.map((item, i) => (
        <text 
          key={i}
          x={60 + i * pointSpacing}
          y="270"
          fill="var(--text-secondary)"
          fontSize="10"
          textAnchor="middle"
          transform={`rotate(-45, ${60 + i * pointSpacing}, 270)`}
        >
          {item.label.length > 8 ? item.label.substring(0, 8) + '...' : item.label}
        </text>
      ))}
    </svg>
  );
}
function PieChart({ data, colors, valueLabels }: {
  data: { label: string; values: number[] }[];
  colors: string[];
  valueLabels: string[];
}) {
  const total = data.reduce((sum, item) => sum + item.values[0], 0);
  let currentAngle = -90;
  const cx = 150;
  const cy = 150;
  const radius = 100;

  const slices = data.map((item, i) => {
    const value = item.values[0];
    const percentage = (value / total) * 100;
    const angle = (value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);

    const largeArc = angle > 180 ? 1 : 0;

    const pathD = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    const midAngle = ((startAngle + endAngle) / 2 * Math.PI) / 180;
    const labelRadius = radius * 0.7;
    const labelX = cx + labelRadius * Math.cos(midAngle);
    const labelY = cy + labelRadius * Math.sin(midAngle);

    return {
      pathD,
      color: colors[i % colors.length],
      label: item.label,
      value,
      percentage,
      labelX,
      labelY
    };
  });

  return (
    <div className="pie-chart-container">
      <svg className="chart-svg pie-svg" viewBox="0 0 300 300">
        {slices.map((slice, i) => (
          <g key={i}>
            <path
              d={slice.pathD}
              fill={slice.color}
              stroke="var(--bg-primary)"
              strokeWidth="2"
            />
            <title>{`${slice.label}: ${slice.value} (${slice.percentage.toFixed(1)}%)`}</title>
          </g>
        ))}
      </svg>
      <div className="pie-legend">
        {slices.slice(0, 10).map((slice, i) => (
          <div key={i} className="pie-legend-item">
            <span className="pie-color" style={{ background: slice.color }} />
            <span className="pie-label">{slice.label}</span>
            <span className="pie-value">{slice.percentage.toFixed(1)}%</span>
          </div>
        ))}
        {data.length > 10 && (
          <div className="pie-legend-item muted">
            +{data.length - 10} ещё...
          </div>
        )}
      </div>
    </div>
  );
}
function AreaChart({ data, maxValue, colors, valueLabels }: {
  data: { label: string; values: number[] }[];
  maxValue: number;
  colors: string[];
  valueLabels: string[];
}) {
  const width = Math.max(600, data.length * 50);
  const pointSpacing = (width - 100) / Math.max(1, data.length - 1);

  return (
    <svg className="chart-svg" viewBox={`0 0 ${width} 300`} preserveAspectRatio="xMinYMid meet">
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
        <g key={i}>
          <line 
            x1="50" y1={250 - ratio * 200} 
            x2={width - 20} y2={250 - ratio * 200}
            stroke="var(--border)" strokeDasharray="4"
          />
          <text x="45" y={255 - ratio * 200} fill="var(--text-secondary)" fontSize="10" textAnchor="end">
            {Math.round(maxValue * ratio)}
          </text>
        </g>
      ))}

      {/* Areas for each series */}
      {valueLabels.map((_, seriesIndex) => {
        const points = data.map((item, i) => {
          const x = 60 + i * pointSpacing;
          const y = 250 - (item.values[seriesIndex] / maxValue) * 200;
          return `${x},${y}`;
        });
        const firstX = 60;
        const lastX = 60 + (data.length - 1) * pointSpacing;
        const areaPath = `M ${firstX},250 L ${points.join(' L ')} L ${lastX},250 Z`;

        return (
          <g key={seriesIndex}>
            <path
              d={areaPath}
              fill={colors[seriesIndex % colors.length]}
              opacity="0.3"
            />
            <polyline
              points={points.join(' ')}
              fill="none"
              stroke={colors[seriesIndex % colors.length]}
              strokeWidth="2"
            />
          </g>
        );
      })}

      {/* X-axis labels */}
      {data.map((item, i) => (
        <text 
          key={i}
          x={60 + i * pointSpacing}
          y="270"
          fill="var(--text-secondary)"
          fontSize="10"
          textAnchor="middle"
          transform={`rotate(-45, ${60 + i * pointSpacing}, 270)`}
        >
          {item.label.length > 8 ? item.label.substring(0, 8) + '...' : item.label}
        </text>
      ))}
    </svg>
  );
}
