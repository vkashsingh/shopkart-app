import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

describe('ShopKart Frontend App', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1: renders the list from a mocked fetch
  test('renders the list from a mocked fetch', async () => {
    const mockProducts = [
      { _id: '1', name: 'Mechanical Keyboard', price: 99.99 },
      { _id: '2', name: 'Wireless Mouse', price: 29.5 },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockProducts,
    });

    render(<App />);

    // Initially shows loading
    expect(screen.getByRole('status')).toHaveTextContent(/loading products/i);

    // Displays products after fetch resolves
    expect(await screen.findByText('Mechanical Keyboard')).toBeInTheDocument();
    expect(screen.getByText('Wireless Mouse')).toBeInTheDocument();
    expect(screen.getByText('$99.99')).toBeInTheDocument();
    expect(screen.getByText('$29.50')).toBeInTheDocument();

    expect(global.fetch).toHaveBeenCalledWith('/api/products');
  });

  // Test 2: shows the error state
  test('shows the error state when the API fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Database connection failed' }),
    });

    render(<App />);

    // Shows the error message banner, not a blank page
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Database connection failed');
    expect(screen.getByText('ShopKart')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  // Test 3: submits the add form
  test('submits the add form and updates the list', async () => {
    const createdProduct = {
      _id: '101',
      name: 'USB-C Cable',
      price: 12.99,
    };

    global.fetch = vi
      .fn()
      // Initial GET /api/products returns empty array
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      })
      // Subsequent POST /api/products returns created product
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createdProduct,
      });

    render(<App />);

    // Empty state rendered initially
    expect(await screen.findByText('No products yet')).toBeInTheDocument();

    // Fill the add form
    const nameInput = screen.getByLabelText(/product name/i);
    const priceInput = screen.getByLabelText(/price/i);
    const submitButton = screen.getByRole('button', { name: /add product/i });

    fireEvent.change(nameInput, { target: { value: 'USB-C Cable' } });
    fireEvent.change(priceInput, { target: { value: '12.99' } });
    fireEvent.click(submitButton);

    // Verify fetch was called with correct relative URL, method, and payload
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    expect(global.fetch).toHaveBeenLastCalledWith('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'USB-C Cable', price: 12.99 }),
    });

    // Verify the new product is now displayed in the list
    expect(await screen.findByText('USB-C Cable')).toBeInTheDocument();
    expect(screen.getByText('$12.99')).toBeInTheDocument();
  });
});
