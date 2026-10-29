import { useState, useEffect } from 'react';

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [editingId, setEditingId] = useState(null);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/products');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to fetch products (HTTP ${res.status})`);
      }
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'An error occurred while loading products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    const parsedPrice = parseFloat(price);

    if (!trimmedName) {
      setFormError('Product name is required.');
      return;
    }

    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setFormError('Price must be a valid number greater than or equal to 0.');
      return;
    }

    setSubmitting(true);

    try {
      if (editingId) {
        // Edit existing product
        const res = await fetch(`/api/products/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmedName, price: parsedPrice }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to update product (HTTP ${res.status})`);
        }

        const updated = await res.json();
        setProducts((prev) =>
          prev.map((p) => (p._id === editingId ? updated : p))
        );
        resetForm();
      } else {
        // Add new product
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmedName, price: parsedPrice }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to add product (HTTP ${res.status})`);
        }

        const created = await res.json();
        setProducts((prev) => [created, ...prev]);
        resetForm();
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (product) => {
    setEditingId(product._id);
    setName(product.name);
    setPrice(String(product.price));
    setFormError(null);
  };

  const handleCancelEdit = () => {
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setPrice('');
    setEditingId(null);
    setFormError(null);
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to delete product (HTTP ${res.status})`);
      }

      setProducts((prev) => prev.filter((p) => p._id !== id));
      if (editingId === id) {
        resetForm();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container">
      <header>
        <h1>ShopKart</h1>
        <p>Product Catalogue &amp; Inventory Management</p>
      </header>

      <section className="card">
        <h2>{editingId ? 'Edit Product' : 'Add New Product'}</h2>
        <form onSubmit={handleSubmit} className="product-form" aria-label="Product Form">
          <div className="form-group">
            <label htmlFor="name">Product Name</label>
            <input
              id="name"
              type="text"
              placeholder="e.g. Wireless Mouse"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="price">Price ($)</label>
            <input
              id="price"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 29.99"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {editingId ? 'Update Product' : 'Add Product'}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCancelEdit}
                disabled={submitting}
              >
                Cancel
              </button>
            )}
          </div>

          {formError && <p className="form-error">{formError}</p>}
        </form>
      </section>

      <section className="card">
        <h2>Products</h2>

        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button type="button" className="btn-secondary" onClick={fetchProducts}>
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <p className="loading" role="status">
            Loading products...
          </p>
        ) : error ? null : products.length === 0 ? (
          <p className="empty-message">No products yet</p>
        ) : (
          <div className="table-wrapper">
            <table className="products-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product._id}>
                    <td className="product-name">{product.name}</td>
                    <td className="product-price">
                      ${Number(product.price).toFixed(2)}
                    </td>
                    <td className="product-actions">
                      <button
                        type="button"
                        className="btn-edit"
                        onClick={() => handleStartEdit(product)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-delete"
                        onClick={() => handleDelete(product._id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default App;
