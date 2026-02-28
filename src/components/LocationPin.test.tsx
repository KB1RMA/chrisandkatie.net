import { expect, test, describe, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocationPin } from '@/components/LocationPin';

describe('LocationPin', () => {
  test('should render a button with type="button"', () => {
    render(<LocationPin onClick={vi.fn()} />);

    const button = screen.getByRole('button');

    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('type', 'button');
  });

  test('should render with aria-label="View location map"', () => {
    render(<LocationPin onClick={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'View location map' });

    expect(button).toBeInTheDocument();
  });

  test('should render an SVG with aria-hidden="true"', () => {
    const { container } = render(<LocationPin onClick={vi.fn()} />);

    // The SVG has aria-hidden="true", so Testing Library's accessibility-aware
    // queries cannot reach it. A DOM query is the correct way to assert on
    // elements intentionally hidden from the accessibility tree.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const svg = container.querySelector('svg');

    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  test('should call onClick exactly once when clicked', () => {
    const handleClick = vi.fn();

    render(<LocationPin onClick={handleClick} />);

    fireEvent.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('should not render any visible text', () => {
    render(<LocationPin onClick={vi.fn()} />);

    const button = screen.getByRole('button');

    expect(button.textContent).toBe('');
  });
});
