/**
 * A small server-rendered line chart for a single series.
 *
 * The line and its soft fill are an SVG path, stretched to the plot. Everything
 * else (grid, axis labels, the end marker and its value, the hover readout) is
 * HTML positioned with percentages, so text and dots keep their shape at any
 * width. No script runs in the browser: the readout that follows the pointer is
 * CSS `:hover` on one invisible column per data point.
 */
import { type Html, html } from './html.ts';

export type Point = { label: string; value: number };

type LineChartOptions = {
  points: Point[];
  /** How many points fit across the plot. Fewer points sit against the right edge. */
  capacity: number;
  /** The value at the top of the y-axis. */
  max: number;
  /** Values to label on the y-axis. */
  ticks: number[];
  format: (value: number) => string;
  /** Labels along the x-axis, spread from left to right. */
  xLabels: string[];
};

export function lineChart({ points, capacity, max, ticks, format, xLabels }: LineChartOptions): Html {
  // Horizontal position in "slots": the newest point is always in the last slot.
  const slot = (index: number) => capacity - points.length + index;
  // Vertical position as a percentage from the top of the plot.
  const top = (value: number) => (100 - (Math.min(Math.max(value, 0), max) / max) * 100).toFixed(1);

  const line = points.map((point, index) => `${slot(index)},${top(point.value)}`).join('L');
  const last = points.at(-1);

  return html`
    <div class="plot" style="--slots: ${capacity}">
      <div class="plot-y" aria-hidden="true">
        ${ticks.map((tick) => html`<span style="top: ${top(tick)}%">${format(tick)}</span>`)}
      </div>

      <div class="plot-area">
        ${points.length > 1 &&
        html`
          <svg viewBox="0 0 ${capacity - 1} 100" preserveAspectRatio="none" aria-hidden="true">
            <path class="plot-fill" d="M${line}L${capacity - 1},100L${slot(0)},100Z" />
            <path class="plot-line" d="M${line}" />
          </svg>
        `}
        ${last &&
        html`
          <i class="plot-end" style="top: ${top(last.value)}%"></i>
          <span class="plot-end-label" style="top: ${top(last.value)}%">${format(last.value)}</span>
        `}

        <div class="plot-hover" aria-hidden="true">
          ${points.map(
            // Kept on one line: this is repeated for every point, every second.
            (point, index) =>
              html`<i style="--top:${top(point.value)}%;grid-column:${slot(index) + 1}"><span><b>${format(point.value)}</b> ${point.label}</span></i>`,
          )}
        </div>
      </div>

      <div class="plot-x" aria-hidden="true">${xLabels.map((label) => html`<span>${label}</span>`)}</div>
    </div>
  `;
}
