/**
 * Two poker chips, in the same blue and red the grid uses for under and over
 * budget. The rim spots are a dashed circle rather than six drawn shapes, so
 * they stay evenly spaced at any size. The front chip carries a ring in the
 * page color to separate it from the one behind.
 */
export function ChipMark() {
  return (
    <svg
      className="chips"
      viewBox="0 0 35.5 26"
      role="img"
      aria-label="Two poker chips"
      focusable="false"
    >
      {/* Back chip */}
      <circle cx="25" cy="13" r="9.5" fill="var(--over-solid)" />
      <circle
        cx="25"
        cy="13"
        r="7.9"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.92"
        strokeWidth="1.7"
        strokeDasharray="3.3 5"
        strokeLinecap="round"
      />
      <circle cx="25" cy="13" r="4.2" fill="none" stroke="#fff" strokeOpacity="0.92" strokeWidth="1.5" />

      {/* Front chip, cut out of the one behind it */}
      <circle cx="11" cy="13" r="11.2" fill="var(--plane)" />
      <circle cx="11" cy="13" r="9.5" fill="var(--under-solid)" />
      <circle
        cx="11"
        cy="13"
        r="7.9"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.92"
        strokeWidth="1.7"
        strokeDasharray="3.3 5"
        strokeLinecap="round"
      />
      <circle cx="11" cy="13" r="4.2" fill="none" stroke="#fff" strokeOpacity="0.92" strokeWidth="1.5" />
    </svg>
  );
}
