// frontend/src/components/ChartPanel.tsx

import { useEffect, useState, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { proxyApi } from '../api/client';

interface ChartMetric {
  item_id: string;
  item_name: string;
  color?: string;
  host_id?: string;
  host_name?: string;
}

interface Props {
  config: {
    items?: ChartMetric[];
    unit?: string;
    server_id?: number;
    item_id?: string;
    item_name?: string;
    period?: string;
    chart_type?: string;
    color?: string;
  };
  serverId?: number;
  updateInterval?: number;
}

// ============ КОНВЕРТЕР ЕДИНИЦ ============

const BASE_UNITS: Record<string, number> = {
  'bps': 1,
  'Kbps': 1000,
  'Mbps': 1_000_000,
  'Gbps': 1_000_000_000,
  'Tbps': 1_000_000_000_000,
  'Bps': 8,
  'KBps': 8_000,
  'MBps': 8_000_000,
  'GBps': 8_000_000_000,
  'TBps': 8_000_000_000_000,
  'percent': 1,
};

const UNIT_LABELS: Record<string, string> = {
  'bps': 'бит/с',
  'Kbps': 'Кбит/с',
  'Mbps': 'Мбит/с',
  'Gbps': 'Гбит/с',
  'Tbps': 'Тбит/с',
  'Bps': 'Б/с',
  'KBps': 'КБ/с',
  'MBps': 'МБ/с',
  'GBps': 'ГБ/с',
  'TBps': 'ТБ/с',
  'percent': '%',
};

function scaleValue(value: number, fromUnit: string, toUnit: string): number {
  if (fromUnit === toUnit || toUnit === 'auto' || toUnit === 'short') return value;
  const fromBase = BASE_UNITS[fromUnit] || 1;
  const toBase = BASE_UNITS[toUnit] || 1;
  return (value * fromBase) / toBase;
}

function autoScale(value: number): { value: number; unit: string } {
  const absValue = Math.abs(value);
  if (absValue >= 1e12) return { value: value / 1e12, unit: 'Tbps' };
  if (absValue >= 1e9)  return { value: value / 1e9,  unit: 'Gbps' };
  if (absValue >= 1e6)  return { value: value / 1e6,  unit: 'Mbps' };
  if (absValue >= 1e3)  return { value: value / 1e3,  unit: 'Kbps' };
  return { value, unit: 'bps' };
}

function formatValue(value: number, unit: string): string {
  // Защита от null/undefined/NaN
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }
  
  if (unit === 'auto') {
    const scaled = autoScale(value);
    return `${scaled.value.toFixed(2)} ${UNIT_LABELS[scaled.unit] || scaled.unit}`;
  }
  if (unit === 'short') {
    if (Math.abs(value) >= 1e12) return `${(value / 1e12).toFixed(2)} T`;
    if (Math.abs(value) >= 1e9)  return `${(value / 1e9).toFixed(2)} G`;
    if (Math.abs(value) >= 1e6)  return `${(value / 1e6).toFixed(2)} M`;
    if (Math.abs(value) >= 1e3)  return `${(value / 1e3).toFixed(2)} K`;
    return value.toFixed(2);
  }
  const label = UNIT_LABELS[unit] || unit;
  return `${value.toFixed(2)} ${label}`;
}

// ============ КОМПОНЕНТ ============

