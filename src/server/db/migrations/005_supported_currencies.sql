-- Allow Indian Rupee budgets; keep in sync with src/shared/constants/currencies.ts.
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_currency_check;
ALTER TABLE events ADD CONSTRAINT events_currency_check CHECK (currency IN ('USD', 'INR', 'EUR', 'GBP', 'CAD', 'AUD'));
