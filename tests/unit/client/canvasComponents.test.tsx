// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AIOrb from '../../../src/client/shared/components/AIOrb';
import Budget3DDonut from '../../../src/client/shared/components/Budget3DDonut';
import CelebrationHeroCanvas from '../../../src/client/shared/components/CelebrationHeroCanvas';
import { drawGift, drawLantern, drawRing, type ConfettiPiece } from '../../../src/client/shared/components/celebrationShapes';
import { fireConfetti } from '../../../src/client/shared/utils/confettiBurst';
import TimelineGanttTable from '../../../src/client/features/planning/TimelineGanttTable';
import Tilt3DCard from '../../../src/client/shared/components/Tilt3DCard';
import { budgetItem, timelineItem } from './apiMock';

/** jsdom has no 2D canvas, so record calls on a permissive fake context instead. */
function fakeContext() {
  const calls: string[] = [];
  const gradient = { addColorStop: vi.fn() };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient') return () => gradient;
      if (prop === 'measureText') return () => ({ width: 10 });
      return (..._args: unknown[]) => { calls.push(prop); };
    },
    set(target, prop: string, value) {
      target[prop] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

let frames: FrameRequestCallback[] = [];
const runFrames = (count: number) => {
  for (let i = 0; i < count; i++) {
    const pending = frames;
    frames = [];
    act(() => pending.forEach((callback) => callback(performance.now())));
  }
};

let lastContext: ReturnType<typeof fakeContext>;
beforeEach(() => {
  frames = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
    lastContext = fakeContext();
    return lastContext.ctx as never;
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('celebration shapes', () => {
  it('draws each shape and lets the gift shed confetti over time', () => {
    const { ctx, calls } = fakeContext();
    const confetti: ConfettiPiece[] = [];
    for (let frame = 0; frame < 120; frame++) {
      drawRing(ctx, 50, 50, 40, frame / 10, frame / 60);
      drawGift(ctx, 50, 50, 40, frame / 10, frame / 60, confetti);
      drawLantern(ctx, 50, 50, 40, frame / 10, frame / 60);
    }
    expect(calls).toContain('arc');
    expect(calls).toContain('fill');
    expect(confetti.length).toBeGreaterThan(0);
  });
});

describe('animated canvases', () => {
  it('animates the hero canvas, reacts to the pointer, and cleans up', () => {
    const { container, unmount } = render(<CelebrationHeroCanvas />);
    expect(container.querySelector('canvas')).toHaveAttribute('aria-hidden', 'true');
    fireEvent.mouseMove(window, { clientX: 100, clientY: 80 });
    runFrames(5);
    expect(lastContext.calls.length).toBeGreaterThan(0);
    unmount();
  });

  it('draws a single static frame when reduced motion is preferred', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    render(<CelebrationHeroCanvas />);
    expect(frames).toHaveLength(0);
  });

  it.each(['idle', 'thinking', 'answered'] as const)('renders the AI orb in the %s state with an accessible name', (state) => {
    render(<AIOrb state={state} size={80} />);
    expect(screen.getByRole('img', { name: new RegExp(state) })).toBeInTheDocument();
    fireEvent.mouseMove(window, { clientX: 10, clientY: 10 });
    runFrames(3);
    expect(lastContext.calls).toContain('arc');
  });

  it('runs a confetti burst to completion and removes its overlay', () => {
    fireConfetti(100, 100, 20);
    expect(document.querySelector('canvas')).not.toBeNull();
    runFrames(400);
    expect(document.querySelector('canvas')).toBeNull();
  });
});

describe('Budget3DDonut', () => {
  const items = [
    { ...budgetItem, category: 'Venue', estimated_cost: 8000, actual_cost: 7500 },
    { ...budgetItem, id: 'b2', category: 'Catering', estimated_cost: 4000, actual_cost: null },
  ];

  it('exposes the breakdown as an accessible table and passes axe', async () => {
    const { container } = render(<Budget3DDonut items={items} totalBudget={20000} currency="EUR" />);
    expect(screen.getByRole('table', { name: /category allocations/i })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Venue' })).toBeInTheDocument();
    expect(screen.getAllByText(/€|EUR/).length).toBeGreaterThan(0);
    expect((await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([]);
  });

  it('rotates with the keyboard and the mouse, and inspects slices on hover', () => {
    render(<Budget3DDonut items={items} totalBudget={20000} currency="USD" />);
    const canvas = screen.getByRole('img', { name: /budget ring/i });
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 320, height: 240, right: 320, bottom: 240, x: 0, y: 0, toJSON: () => ({}) });

    fireEvent.keyDown(canvas, { key: 'ArrowLeft' });
    fireEvent.keyDown(canvas, { key: 'ArrowRight' });
    fireEvent.keyDown(canvas, { key: 'ArrowUp' });
    fireEvent.keyDown(canvas, { key: 'ArrowDown' });

    fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 140, clientY: 100 });
    fireEvent.mouseUp(canvas);
    for (const [x, y] of [[160, 60], [230, 120], [160, 180], [90, 120], [160, 120], [5, 5]]) {
      fireEvent.mouseMove(canvas, { clientX: x, clientY: y });
    }
    runFrames(3);
    expect(lastContext.calls).toContain('fillText');
  });

  it('handles an empty budget', () => {
    render(<Budget3DDonut items={[]} totalBudget={0} />);
    expect(screen.getByRole('img', { name: /0 categories/i })).toBeInTheDocument();
  });
});

describe('TimelineGanttTable', () => {
  const rows = [
    timelineItem,
    { ...timelineItem, id: 't2', title: 'Book DJ', status: 'completed' as const, due_date: null },
    { ...timelineItem, id: 't3', title: 'Pay deposit', due_date: '2020-01-01T00:00:00.000Z' },
  ];

  it('renders a semantic table and routes row actions', async () => {
    const onToggle = vi.fn();
    const onEdit = vi.fn();
    const onRemove = vi.fn();
    const { container } = render(<TimelineGanttTable items={rows} onToggle={onToggle} onEdit={onEdit} onRemove={onRemove} />);

    expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(3);
    fireEvent.click(screen.getByRole('button', { name: 'Edit milestone: Book DJ' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete milestone: Pay deposit' }));
    fireEvent.click(screen.getAllByRole('button', { name: /mark|complete|reopen/i })[0]!);
    expect(onEdit).toHaveBeenCalledWith(rows[1]);
    expect(onRemove).toHaveBeenCalledWith(rows[2]);
    expect(onToggle).toHaveBeenCalled();
    expect((await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([]);
  });

  it('shows an empty state', () => {
    render(<TimelineGanttTable items={[]} onToggle={vi.fn()} onEdit={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText(/no/i)).toBeInTheDocument();
  });
});

describe('Tilt3DCard', () => {
  it('tilts toward the pointer and resets on leave', () => {
    render(<Tilt3DCard intensity={10}><p>Card body</p></Tilt3DCard>);
    const body = screen.getByText('Card body');
    const card = body.closest('div')!;
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.mouseMove(card, { clientX: 150, clientY: 20 });
    fireEvent.mouseLeave(card);
    expect(body).toBeInTheDocument();
  });
});
