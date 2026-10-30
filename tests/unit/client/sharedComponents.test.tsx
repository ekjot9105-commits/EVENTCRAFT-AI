// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import Button from '../../../src/client/shared/components/Button';
import Input from '../../../src/client/shared/components/Input';
import Select from '../../../src/client/shared/components/Select';
import Modal from '../../../src/client/shared/components/Modal';
import ToastContainer from '../../../src/client/shared/components/Toast';
import { showToast } from '../../../src/client/shared/components/toastBus';
import { prefersReducedMotion } from '../../../src/client/shared/utils/motion';
import { fireConfetti } from '../../../src/client/shared/utils/confettiBurst';

beforeAll(() => {
  // jsdom lacks the <dialog> modal API; emulate the open attribute it toggles.
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) { this.removeAttribute('open'); };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('form primitives', () => {
  it('links labels, hints, and errors to the input for assistive tech', async () => {
    const { container, rerender } = render(<Input label="Guest count" hint="Approximate is fine" required />);
    const input = screen.getByLabelText(/guest count/i);
    expect(input).toHaveAttribute('aria-describedby', 'guest-count-hint');

    rerender(<Input label="Guest count" error="Enter a number" required />);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a number');
    expect((await axe.run(container)).violations).toEqual([]);
  });

  it('renders an accessible select with placeholder and error', async () => {
    const { container } = render(
      <Select label="Event type" placeholder="Choose one" defaultValue="" error="Pick a type" options={[{ value: 'wedding', label: 'Wedding' }]} />,
    );
    const select = screen.getByLabelText(/event type/i);
    expect(select).toHaveAccessibleDescription('Pick a type');
    expect(screen.getByRole('option', { name: 'Wedding' })).toBeInTheDocument();
    expect((await axe.run(container)).violations).toEqual([]);
  });

  it('disables the button and announces progress while loading', () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Save</Button>);
    const button = screen.getByRole('button', { name: /save/i });
    expect(button).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
  });
});

describe('Modal', () => {
  it('names the dialog by its title and closes via the close button', () => {
    const onClose = vi.fn();
    render(<Modal isOpen onClose={onClose} title="Delete event?"><p>This cannot be undone.</p></Modal>);
    const dialog = screen.getByRole('dialog', { name: 'Delete event?' });
    expect(dialog).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /close dialog/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('gives each open dialog a unique title id', () => {
    render(
      <>
        <Modal isOpen onClose={vi.fn()} title="First">a</Modal>
        <Modal isOpen onClose={vi.fn()} title="Second">b</Modal>
      </>,
    );
    const [first, second] = screen.getAllByRole('dialog');
    expect(first!.getAttribute('aria-labelledby')).not.toBe(second!.getAttribute('aria-labelledby'));
  });

  it('renders nothing while closed', () => {
    render(<Modal isOpen={false} onClose={vi.fn()} title="Hidden">x</Modal>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('ToastContainer', () => {
  it('announces errors assertively and other toasts politely, then auto-dismisses', () => {
    vi.useFakeTimers();
    render(<ToastContainer />);
    act(() => {
      showToast('Saved your budget', 'success');
      showToast('Could not reach the server', 'error');
    });
    expect(screen.getByRole('status')).toHaveTextContent('Saved your budget');
    expect(screen.getByRole('alert')).toHaveTextContent('Could not reach the server');

    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('can be dismissed manually', () => {
    render(<ToastContainer />);
    act(() => showToast('Heads up'));
    fireEvent.click(screen.getByRole('button', { name: /dismiss notification/i }));
    expect(screen.queryByText('Heads up')).not.toBeInTheDocument();
  });
});

describe('reduced motion', () => {
  function stubMotionPreference(reduce: boolean) {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: reduce }));
  }

  it('reads the OS preference', () => {
    stubMotionPreference(true);
    expect(prefersReducedMotion()).toBe(true);
    stubMotionPreference(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('skips decorative confetti when the user prefers reduced motion', () => {
    stubMotionPreference(true);
    fireConfetti(10, 10);
    expect(document.querySelector('canvas')).toBeNull();
  });
});
