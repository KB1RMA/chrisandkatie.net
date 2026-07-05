'use client';

import { useState, useRef, useEffect } from 'react';

type ExportOption = {
  id: string;
  label: string;
  href: string;
};

type ExportDropdownProps = {
  options: ReadonlyArray<ExportOption>;
};

/**
 * Admin export dropdown button.
 *
 * Renders a split-style "Export ▾" button that opens a dropdown menu listing
 * the provided export format options. Selecting an option triggers a file
 * download by navigating to the export API route without leaving the page.
 *
 * @param options - List of export formats to display in the dropdown.
 * @returns Export dropdown component.
 */
export function ExportDropdown({ options }: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close the dropdown when the user clicks outside of it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  function handleSelect(href: string) {
    setIsOpen(false);
    window.location.href = href;
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1 rounded-md bg-white px-4 py-2 text-sm font-medium text-[#6a5555] shadow ring-1 ring-gray-200 ring-inset hover:bg-[#f3dedb] hover:text-[#9e3f3f] focus:outline-none"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        Export ▾
      </button>

      {isOpen && (
        <ul
          role="listbox"
          className="absolute right-0 z-10 mt-1 min-w-max rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none"
        >
          {options.map((option) => (
            <li key={option.id} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => handleSelect(option.href)}
                className="block w-full px-4 py-2 text-left text-sm whitespace-nowrap text-[#6a5555] hover:bg-[#f3dedb] hover:text-[#9e3f3f]"
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
