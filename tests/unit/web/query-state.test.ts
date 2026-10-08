import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LoadError, Loading } from '../../../web/src/components/QueryState.js';

const noop = () => undefined;

describe('LoadError', () => {
  it('offers a working Try again button by default', () => {
    const html = renderToStaticMarkup(createElement(LoadError, { what: 'the fleet', onRetry: noop }));
    expect(html).toContain('Could not load the fleet.');
    expect(html).toContain('Try again');
    expect(html).not.toContain('disabled');
  });

  it('disables the button and says Retrying while a refetch is busy', () => {
    const html = renderToStaticMarkup(createElement(LoadError, { what: 'the fleet', onRetry: noop, busy: true }));
    expect(html).toContain('Retrying…');
    expect(html).toContain('disabled');
  });
});

describe('Loading', () => {
  it('announces itself as a busy status', () => {
    const html = renderToStaticMarkup(createElement(Loading, { what: 'Loading the fleet…' }));
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Loading the fleet…');
  });
});
