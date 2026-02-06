import React, { useState, useEffect } from 'react';
import api from '../services/api';

function InvoiceView({ user }) {
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const response = await api.get('/api/invoices');
      setInvoices(response.data.invoices);
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadInvoice = async (invoiceId) => {
    try {
      const response = await api.get(`/api/invoices/${invoiceId}/download`);
      // In production, this would trigger a PDF download
      console.log('Invoice data:', response.data);
      alert('Invoice download would start here');
    } catch (error) {
      console.error('Failed to download invoice:', error);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: '#6c757d',
      sent: '#007bff',
      paid: '#28a745',
      overdue: '#dc3545',
      cancelled: '#ffc107',
    };
    return colors[status] || '#6c757d';
  };

  if (loading) return <div>Loading invoices...</div>;

  return (
    <div className="invoice-view">
      <h2>Invoices</h2>

      <div className="invoice-list">
        {invoices.map((invoice) => (
          <div
            key={invoice._id}
            className="invoice-row"
            onClick={() => setSelectedInvoice(invoice)}
          >
            <span className="invoice-number">{invoice.invoiceNumber}</span>
            <span className="invoice-customer">{invoice.customerName}</span>
            <span className="invoice-amount">${invoice.total?.toFixed(2)}</span>
            <span
              className="invoice-status"
              style={{ color: getStatusColor(invoice.status) }}
            >
              {invoice.status}
            </span>
            <span className="invoice-date">
              {new Date(invoice.issueDate).toLocaleDateString()}
            </span>
            <button onClick={(e) => { e.stopPropagation(); downloadInvoice(invoice._id); }}>
              Download
            </button>
          </div>
        ))}
      </div>

      {selectedInvoice && (
        <div className="invoice-detail">
          <h3>Invoice {selectedInvoice.invoiceNumber}</h3>
          <p>Customer: {selectedInvoice.customerName}</p>
          <p>Email: {selectedInvoice.customerEmail}</p>
          <p>Due: {new Date(selectedInvoice.dueDate).toLocaleDateString()}</p>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {selectedInvoice.lineItems?.map((item, i) => (
                <tr key={i}>
                  <td>{item.description}</td>
                  <td>{item.quantity}</td>
                  <td>${item.unitPrice?.toFixed(2)}</td>
                  <td>${item.amount?.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="3">Subtotal</td>
                <td>${selectedInvoice.subtotal?.toFixed(2)}</td>
              </tr>
              <tr>
                <td colSpan="3">Tax</td>
                <td>${selectedInvoice.taxTotal?.toFixed(2)}</td>
              </tr>
              <tr>
                <td colSpan="3"><strong>Total</strong></td>
                <td><strong>${selectedInvoice.total?.toFixed(2)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

export default InvoiceView;
