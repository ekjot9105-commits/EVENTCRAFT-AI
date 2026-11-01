// Adds DOM-specific matchers used by component tests.
import '@testing-library/jest-dom';

// JSDOM exposes canvas methods but does not implement a 2D context. Returning
// null keeps non-canvas tests quiet; canvas-focused tests install their own
// permissive context spy in their setup.
if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => null,
  });
}
