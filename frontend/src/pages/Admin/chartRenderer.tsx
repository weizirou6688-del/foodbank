import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type AxisConfig = { beginAtZero?: boolean; min?: number; max?: number };

type DoughnutChartConfig = {
  type: "doughnut";
  labels: string[];
  values: number[];
  colors: string[];
};

type PieChartConfig = {
  type: "pie";
  labels: string[];
  values: number[];
  colors: string[];
};

type LineChartConfig = {
  type: "line";
  labels: string[];
  values: number[];
  label: string;
  lineColor: string;
  fillColor: string;
  yAxis?: AxisConfig;
};

type BarChartConfig = {
  type: "bar";
  labels: string[];
  values: number[];
  label: string;
  colors: string[];
  yAxis?: AxisConfig;
};

export type ChartConfig =
  | DoughnutChartConfig
  | PieChartConfig
  | LineChartConfig
  | BarChartConfig;

type ChartDatum = {
  label: string;
  value: number;
  color?: string;
};

const GRID_COLOR = "#ececec";
const TEXT_COLOR = "#666666";
const EMPHASIS_TEXT_COLOR = "#1a1a1a";
const TICK_COUNT = 4;

const tooltipStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  background: "rgba(255, 255, 255, 0.96)",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)",
  color: EMPHASIS_TEXT_COLOR,
  fontSize: 12,
  lineHeight: 1.4,
};

const formatValue = (value: number) =>
  value.toLocaleString(undefined, {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
  });

const truncateLabel = (label: string, maxLength = 12) =>
  label.length <= maxLength
    ? label
    : `${label.slice(0, Math.max(0, maxLength - 1)).trimEnd()}\u2026`;

// Backend labels can be verbose, so axis ticks wrap to at most two lines before
// falling back to truncation.
const wrapLabel = (label: string, maxLength = 12) => {
  if (label.length <= maxLength) {
    return [label];
  }

  const words = label.split(/\s+/);
  if (words.length === 1) {
    return [truncateLabel(label, maxLength)];
  }

  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length <= maxLength || !currentLine) {
      currentLine = nextLine;
      return;
    }

    lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines
    .slice(0, 2)
    .map((line, index, allLines) =>
      index === allLines.length - 1 ? truncateLabel(line, maxLength) : line,
    );
};

const niceStep = (rawStep: number) => {
  if (!Number.isFinite(rawStep) || rawStep <= 0) {
    return 1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;

  if (normalized <= 1) {
    return magnitude;
  }
  if (normalized <= 2) {
    return 2 * magnitude;
  }
  if (normalized <= 5) {
    return 5 * magnitude;
  }

  return 10 * magnitude;
};

// Build rounded tick steps instead of raw extents so low-volume and high-volume
// charts use similarly readable axes across different dashboard ranges.
const buildScale = (values: number[], yAxis?: AxisConfig) => {
  const safeValues = values.length ? values : [0];
  const rawMin = Math.min(...safeValues);
  const rawMax = Math.max(...safeValues);
  const beginAtZero = yAxis?.beginAtZero ?? false;
  let min = yAxis?.min ?? (beginAtZero ? Math.min(0, rawMin) : rawMin);
  let max = yAxis?.max ?? rawMax;

  if (max <= min) {
    max = min + 1;
  }

  const step = niceStep((max - min) / TICK_COUNT);

  if (yAxis?.min === undefined) {
    min = beginAtZero ? 0 : Math.floor(min / step) * step;
  }

  if (yAxis?.max === undefined) {
    max = Math.max(step, Math.ceil(max / step) * step);
  }

  if (max <= min) {
    max = min + step;
  }

  const ticks: number[] = [];
  let tick = min;
  while (tick <= max + step / 2) {
    ticks.push(Number(tick.toFixed(4)));
    tick += step;
  }

  if (ticks.length < 2) {
    ticks.push(max);
  }

  return { min, max, ticks };
};

const buildChartData = (
  labels: string[],
  values: number[],
  colors?: string[],
): ChartDatum[] =>
  labels.map((label, index) => ({
    label,
    value: values[index] ?? 0,
    color: colors?.[index % colors.length],
  }));

const tickIntervalFor = (count: number) => (count > 8 ? "preserveStartEnd" : 0);

function ChartSurface({
  id,
  ariaLabel,
  children,
}: {
  id?: string;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      role="img"
      aria-label={ariaLabel}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
      }}
    >
      {children}
    </div>
  );
}

function WrappedAxisTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string | number };
}) {
  const label = String(payload?.value ?? "");
  const lines = wrapLabel(label);

  return (
    <g transform={`translate(${x},${y})`}>
      <text fill={TEXT_COLOR} fontSize={11} textAnchor="middle">
        {lines.map((line, index) => (
          <tspan key={`${label}-${index}`} x={0} dy={index === 0 ? 12 : 12}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function BarChart({
  config,
  id,
}: {
  config: Extract<ChartConfig, { type: "bar" }>;
  id?: string;
}) {
  const scale = buildScale(config.values, config.yAxis);
  const data = buildChartData(config.labels, config.values, config.colors);
  const ariaLabel = config.labels
    .map(
      (label, index) => `${label}: ${formatValue(config.values[index] ?? 0)}`,
    )
    .join(", ");

  return (
    <ChartSurface id={id} ariaLabel={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          accessibilityLayer={false}
          margin={{ top: 16, right: 12, bottom: 16, left: 0 }}
          barCategoryGap={data.length > 8 ? "18%" : "28%"}
        >
          <CartesianGrid
            stroke={GRID_COLOR}
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            interval={tickIntervalFor(data.length)}
            height={50}
            tick={<WrappedAxisTick />}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            width={48}
            ticks={scale.ticks}
            domain={[scale.min, scale.max]}
            tickFormatter={formatValue}
            style={{ fontSize: 11, fill: TEXT_COLOR }}
          />
          <Tooltip
            trigger="hover"
            cursor={{ fill: "rgba(15, 23, 42, 0.04)" }}
            formatter={(value) => [formatValue(Number(value)), config.label]}
            contentStyle={tooltipStyle}
            labelStyle={{ color: EMPHASIS_TEXT_COLOR, fontWeight: 600 }}
          />
          <Bar dataKey="value" radius={[12, 12, 6, 6]} maxBarSize={40}>
            {data.map((entry) => (
              <Cell
                key={`${entry.label}-${entry.value}`}
                fill={entry.color ?? config.colors[0] ?? "#1976D2"}
              />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </ChartSurface>
  );
}

function LineChart({
  config,
  id,
}: {
  config: Extract<ChartConfig, { type: "line" }>;
  id?: string;
}) {
  const scale = buildScale(config.values, config.yAxis);
  const data = buildChartData(config.labels, config.values);
  const ariaLabel = config.labels
    .map(
      (label, index) => `${label}: ${formatValue(config.values[index] ?? 0)}`,
    )
    .join(", ");

  return (
    <ChartSurface id={id} ariaLabel={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          accessibilityLayer={false}
          margin={{ top: 16, right: 12, bottom: 16, left: 0 }}
        >
          <CartesianGrid
            stroke={GRID_COLOR}
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            interval={tickIntervalFor(data.length)}
            height={50}
            tick={<WrappedAxisTick />}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            width={48}
            ticks={scale.ticks}
            domain={[scale.min, scale.max]}
            tickFormatter={formatValue}
            style={{ fontSize: 11, fill: TEXT_COLOR }}
          />
          <Tooltip
            trigger="hover"
            cursor={{ stroke: "#cbd5e1", strokeDasharray: "4 4" }}
            formatter={(value) => [formatValue(Number(value)), config.label]}
            contentStyle={tooltipStyle}
            labelStyle={{ color: EMPHASIS_TEXT_COLOR, fontWeight: 600 }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={config.lineColor}
            strokeWidth={3}
            fill={config.fillColor}
            fillOpacity={1}
            dot={{ r: 4, fill: "#ffffff", stroke: config.lineColor, strokeWidth: 2 }}
            activeDot={{
              r: 6,
              fill: "#ffffff",
              stroke: config.lineColor,
              strokeWidth: 2.5,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartSurface>
  );
}

function PolarChart({
  config,
  id,
}: {
  config: Extract<ChartConfig, { type: "doughnut" | "pie" }>;
  id?: string;
}) {
  const data = buildChartData(config.labels, config.values, config.colors);
  const total = config.values.reduce(
    (sum, value) => sum + Math.max(0, value),
    0,
  );
  const ariaLabel = config.labels
    .map(
      (label, index) => `${label}: ${formatValue(config.values[index] ?? 0)}`,
    )
    .join(", ");

  return (
    <ChartSurface id={id} ariaLabel={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart
          accessibilityLayer={false}
          margin={{ top: 16, right: 16, bottom: 16, left: 16 }}
        >
          <Tooltip
            trigger="hover"
            formatter={(value, name) => [formatValue(Number(value)), String(name)]}
            contentStyle={tooltipStyle}
            labelStyle={{ color: EMPHASIS_TEXT_COLOR, fontWeight: 600 }}
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={config.type === "doughnut" ? "50%" : 0}
            outerRadius="76%"
            paddingAngle={data.length > 1 ? 2 : 0}
            stroke="#ffffff"
            strokeWidth={3}
          >
            {data.map((entry) => (
              <Cell
                key={`${entry.label}-${entry.value}`}
                fill={entry.color ?? config.colors[0] ?? "#1976D2"}
              />
            ))}
          </Pie>
        </RechartsPieChart>
      </ResponsiveContainer>
      {config.type === "doughnut" ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                color: EMPHASIS_TEXT_COLOR,
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              {formatValue(total)}
            </div>
            <div style={{ color: TEXT_COLOR, fontSize: 12 }}>Total</div>
          </div>
        </div>
      ) : null}
    </ChartSurface>
  );
}

export function ChartRenderer({
  chartConfig,
  id,
}: {
  chartConfig: ChartConfig;
  id?: string;
}) {
  if (chartConfig.type === "bar") {
    return <BarChart config={chartConfig} id={id} />;
  }

  if (chartConfig.type === "line") {
    return <LineChart config={chartConfig} id={id} />;
  }

  return <PolarChart config={chartConfig} id={id} />;
}
