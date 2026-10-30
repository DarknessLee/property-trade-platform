import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface PriceTrendChartProps {
  points: Array<{ price: number; unitPrice: number; changedAt: string; source: string }>;
  height?: number;
}

/** 房源挂牌价走势（历史调价轨迹，单位：万元） */
export default function PriceTrendChart({ points, height = 240 }: PriceTrendChartProps): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return undefined;
    const chart = echarts.init(ref.current);
    const data = points.map((item) => ({
      date: new Date(item.changedAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }),
      price: Math.round(item.price / 10000),
      unitPrice: item.unitPrice,
      source: item.source,
    }));
    chart.setOption({
      grid: { left: 52, right: 24, top: 30, bottom: 40 },
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const list = params as Array<{ dataIndex: number }>;
          const item = data[list[0]?.dataIndex ?? 0];
          if (!item) return '';
          return `${item.date}<br/>总价：${item.price} 万<br/>单价：${item.unitPrice.toLocaleString()} 元/㎡<br/>来源：${item.source === 'approval' ? '审批调价' : '挂牌'}`;
        },
      },
      xAxis: {
        type: 'category',
        data: data.map((item) => item.date),
        axisLabel: { color: '#6b7280', fontSize: 11 },
        axisLine: { lineStyle: { color: '#e5e7eb' } },
      },
      yAxis: {
        type: 'value',
        name: '万元',
        nameTextStyle: { color: '#9ca3af', fontSize: 11 },
        axisLabel: { color: '#6b7280', fontSize: 11 },
        splitLine: { lineStyle: { color: '#f0f2f5' } },
        scale: true,
      },
      series: [
        {
          type: 'line',
          smooth: true,
          symbolSize: 8,
          data: data.map((item) => ({
            value: item.price,
            itemStyle: { color: item.source === 'approval' ? '#fa8c16' : '#1677ff' },
          })),
          lineStyle: { color: '#1677ff', width: 3 },
          areaStyle: { color: 'rgba(22,119,255,0.08)' },
          label: { show: true, position: 'top', fontSize: 10, color: '#6b7280', formatter: (params: { value: number }) => `${params.value}万` },
        },
      ],
    });
    const resize = (): void => chart.resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      chart.dispose();
    };
  }, [points]);

  return <div ref={ref} style={{ width: '100%', height }} data-testid="price-trend-chart" />;
}
