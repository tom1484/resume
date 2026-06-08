import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { LlmPage } from './LlmPage';
import { configDefault } from '@resume/contracts';

function mockConfig(onPut: (body: unknown) => void) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/config/llm' && (!init || init.method !== 'PUT')) {
        return new Response(JSON.stringify(configDefault('llm')), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url === '/api/config/llm' && init?.method === 'PUT') {
        onPut(JSON.parse(init.body as string));
        return new Response(JSON.stringify({ ok: true, ns: 'llm' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('not found', { status: 404 });
    }) as unknown as typeof fetch
  );
}

describe('LlmPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads the llm config and PUTs a Zod-valid payload on Save', async () => {
    const put = vi.fn();
    mockConfig(put);
    render(<LlmPage />);

    // default models render into inputs (parse/fit/verify all default to haiku)
    await waitFor(() =>
      expect(screen.getAllByDisplayValue('claude-haiku-4-5').length).toBe(3)
    );

    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(put).toHaveBeenCalledOnce());
    // the PUT body parses cleanly against the contract (it is the default config)
    expect(put.mock.calls[0]![0]).toMatchObject({
      scoreThreshold: 0.65,
      models: { parse: 'claude-haiku-4-5' },
    });
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument());
  });

  it('blocks the PUT and surfaces problems when the draft is Zod-invalid', async () => {
    const put = vi.fn();
    mockConfig(put);
    render(<LlmPage />);

    const threshold = await screen.findByLabelText(/Score threshold/i);
    // out of [0,1] range → parseConfig must reject before any PUT
    fireEvent.change(threshold, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(screen.getByText(/Invalid llm config/i)).toBeInTheDocument()
    );
    expect(put).not.toHaveBeenCalled();
  });
});
