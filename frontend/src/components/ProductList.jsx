import React, { useState, useEffect } from 'react';
import api from '../services/api';

function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    category: '',
    search: '',
    minPrice: '',
    maxPrice: '',
    sort: 'createdAt',
  });

  useEffect(() => {
    fetchProducts();
  }, [page, filters]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        limit: 20,
        ...(filters.category && { category: filters.category }),
        ...(filters.search && { search: filters.search }),
        ...(filters.minPrice && { minPrice: filters.minPrice }),
        ...(filters.maxPrice && { maxPrice: filters.maxPrice }),
        ...(filters.sort && { sort: filters.sort }),
      });

      const response = await api.get(`/api/products?${params}`);
      setProducts(response.data.products);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
    setPage(1);
  };

  const addToCart = async (productId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in to add items to cart');
        return;
      }
      // Cart functionality would be implemented here
      alert('Added to cart!');
    } catch (error) {
      console.error('Failed to add to cart:', error);
    }
  };

  if (loading) return <div className="loading">Loading products...</div>;

  return (
    <div className="product-list">
      <h2>Products</h2>

      <div className="filters">
        <input
          type="text"
          name="search"
          placeholder="Search products..."
          value={filters.search}
          onChange={handleFilterChange}
        />
        <select name="category" value={filters.category} onChange={handleFilterChange}>
          <option value="">All Categories</option>
          <option value="electronics">Electronics</option>
          <option value="clothing">Clothing</option>
          <option value="books">Books</option>
          <option value="software">Software</option>
        </select>
        <select name="sort" value={filters.sort} onChange={handleFilterChange}>
          <option value="createdAt">Newest</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
        </select>
      </div>

      <div className="products-grid">
        {products.map((product) => (
          <div key={product._id} className="product-card">
            {product.images?.[0] && (
              <img src={product.images[0].url} alt={product.images[0].alt || product.name} />
            )}
            <h3>{product.name}</h3>
            <p>{product.description?.substring(0, 100)}</p>
            <div className="product-footer">
              <span className="price">${product.price.toFixed(2)}</span>
              <span className="stock">{product.stock > 0 ? 'In Stock' : 'Out of Stock'}</span>
              <button
                onClick={() => addToCart(product._id)}
                disabled={product.stock === 0}
              >
                Add to Cart
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="pagination">
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
          Previous
        </button>
        <span>Page {page} of {totalPages}</span>
        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
          Next
        </button>
      </div>
    </div>
  );
}

export default ProductList;
