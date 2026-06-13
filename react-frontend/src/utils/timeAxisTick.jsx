// Deterministic X-axis tick rendering for time-series charts.
//
// Recharts' built-in tick thinning (interval="preserveEnd"/"preserveStartEnd",
// or even passing an explicit `ticks` array on a category axis) force-shows the
// last tick and then quietly drops a neighbour to avoid overlap — which is why
// the second-to-last (penultimate) X label kept disappearing.
//
// Instead we render the axis with interval={0} (Recharts emits a tick for EVERY
// data point) and decide ourselves which ones get a label via a custom tick
// component. Labels are chosen counting back from the end, so the last point is
// always labelled and the gap before it is even — no dropped penultimate.

/**
 * How many data points each label should span.
 * Returns 1 (label every point) when there are few enough to fit; otherwise an
 * even step that yields roughly `maxLabels` labels.
 */
export function labelEveryFor(n, maxLabels = 30) {
  if (!n || n <= 60) return 1;
  return Math.ceil(n / maxLabels);
}

/**
 * Custom Recharts tick. Recharts injects {x, y, payload}; the rest
 * ({total, labelEvery, formatter}) come from the element we pass as `tick`.
 * Renders an angled (-45°) label only for the chosen indices, nothing for the
 * rest — so Recharts never gets a chance to thin out our end labels.
 */
export function TimeAxisTick({ x, y, payload, total, labelEvery = 1, formatter }) {
  if (!payload) return null;
  // Count back from the end: the last index is always labelled, with an even gap.
  if (labelEvery > 1 && (total - 1 - payload.index) % labelEvery !== 0) return null;
  const text = formatter ? formatter(payload.value) : payload.value;
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={4} textAnchor="end" transform="rotate(-45)" fill="#9e9e9e" fontSize={12}>
        {text}
      </text>
    </g>
  );
}
