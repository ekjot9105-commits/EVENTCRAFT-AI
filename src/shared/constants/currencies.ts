/** Currencies accepted for event budgets; one list shared by the API, database, and wizard. */
export const SUPPORTED_CURRENCIES = ['USD', 'INR', 'EUR', 'GBP', 'CAD', 'AUD'] as const;

export type Currency = (typeof SUPPORTED_CURRENCIES)[number];
