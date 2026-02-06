import React, { useState, useEffect } from 'react';
import api from '../services/api';

function Dashboard({ user, onLogout }) {
  const [stats, setStats] = useState(null);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [statsRes, announcementsRes] = await Promise.all([
        api.get('/api/health'),
        api.get('/api/products?limit=5'),
      ]);
      setStats(statsRes.data);
      setAnnouncements(announcementsRes.data.products || []);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    }
  };

  // DANGEROUS: XSS risk - using dangerouslySetInnerHTML with user-provided content
  const renderAnnouncement = (html) => {
    // BAD: Renders user-provided HTML without sanitization
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  };

  // DANGEROUS: Another XSS pattern - rendering raw HTML from API
  const renderUserWelcome = () => {
    if (!user) return null;
    // BAD: User's name could contain script tags
    const welcomeHTML = `<h2>Welcome back, ${user.firstName} ${user.lastName}!</h2>
      <p>Email: ${user.email}</p>`;
    return <div dangerouslySetInnerHTML={{ __html: welcomeHTML }} />;
  };

  return (
    <div className="dashboard">
      <header>
        <h1>FinCommerce Dashboard</h1>
        {user && (
          <div className="user-info">
            {renderUserWelcome()}
            <button onClick={onLogout}>Logout</button>
          </div>
        )}
      </header>

      <main>
        <section className="stats">
          <h3>System Status</h3>
          {stats && (
            <div>
              <p>Status: {stats.status}</p>
              <p>Uptime: {Math.floor(stats.uptime)}s</p>
            </div>
          )}
        </section>

        <section className="recent-products">
          <h3>Featured Products</h3>
          {announcements.map((product) => (
            <div key={product._id} className="product-card">
              <h4>{product.name}</h4>
              {/* BAD: Rendering product description as HTML */}
              {renderAnnouncement(product.description)}
              <p className="price">${product.price}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