export default function ChartPanel({ config, serverId }: Props) {
  const effectiveServerId = serverId || config.server_id;
  const chartRef = useRef<any>(null);

  const [data, setData] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const metrics: ChartMetric[] = config.items && config.items.length > 0
    ? config.items
    : config.item_id
      ? [{
          item_id: config.item_id,
          item_name: config.item_name || 'Value',
          color: config.color || '#3b82f6'
        }]
      : [];

  const loadData = async () => {
    if (!effectiveServerId || metrics.length === 0) {
      setError('Не настроен источник данных');
      return;
    }

    setLoading(true);
    try {
      const itemIds = metrics.map(m => m.item_id);
      const res = await proxyApi.history(
        effectiveServerId,
        itemIds,
        config.period || '1h',
        1000
      );

      const groupedData: Record<string, any[]> = {};
      itemIds.forEach(id => {
        groupedData[id] = [];
      });

      res.data.forEach((d: any) => {
        if (groupedData[d.itemid]) {
          groupedData[d.itemid].push(d);
        }
      });

      setData(groupedData);
      setError('');
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [effectiveServerId, JSON.stringify(metrics), config.period]);

  // ============ Мемоизация опций ============
  const option = useMemo(() => {
    if (!effectiveServerId || metrics.length === 0) return null;

    const allTimestamps = new Set<number>();
    Object.values(data).forEach(metricData => {
      metricData.forEach((d: any) => {
        allTimestamps.add(parseInt(d.clock));
      });
    });
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

    const xData = sortedTimestamps.map(clock => {
      const date = new Date(clock * 1000);
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    });

    const unit = config.unit || 'auto';

    const series = metrics.map((metric, index) => {
      const metricData = data[metric.item_id] || [];
      const dataMap = new Map(metricData.map((d: any) => [parseInt(d.clock), parseFloat(d.value)]));

      const yData = sortedTimestamps.map(clock => {
        const value = dataMap.get(clock);
        if (value === undefined) return null;
        if (unit && unit !== 'auto' && unit !== 'short') {
          return scaleValue(value, 'bps', unit);
        }
        return value;
      });

      const color = metric.color || ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'][index % 6];
      const chartType = config.chart_type || 'line';

      return {
        name: metric.item_name,
        type: chartType === 'bar' ? 'bar' : chartType === 'area' ? 'line' : 'line',
        data: yData,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 3, color },
        itemStyle: { color },
        areaStyle: chartType === 'area' ? { color, opacity: 0.3 } : undefined,
        barWidth: '60%',
        connectNulls: true,
      };
    });

    return {
      backgroundColor: 'transparent',
      animation: false,
      grid: {
        top: 60,
        right: 40,
        bottom: 60,
        left: 80,
      },
      legend: {
        show: metrics.length > 1,
        top: 10,
        textStyle: { color: '#f1f5f9', fontSize: 14 },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1e293b',
        borderColor: '#334155',
        textStyle: { color: '#f1f5f9', fontSize: 16 },
        confine: true,
        appendToBody: false,
        axisPointer: {
          type: 'line',
          lineStyle: { color: '#475569', width: 2 },
        },
        formatter: (params: any) => {
          if (!params || params.length === 0) return '';
          
          let result = `<div style="font-weight: bold; margin-bottom: 8px;">${params[0].axisValue}</div>`;
          params.forEach((param: any) => {
            // Защита от null/undefined
            const value = param.value;
            if (value === null || value === undefined || isNaN(value)) {
              result += `<div style="display: flex; align-items: center; gap: 8px;">
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${param.color};"></span>
                <span>${param.seriesName}:</span>
                <span style="font-weight: bold; color: #94a3b8;">— нет данных</span>
              </div>`;
              return;
            }
            
            const displayValue = formatValue(value, unit);
            result += `<div style="display: flex; align-items: center; gap: 8px;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${param.color};"></span>
              <span>${param.seriesName}:</span>
              <span style="font-weight: bold;">${displayValue}</span>
            </div>`;
          });
          return result;
        }
      },
      xAxis: {
        type: 'category',
        data: xData,
        axisLabel: {
          color: '#94a3b8',
          fontSize: 14,
          interval: Math.floor(xData.length / 6),
        },
        axisLine: { lineStyle: { color: '#334155' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#94a3b8',
          fontSize: 14,
          formatter: (value: number) => formatValue(value, unit)
        },
        splitLine: { lineStyle: { color: '#334155' } },
      },
      series,
    };
  }, [data, metrics, config.unit, config.chart_type, effectiveServerId]);

  if (!effectiveServerId || metrics.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 text-xl">
        Панель не настроена
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-400 text-xl">
        ⚠ {error}
      </div>
    );
  }

  if (loading && Object.keys(data).length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-xl">
        Загрузка...
      </div>
    );
  }

  if (!option) return null;

  return (
    <div className="h-full w-full">
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge={false}
        lazyUpdate={true}
        theme="dark"
      />
    </div>
  );
}