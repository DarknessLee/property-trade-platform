import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface TrendChartProps {
  data: Array<{ month: string; contractCount: number; dealAmount: number }>;
  height?: number;
}

/** 月度成交趋势：柱状（成交金额/万）+ 折线（成交单量） */
export default function TrendChart({ data, height = 280 }: TrendChartProps): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return undefined;
    const chart = echarts.init(ref.current);
    chart.setOption({
      grid: { left: 60, right: 50, top: 40, bottom: 40 },
      legend: { data: ['成交金额（万）', '成交单量'], top: 4, textStyle: { color: '#6b7280', fontSize: 12 } },
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
          name: '万元',
          nameTextStyle: { color: '#9ca3af', fontSize: 11 },
          axisLabel: { color: '#6b7280', fontSize: 11 },
          splitLine: { lineStyle: { color: '#f0f2f5' } },
        },
        {
          type: 'value',
          name: '单',
          nameTextStyle: { color: '#9ca3af', fontSize: 11 },
          axisLabel: { color: '#6b7280', fontSize: 11 },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '成交金额（万）',
          type: 'bar',
          barMaxWidth: 40,
          data: data.map((item) => Math.round(item.dealAmount / 10000)),
          itemStyle: { color: '#1677ff', borderRadius: [4, 4, 0, 0] },
        },
        {
          name: '成交单量',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          symbolSize: 7,
          data: data.map((item) => item.contractCount),
          lineStyle: { color: '#fa8c16', width: 3 },
          itemStyle: { color: '#fa8c16' },
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

  return <div ref={ref} style={{ width: '100%', height }} data-testid="trend-chart" />;
}
