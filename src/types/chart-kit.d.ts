declare module 'react-native-chart-kit' {
  import { ReactNode } from 'react';
  import { ViewStyle } from 'react-native';

  export interface ChartConfig {
    backgroundColor?: string;
    backgroundGradientFrom?: string;
    backgroundGradientTo?: string;
    decimalPlaces?: number;
    color?: (opacity?: number) => string;
    labelColor?: (opacity?: number) => string;
    style?: any;
    propsForDots?: any;
    propsForLabels?: any;
  }

  export interface AbstractChartProps {
    width: number;
    height: number;
    backgroundColor?: string;
    paddingLeft?: string | number;
    paddingRight?: string | number;
    paddingTop?: string | number;
    paddingBottom?: string | number;
    style?: ViewStyle;
    chartConfig?: ChartConfig;
  }

  export interface BarChartProps extends AbstractChartProps {
    data: {
      labels: string[];
      datasets: {
        data: number[];
        colors?: ((opacity: number) => string)[];
        color?: (opacity: number) => string;
      }[];
    };
    yAxisLabel?: string;
    yAxisSuffix?: string;
    showValuesOnTopOfBars?: boolean;
    withHorizontalLabels?: boolean;
    withVerticalLabels?: boolean;
    segments?: number;
  }

  export interface PieChartProps extends AbstractChartProps {
    data: Array<{
      name: string;
      population: number;
      color: string;
      legendFontColor: string;
      legendFontSize: number;
    }>;
    accessor: string;
    absolute?: boolean;
    hasLegend?: boolean;
  }

  export class BarChart extends React.Component<BarChartProps> {}
  export class PieChart extends React.Component<PieChartProps> {}
} 