import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventsApi } from '../../shared/api/client';
import { showToast } from '../../shared/components/Toast';
import Card from '../../shared/components/Card';
import Input from '../../shared/components/Input';
import Button from '../../shared/components/Button';
import { EVENT_TYPES, EVENT_TYPE_LABELS, EVENT_TYPE_ICONS, EVENT_TYPE_DESCRIPTIONS } from '../../../shared/constants/eventTypes';
import type { EventType } from '../../../shared/constants/eventTypes';

export default function CreateEvent() {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<EventType | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedType) {
      setErrors({ type: 'Please select an event type' });
      return;
    }
    if (!title.trim()) {
      setErrors({ title: 'Title is required' });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const event = await eventsApi.create({
        type: selectedType,
        title: title.trim(),
        description: description.trim() || undefined,
        date: date ? new Date(date).toISOString() : undefined,
        guest_count: guestCount ? parseInt(guestCount, 10) : undefined,
        location: location.trim() || undefined,
      });
      showToast('Event created successfully!', 'success');
      navigate(`/events/${event.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create event';
      showToast(message, 'error');
      setErrors({ submit: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <h1 className="font-display font-bold text-3xl gradient-text mb-2">Create New Event</h1>
      <p className="text-surface-400 mb-8">Choose your event type and fill in the details to get started.</p>

      <form onSubmit={handleSubmit} noValidate>
        {/* Event Type Selector */}
        <fieldset className="mb-8">
          <legend className="text-sm font-medium text-surface-300 mb-3">
            Event Type <span className="text-red-400" aria-hidden="true">*</span>
          </legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {EVENT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => { setSelectedType(type); setErrors({}); }}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  selectedType === type
                    ? 'border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-600/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'
                }`}
                role="radio"
                aria-checked={selectedType === type}
              >
                <span className="text-3xl block mb-2" role="img" aria-hidden="true">
                  {EVENT_TYPE_ICONS[type]}
                </span>
                <span className="font-display font-semibold text-surface-100 block">
                  {EVENT_TYPE_LABELS[type]}
                </span>
                <span className="text-xs text-surface-500 mt-1 block">
                  {EVENT_TYPE_DESCRIPTIONS[type]}
                </span>
              </button>
            ))}
          </div>
          {errors['type'] && (
            <p className="text-xs text-red-400 mt-2" role="alert">{errors['type']}</p>
          )}
        </fieldset>

        {/* Event Details */}
        {selectedType && (
          <Card className="animate-slide-up">
            <div className="space-y-5">
              <Input
                label="Event Title"
                placeholder={`My ${EVENT_TYPE_LABELS[selectedType]}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                error={errors['title']}
                required
                maxLength={200}
              />

              <div className="flex flex-col gap-1.5">
                <label htmlFor="description" className="text-sm font-medium text-surface-300">
                  Description
                </label>
                <textarea
                  id="description"
                  rows={3}
                  placeholder="Describe your event..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-surface-100 placeholder:text-surface-600 transition-colors focus:bg-white/10 focus:border-brand-500 resize-none"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Input
                  label="Event Date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
                <Input
                  label="Expected Guests"
                  type="number"
                  min={1}
                  max={100000}
                  placeholder="100"
                  value={guestCount}
                  onChange={(e) => setGuestCount(e.target.value)}
                />
              </div>

              <Input
                label="Location"
                placeholder="City, venue, or address"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={500}
              />

              {errors['submit'] && (
                <p className="text-sm text-red-400" role="alert">{errors['submit']}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => navigate('/')}>
                  Cancel
                </Button>
                <Button type="submit" loading={loading}>
                  Create Event
                </Button>
              </div>
            </div>
          </Card>
        )}
      </form>
    </div>
  );
}
