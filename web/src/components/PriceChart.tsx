import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface PriceChartProps {
  items: Array<{ id: string; title: string; area: number; totalPrice: number; unitPrice: number }>;
  currentId?: string;
  height?: number;
}

/** 同小区在售房源价格对比（单价），用于 C 端详情页价格参考 */
export default function PriceChart({ items, currentId, height = 240 }: PriceChartProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const chart = echarts.init(containerRef.current);
    chartRef.current = chart;

    const data = items.slice(0, 8);
    chart.setOption({
      grid: { left: 48, right: 16, top: 28, bottom: 48 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const list = params as Array<{ dataIndex: number }>;
          const index = list[0]?.dataIndex ?? 0;
          const item = data[index];
          if (!item) return '';
          return `${item.title}<br/>单价：${item.unitPrice.toLocaleString()} 元/㎡<br/>总价：${(item.totalPrice / 10000).toFixed(1)} 万`;
        },
      },
      xAxis: {
        type: 'category',
        data: data.map((item) => (item.id === currentId ? '本房源' : `${item.area}㎡`)),
        axisLabel: { fontSize: 11, color: '#6b7280' },
        axisLine: { lineStyle: { color: '#e5e7eb' } },
      },
      yAxis: {
        type: 'value',
        name: '元/㎡',
        nameTextStyle: { fontSize: 11, color: '#9ca3af' },
        axisLabel: { fontSize: 11, color: '#6b7280' },
        splitLine: { lineStyle: { color: '#f0f2f5' } },
      },
      series: [
        {
          type: 'bar',
          data: data.map((item) => ({
            value: item.unitPrice,
            itemStyle: {
              color: item.id === currentId ? '#1677ff' : '#91caff',
              borderRadius: [4, 4, 0, 0],
            },
          })),
          barMaxWidth: 34,
          label: { show: true, position: 'top', fontSize: 10, color: '#6b7280', formatter: (params: { value: number }) => `${Math.round(params.value).toLocaleString()}` },        },
      ],
    });

    const handleResize = (): void => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, [items, currentId]);

  return <div ref={containerRef} style={{ width: '100%', height }} data-testid="price-chart" />;
}
