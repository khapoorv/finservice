import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import ProductList from './components/ProductList';
import InvoiceView from './components/InvoiceView';
import AdminPanel from './components/AdminPanel';
import CookieConsent from './components/CookieConsent';

function App() {
  const [user, setUser] = React.useState(null);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  React.useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
      fetchUser(token);
    }
  }, []);

  const fetchUser = async (token) => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  };

  const handleLogin = (token, userData) => {
    localStorage.setItem('token', token);
    setIsAuthenticated(true);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <Router>
      <div className="App">
        <CookieConsent />
        <Routes>
          <Route path="/" element={<Dashboard user={user} onLogout={handleLogout} />} />
          <Route path="/products" element={<ProductList />} />
          <Route path="/invoices" element={
            isAuthenticated ? <InvoiceView user={user} /> : <Navigate to="/" />
          } />
          <Route path="/admin" element={
            user?.role === 'admin' ? <AdminPanel user={user} /> : <Navigate to="/" />
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
