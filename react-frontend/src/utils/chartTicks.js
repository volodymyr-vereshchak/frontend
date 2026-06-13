// Helpers for X-axis tick selection on time-series charts.
//
// Recharts' default tick thinning (interval="preserveEnd"/"preserveStartEnd")
// force-shows the LAST tick and then drops whichever neighbour is too close to
// it — which is the penultimate label. The result is a missing second-to-last
// X label. To avoid this we compute explicit, evenly-spaced ticks ourselves and
// render them with interval={0}, snapping the final tick to the true last point
// so there is always a clean gap before it (no dropped neighbour).

/**
 * Build an explicit list of evenly-spaced tick values (one per maxLabels-ish),
 * always including the last point. Returns `undefined` when there are few enough
 * points to just show them all (caller should then rely on interval={0}).
 *
 * @param {Array<string|number>} values - the dataKey values in chart order.
 * @param {number} maxLabels - target number of labels for dense charts.
 */
export function buildEvenXTicks(values, maxLabels = 30) {
  const n = Array.isArray(values) ? values.length : 0;
  // Few enough to show every label without overlap → let interval={0} handle it.
  if (n <= 60) return undefined;

  const step = Math.ceil(n / maxLabels);
  const idxs = [];
  for (let i = 0; i < n; i += step) idxs.push(i);
  // Snap the final label to the actual last point. The previous sampled index is
  // at most `step` away, so replacing (not appending) keeps an even gap and never
  // places two labels adjacently.
  idxs[idxs.length - 1] = n - 1;

  return idxs.map(i => values[i]);
}
