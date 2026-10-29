const request = require('supertest');
const app = require('../src/app');
const Product = require('../src/models/product');

jest.mock('../src/models/product');

describe('ShopKart Backend API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test 1: Health check
  test('GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  // Test 2: Create product
  test('POST /api/products creates a product and returns 201', async () => {
    const newProduct = { name: 'Mechanical Keyboard', price: 89.99 };
    const mockCreated = {
      _id: '507f1f77bcf86cd799439011',
      name: 'Mechanical Keyboard',
      price: 89.99,
      createdAt: '2026-10-29T10:00:00.000Z',
    };

    Product.create.mockResolvedValue(mockCreated);

    const res = await request(app)
      .post('/api/products')
      .send(newProduct);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual(mockCreated);
    expect(Product.create).toHaveBeenCalledWith({
      name: 'Mechanical Keyboard',
      price: 89.99,
    });
  });

  // Test 3: List products
  test('GET /api/products returns list of products with 200', async () => {
    const mockProducts = [
      {
        _id: '507f1f77bcf86cd799439011',
        name: 'Mechanical Keyboard',
        price: 89.99,
        createdAt: '2026-10-29T10:00:00.000Z',
      },
      {
        _id: '507f1f77bcf86cd799439012',
        name: 'Gaming Mouse',
        price: 49.99,
        createdAt: '2026-10-29T10:05:00.000Z',
      },
    ];

    Product.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue(mockProducts),
    });

    const res = await request(app).get('/api/products');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(mockProducts);
    expect(Product.find).toHaveBeenCalledTimes(1);
  });

  // Test 4: Validation error 400
  test('POST /api/products returns 400 when input is invalid', async () => {
    const invalidProduct = { name: '', price: -10 };

    const res = await request(app)
      .post('/api/products')
      .send(invalidProduct);

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(Product.create).not.toHaveBeenCalled();
  });
});

