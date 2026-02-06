import React, { useState, useEffect } from 'react';
import api from '../services/api';

function AdminPanel({ user }) {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [customReport, setCustomReport] = useState('');
  const [reportResult, setReportResult] = useState(null);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const [statsRes, usersRes] = await Promise.all([
        api.get('/api/admin/stats'),
        api.get('/api/admin/users?limit=10'),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data.users);
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    }
  };

  // DANGEROUS: XSS risk - rendering admin-provided HTML content
  const renderCustomWidget = (htmlContent) => {
    // BAD: Admin content rendered without sanitization
    return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
  };

  const runCustomReport = async () => {
    try {
      const response = await api.post('/api/admin/custom-report', {
        expression: customReport,
      });
      setReportResult(response.data.result);
    } catch (error) {
      console.error('Report failed:', error);
      setReportResult('Error: ' + error.message);
    }
  };

  return (
    <div className="admin-panel">
      <h2>Admin Panel</h2>
      <p>Logged in as: {user?.email}</p>

      {stats && (
        <div className="admin-stats">
          <div className="stat-card">
            <h3>Total Users</h3>
            <p>{stats.users}</p>
          </div>
          <div className="stat-card">
            <h3>Total Orders</h3>
            <p>{stats.orders}</p>
          </div>
          <div className="stat-card">
            <h3>Revenue</h3>
            <p>${stats.totalRevenue?.toFixed(2)}</p>
          </div>
        </div>
      )}

      <section className="user-management">
        <h3>Recent Users</h3>
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id}>
                <td>{u.email}</td>
                <td>{u.firstName} {u.lastName}</td>
                <td>{u.role}</td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="custom-reports">
        <h3>Custom Report Builder</h3>
        <textarea
          value={customReport}
          onChange={(e) => setCustomReport(e.target.value)}
          placeholder="Enter report expression..."
          rows={4}
          style={{ width: '100%' }}
        />
        <button onClick={runCustomReport}>Run Report</button>
        {reportResult && (
          <div className="report-result">
            <h4>Result:</h4>
            {/* BAD: Rendering report result as HTML */}
            {renderCustomWidget(String(reportResult))}
          </div>
        )}
      </section>
    </div>
  );
}

export default AdminPanel;
