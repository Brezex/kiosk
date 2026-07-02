// frontend/src/components/ChartPanel.tsx

import { useEffect, useState, useRef } from 'react';
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
    // Новая структура (множественные метрики)
    items?: ChartMetric[];
    unit?: string;
    
    // Старая структура (обратная совместимость)
    item_id?: string;
    item_name?: string;
    period?: string;
    chart_type?: string;
    color?: string;
  };
  serverId?: number;
  updateInterval?: number;
}

// Функция для масштабирования значений
function scaleValue(value: number, fromUnit: string, toUnit: string): number {
  if (fromUnit === toUnit || toUnit === 'auto') return value;

  // Базовые единицы
  const baseUnits: Record<string, number> = {
    'bps': 1,
    'Kbps': 1000,
    'Mbps': 1000000,
    'Gbps': 1000000000,
    'Bps': 8,
    'KBps': 8000,
    'MBps': 8000000,
    'GBps': 8000000000,
    'percent': 1,
  };

  const fromBase = baseUnits[fromUnit] || 1;
  const toBase = baseUnits[toUnit] || 1;

  return (value * fromBase) / toBase;
}

// Функция для форматирования значений
function formatValue(value: number, unit: string): string {
  if (unit === 'auto' || unit === 'short') {
    if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}G`;
    if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
    return value.toFixed(2);
  }
  
  return value.toFixed(2);
}

export default function ChartPanel({ config, serverId }: Props) {
  const [data, setData] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Определяем метрики (новая или старая структура)
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
    if (!serverId || metrics.length === 0) {
      setError('Не настроен источник данных');
      return;
    }

    setLoading(true);
    try {
      const itemIds = metrics.map(m => m.item_id);
      const res = await proxyApi.history(
        serverId,
        itemIds,
        config.period || '1h',
        1000
      );

      // Группируем данные по item_id
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
  }, [serverId, JSON.stringify(metrics), config.period]);

  if (!serverId || metrics.length === 0) {
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

  // Находим общее время для X-оси (объединяем все временные метки)
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

  // Создаем серии для каждой метрики
  const series = metrics.map((metric, index) => {
    const metricData = data[metric.item_id] || [];
    const dataMap = new Map(metricData.map((d: any) => [parseInt(d.clock), parseFloat(d.value)]));

    const yData = sortedTimestamps.map(clock => {
      const value = dataMap.get(clock);
      if (value === undefined) return null;
      
      // Масштабирование если нужно
      if (config.unit && config.unit !== 'auto') {
        return scaleValue(value, 'bps', config.unit); // Предполагаем, что из Zabbix приходят bps
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

  const unit = config.unit || 'auto';

  const option = {
    backgroundColor: 'transparent',
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
      formatter: (params: any) => {
        let result = `<div style="font-weight: bold; margin-bottom: 8px;">${params[0].axisValue}</div>`;
        params.forEach((param: any) => {
          const value = formatValue(param.value, unit);
          result += `<div style="display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${param.color};"></span>
            <span>${param.seriesName}:</span>
            <span style="font-weight: bold;">${value}</span>
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

  return (
    <div className="h-full w-full">
      <ReactECharts
        option={option}
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge={true}
      />
    </div>
  );
}