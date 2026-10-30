// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../../src/client/App';
import { EVENT_ID, budgetItem, event, installApiMock, timelineItem, vendor } from './apiMock';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const lastCall = (calls: Array<{ method: string; path: string; body: unknown }>, method: string, suffix: string) =>
  [...calls].reverse().find((call) => call.method === method && call.path.endsWith(suffix));

describe('planning workspace interactions', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('scrollTo', vi.fn());
    vi.stubGlobal('confirm', vi.fn(() => true));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('adds a budget expense labelled in the event currency', async () => {
    const { calls } = installApiMock({ [`GET /events/${EVENT_ID}`]: () => ({ body: { ...event, currency: 'INR' } }) });
    renderAt(`/events/${EVENT_ID}/budget`);

    fireEvent.change(await screen.findByLabelText(/^category/i), { target: { value: 'Decor' } });
    fireEvent.change(screen.getByLabelText(/item name/i), { target: { value: 'Marigold garlands' } });
    fireEvent.change(screen.getByLabelText(/estimated cost \(INR\)/i), { target: { value: '12000' } });
    fireEvent.click(screen.getByRole('button', { name: /add expense/i }));

    await waitFor(() => expect(lastCall(calls, 'POST', '/budget')?.body).toMatchObject({ category: 'Decor', name: 'Marigold garlands', estimated_cost: 12000 }));
  });

  it('edits and deletes a specific budget item by name', async () => {
    const { calls } = installApiMock();
    renderAt(`/events/${EVENT_ID}/budget`);

    fireEvent.click(await screen.findByRole('button', { name: `Edit ${budgetItem.name}` }));
    expect(screen.getByLabelText(/item name/i)).toHaveValue(budgetItem.name);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    fireEvent.click(screen.getByRole('button', { name: `Delete ${budgetItem.name}` }));
    await waitFor(() => expect(lastCall(calls, 'DELETE', `/budget/${budgetItem.id}`)).toBeDefined());
  });

  it('adds, completes, and filters timeline milestones', async () => {
    const { calls } = installApiMock();
    renderAt(`/events/${EVENT_ID}/timeline`);

    fireEvent.click(await screen.findByRole('button', { name: /milestone list/i }));
    expect(screen.getByRole('button', { name: /milestone list/i })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.change(screen.getByLabelText(/task or milestone/i), { target: { value: 'Book mehendi artist' } });
    fireEvent.change(screen.getByLabelText(/due date/i), { target: { value: '2026-11-20' } });
    fireEvent.click(screen.getByRole('button', { name: /add milestone/i }));
    await waitFor(() => expect(lastCall(calls, 'POST', '/timeline')?.body).toMatchObject({ title: 'Book mehendi artist' }));

    fireEvent.click(screen.getByRole('button', { name: `Complete ${timelineItem.title}` }));
    await waitFor(() => expect(lastCall(calls, 'PATCH', `/timeline/${timelineItem.id}`)?.body).toEqual({ status: 'completed' }));

    const filters = screen.getByRole('group', { name: /filter milestones/i });
    fireEvent.click(within(filters).getByRole('button', { name: /^completed/i }));
    expect(within(filters).getByRole('button', { name: /^completed/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/no tasks match this filter/i)).toBeInTheDocument();
  });

  it('seeds starter milestones in parallel for an empty timeline', async () => {
    const { calls } = installApiMock({ [`GET /events/${EVENT_ID}/timeline`]: () => ({ body: [] }) });
    renderAt(`/events/${EVENT_ID}/timeline`);

    fireEvent.click(await screen.findByRole('button', { name: /add starter milestones/i }));
    await waitFor(() => expect(calls.filter((call) => call.method === 'POST' && call.path.endsWith('/timeline'))).toHaveLength(5));
  });

  it('fills the form from a run-of-show slot', async () => {
    installApiMock();
    renderAt(`/events/${EVENT_ID}/timeline`);
    fireEvent.click(await screen.findByRole('button', { name: /run-of-show/i }));
    fireEvent.click(screen.getByRole('button', { name: /main ceremony/i }));
    expect(screen.getByLabelText(/hour & activity/i)).toHaveValue('02:00 PM — Main Ceremony / Event Kickoff');
  });

  it('adds and removes vendors', async () => {
    const { calls } = installApiMock();
    renderAt(`/events/${EVENT_ID}/vendors`);

    fireEvent.change(await screen.findByLabelText(/^category/i), { target: { value: 'Catering' } });
    fireEvent.change(screen.getByLabelText(/vendor name/i), { target: { value: 'Spice Route Caterers' } });
    fireEvent.change(screen.getByLabelText(/quoted cost/i), { target: { value: '85000' } });
    fireEvent.click(screen.getByRole('button', { name: /add vendor/i }));
    await waitFor(() => expect(lastCall(calls, 'POST', '/vendors')?.body).toMatchObject({ name: 'Spice Route Caterers', quoted_cost: 85000 }));

    fireEvent.click(screen.getByRole('button', { name: `Delete ${vendor.name}` }));
    await waitFor(() => expect(lastCall(calls, 'DELETE', `/vendors/${vendor.id}`)).toBeDefined());
  });

  it('offers a retry when the workspace fails to load', async () => {
    let failures = 1;
    installApiMock({
      [`GET /events/${EVENT_ID}/vendors`]: () => (failures-- > 0 ? { status: 500, body: { error: 'Temporary outage' } } : { body: [vendor] }),
    });
    renderAt(`/events/${EVENT_ID}/vendors`);
    expect(await screen.findByRole('alert')).toHaveTextContent('Temporary outage');
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByRole('button', { name: `Edit ${vendor.name}` })).toBeInTheDocument();
  });

  it('surfaces a validation error from the API without losing the form', async () => {
    installApiMock({ [`POST /events/${EVENT_ID}/vendors`]: () => ({ status: 400, body: { error: 'Vendor name is too long' } }) });
    renderAt(`/events/${EVENT_ID}/vendors`);
    fireEvent.change(await screen.findByLabelText(/^category/i), { target: { value: 'Catering' } });
    fireEvent.change(screen.getByLabelText(/vendor name/i), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: /add vendor/i }));
    expect(await screen.findByText('Vendor name is too long')).toBeInTheDocument();
    expect(screen.getByLabelText(/vendor name/i)).toHaveValue('X');
  });
});

