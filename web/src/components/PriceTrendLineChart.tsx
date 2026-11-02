import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface PriceTrendLineChartProps {
  data: Array<{ month: string; avgUnitPrice: number; listingCount: number }>;
  height?: number;
}

/** 挂牌价走势：折线（挂牌均价 元/㎡）+ 柱状（挂牌样本数） */
export default function PriceTrendLineChart({ data, height = 280 }: PriceTrendLineChartProps): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return undefined;
    const chart = echarts.init(ref.current);
    chart.setOption({
      grid: { left: 70, right: 55, top: 40, bottom: 40 },
      legend: { data: ['挂牌均价（元/㎡）', '挂牌样本'], top: 4, textStyle: { color: '#6b7280', fontSize: 12 } },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: data.map((item) => item.month),
        axisLabel: { color: '#6b7280', fontSize: 11 },
        axisLine: { lineStyle: { color: '#e5e7eb' } },
      },
      yAxis: [
        {
          type: 'value',
          name: '元/㎡',
          nameTextStyle: { color: '#9ca3af', fontSize: 11 },
          axisLabel: { color: '#6b7280', fontSize: 11, formatter: (value: number) => `${Math.round(value / 1000)}k` },
          splitLine: { lineStyle: { color: '#f0f2f5' } },
          scale: true,
        },
        {
          type: 'value',
          name: '套',
          nameTextStyle: { color: '#9ca3af', fontSize: 11 },
          axisLabel: { color: '#6b7280', fontSize: 11 },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '挂牌均价（元/㎡）',
          type: 'line',
          smooth: true,
          symbolSize: 8,
          data: data.map((item) => item.avgUnitPrice),
          lineStyle: { color: '#1677ff', width: 3 },
          itemStyle: { color: '#1677ff' },
          areaStyle: { color: 'rgba(22,119,255,0.08)' },
          label: { show: false },
        },
        {
          name: '挂牌样本',
          type: 'bar',
          yAxisIndex: 1,
          barMaxWidth: 26,
          data: data.map((item) => item.listingCount),
          itemStyle: { color: 'rgba(19,168,168,0.45)', borderRadius: [3, 3, 0, 0] },
        },
      ],
    });
    const resize = (): void => chart.resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      chart.dispose();
    };
  }, [data]);

  return <div ref={ref} style={{ width: '100%', height }} data-testid="price-trend-line-chart" />;
}
