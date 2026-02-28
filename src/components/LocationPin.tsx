'use client';

/**
 * LocationPin component — renders a brand-coloured map pin icon button.
 *
 * Emits onClick for the parent to handle. Always rendered conditionally
 * by the parent based on whether the event has a location.
 */

type LocationPinProps = {
  /** Invoked when the pin icon is clicked or activated with Enter/Space. */
  onClick: () => void;
};

/**
 * Small map-pin SVG icon button signalling a location is available.
 *
 * @param onClick - Handler called when the pin is activated.
 */
export function LocationPin({ onClick }: LocationPinProps) {
  return (
    <button
      type="button"
      aria-label="View location map"
      onClick={onClick}
      className="text-[#9e3f3f] transition-colors duration-150 hover:text-[#7a2f2f]"
    >
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        width="20"
        height="20"
      >
        <path
          fillRule="evenodd"
          d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-2.013 3.5-4.509 3.5-7.327A8.25 8.25 0 0012 3.75a8.25 8.25 0 00-8.25 8.25c0 2.818 1.556 5.314 3.5 7.327a19.58 19.58 0 002.683 2.282 16.975 16.975 0 001.143.742zM12 13.5a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}
