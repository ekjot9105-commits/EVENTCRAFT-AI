// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../../src/client/App';
import { EVENT_ID, installApiMock } from './apiMock';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

/** Runs axe against the rendered tree. Colour contrast needs real layout, so it is checked in the browser. */
async function expectNoAxeViolations(container: HTMLElement) {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  const summary = results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
  expect(summary).toEqual([]);
}

describe('routed feature workspaces', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal('scrollTo', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['landing page', '/', /your big moments deserve/i],
    ['dashboard', '/dashboard', /your events/i],
    ['event wizard', '/events/new', /create your event plan/i],
    ['event overview', `/events/${EVENT_ID}`, /asha & dev wedding/i],
    ['ideas studio', `/events/${EVENT_ID}/ideas`, /personalized ideas/i],
    ['AI copilot', `/events/${EVENT_ID}/assistant`, /asha & dev wedding/i],
    ['not found page', '/does-not-exist', /not found|page/i],
  ])('renders the %s without axe violations', async (_name, path, heading) => {
    installApiMock();
    const { container } = renderAt(path);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it.each(['budget', 'timeline', 'vendors'])('loads persisted %s records into the planning workspace', async (kind) => {
    const { calls } = installApiMock();
    const { container } = renderAt(`/events/${EVENT_ID}/${kind}`);
    await waitFor(() => expect(calls.some((call) => call.path === `/events/${EVENT_ID}/${kind}`)).toBe(true));
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('lists saved events on the dashboard with a link into each workspace', async () => {
    installApiMock();
    renderAt('/dashboard');
    const link = await screen.findByRole('link', { name: /asha & dev wedding/i });
    expect(link).toHaveAttribute('href', `/events/${EVENT_ID}`);
  });

  it('marks the active workspace link with aria-current', async () => {
    installApiMock();
    renderAt(`/events/${EVENT_ID}/ideas`);
    await screen.findByRole('heading', { level: 1, name: /personalized ideas/i });
    const nav = screen.getByRole('navigation', { name: /primary navigation/i });
    const active = nav.querySelector('[aria-current="page"]');
    expect(active).toHaveTextContent('Ideas');
  });

  it('redirects the legacy overview URL to the event, not the home page', async () => {
    installApiMock();
    renderAt(`/events/${EVENT_ID}/overview`);
    expect(await screen.findByRole('heading', { level: 1, name: /asha & dev wedding/i })).toBeInTheDocument();
  });

  it('only applies a Copilot change after the user confirms the server-issued proposal', async () => {
    const { calls } = installApiMock();
    renderAt(`/events/${EVENT_ID}/assistant`);
    await screen.findByRole('heading', { level: 1, name: /asha & dev wedding/i });

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Suggest a day-of schedule' } });
    fireEvent.submit(input.closest('form')!);

    expect(await screen.findByText(/final vendor walkthrough/i)).toBeInTheDocument();
    expect(calls.some((call) => call.path.endsWith('/ai/copilot/confirm'))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /confirm|apply/i }));
    await waitFor(() => {
      const confirm = calls.find((call) => call.path.endsWith('/ai/copilot/confirm'));
      expect(confirm?.body).toEqual({ proposal_id: '66666666-6666-4666-8666-666666666666' });
    });
  });

  it('shows a recoverable error when an event cannot be loaded', async () => {
    installApiMock({ [`GET /events/${EVENT_ID}`]: () => ({ status: 404, body: { error: 'Event not found.' } }) });
    renderAt(`/events/${EVENT_ID}`);
    expect(await screen.findByText('Event not found.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to events/i })).toHaveAttribute('href', '/dashboard');
  });
});