describe('ideas and AI plan flows', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('scrollTo', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('generates ideas and saves one', async () => {
    const { calls } = installApiMock();
    renderAt(`/events/${EVENT_ID}/ideas`);
    await screen.findByRole('heading', { level: 1, name: /personalized ideas/i });

    const generate = screen.queryByRole('button', { name: /generate/i });
    if (generate) {
      fireEvent.click(generate);
      await waitFor(() => expect(lastCall(calls, 'POST', '/ideas/generate')).toBeDefined());
    }
    const save = await screen.findAllByRole('button', { name: /save/i });
    fireEvent.click(save[0]!);
    await waitFor(() => expect(lastCall(calls, 'PATCH', '/ideas/55555555-5555-4555-8555-555555555555')?.body).toEqual({ status: 'saved' }));
  });

  it('previews a generated plan in the event currency and applies it on request', async () => {
    const plan = {
      plan_id: '77777777-7777-4777-8777-777777777777', event_id: EVENT_ID, generated_at: '2026-10-30T10:00:00.000Z', applied_at: null,
      plan: {
        summary: 'A joyful wedding plan.',
        budget_proposal: { currency: 'EUR', categories: [{ category: 'Venue', amount: 9000 }] },
        timeline: [{ title: 'Book venue', due_date: '2026-11-01T00:00:00.000Z' }],
        vendor_checklist: [{ category: 'Caterer' }],
        personalized_ideas: [{ title: 'Lantern send-off' }],
      },
    };
    const { calls } = installApiMock({
      [`GET /events/${EVENT_ID}`]: () => ({ body: { ...event, currency: 'EUR' } }),
      [`POST /events/${EVENT_ID}/ai/generate`]: () => ({ status: 201, body: plan }),
      [`GET /events/${EVENT_ID}/ai/plans`]: () => ({ body: [plan] }),
      [`POST /events/${EVENT_ID}/ai/plans/apply`]: () => ({ body: { ...plan, applied_at: '2026-10-30T10:05:00.000Z' } }),
    });
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    renderAt(`/events/${EVENT_ID}/assistant`);
    await screen.findByRole('heading', { level: 1, name: /ai copilot/i });

    fireEvent.click(screen.getByRole('button', { name: /generate plan/i }));
    expect(await screen.findByText('A joyful wedding plan.')).toBeInTheDocument();
    expect(screen.getByText(/Venue: .*(€|EUR)/)).toBeInTheDocument();
    expect(lastCall(calls, 'POST', '/ai/plans/apply')).toBeUndefined();

    fireEvent.click(screen.getByRole('button', { name: /apply this plan/i }));
    await waitFor(() => expect(lastCall(calls, 'POST', '/ai/plans/apply')?.body).toEqual({ plan_id: plan.plan_id }));
    expect(await screen.findByText('Applied')).toBeInTheDocument();
  });

  it('shows the API error when Copilot is rate limited', async () => {
    installApiMock({ [`POST /events/${EVENT_ID}/ai/copilot`]: () => ({ status: 429, body: { error: 'AI request limit reached. Please try again later.' } }) });
    renderAt(`/events/${EVENT_ID}/assistant`);
    await screen.findByRole('heading', { level: 1, name: /ai copilot/i });
    fireEvent.click(screen.getByRole('button', { name: /check missing vendors/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/limit reached/i);
  });
});

describe('event creation wizard', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal('scrollTo', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('walks through every step and creates an INR birthday event', async () => {
    const { calls } = installApiMock({ 'POST /events': (body) => ({ status: 201, body: { ...event, ...(body as object) } }) });
    renderAt('/events/new');

    fireEvent.click(screen.getByRole('button', { name: /birthday/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.change(screen.getByLabelText(/event name/i), { target: { value: 'Kabir turns 8' } });
    fireEvent.change(screen.getByLabelText(/event date/i), { target: { value: '2026-12-12' } });
    fireEvent.change(screen.getByLabelText(/expected guests/i), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.change(screen.getByLabelText(/budget amount/i), { target: { value: '40000' } });
    fireEvent.change(screen.getByLabelText(/^currency/i), { target: { value: 'INR' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByRole('heading', { name: /review your plan brief/i })).toBeInTheDocument();
    const submit = screen.getAllByRole('button').find((button) => /create|start planning|save/i.test(button.textContent ?? ''));
    fireEvent.click(submit!);

    await waitFor(() => expect(lastCall(calls, 'POST', '/events')?.body).toMatchObject({ type: 'birthday', title: 'Kabir turns 8', currency: 'INR', budget_amount: 40000, guest_count: 25 }));
  });
});
