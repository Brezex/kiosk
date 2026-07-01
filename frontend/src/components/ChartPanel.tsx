import { useEffect, useState, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { proxyApi } from '../api/client';

interface Props {
  config: {
    item_id?: string;
    item_name?: string;
    period?: string;
    chart_type?: string;
    color?: string;
  };
  serverId?: number;
  updateInterval?: number;
}

export default function ChartPanel({ config, serverId }: Props) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const loadData = async () => {
    if (!serverId || !config.item_id) {
      setError('Не настроен источник данных');
      return;
    }
    
    setLoading(true);
    try {
      const res = await proxyApi.history(
        serverId,
        [config.item_id],
        config.period || '1h',
        1000
      );
      setData(res.data);
      setError('');
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadData();
    // Обновление раз в минуту
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [serverId, config.item_id, config.period]);
  
  if (!serverId || !config.item_id) {
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
  
  if (loading && data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-xl">
        Загрузка...
      </div>
    );
  }
  
  // Преобразование данных для ECharts
  const xData = data.map((d: any) => {
    const date = new Date(parseInt(d.clock) * 1000);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  });
  const yData = data.map((d: any) => parseFloat(d.value));
  
  const chartType = config.chart_type || 'line';
  const color = config.color || '#3b82f6';
  
  const option = {
    backgroundColor: 'transparent',
    grid: {
      top: 40,
      right: 40,
      bottom: 60,
      left: 80,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9', fontSize: 18 },
    },
    xAxis: {
      type: 'category',
      data: xData,
      axisLabel: {
        color: '#94a3b8',
        fontSize: 16,
        interval: Math.floor(xData.length / 6),
      },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#94a3b8', fontSize: 16 },
      splitLine: { lineStyle: { color: '#334155' } },
    },
    series: [
      {
        name: config.item_name || 'Value',
        type: chartType === 'bar' ? 'bar' : chartType === 'area' ? 'line' : 'line',
        data: yData,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 3, color },
        itemStyle: { color },
        areaStyle: chartType === 'area' ? { color, opacity: 0.3 } : undefined,
        barWidth: '60%',
      },
    ],
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