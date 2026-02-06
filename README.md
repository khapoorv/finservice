# FinCommerce

An online marketplace with integrated invoicing, financial reporting, and payment processing. Built with Node.js/Express, React, and a Python FastAPI analytics microservice.

## Architecture

- **Backend**: Node.js + Express REST API with MongoDB
- **Frontend**: React SPA
- **Analytics**: Python FastAPI microservice for financial forecasting and compliance
- **Infrastructure**: Docker, Kubernetes, Redis caching, Bull message queues

## Features

- Product catalog with search and filtering
- Shopping cart and order management
- Multi-gateway payment processing (Stripe + PayPal)
- Invoice generation and management
- Financial reporting and data export
- User authentication (JWT, OAuth, basic auth)
- GDPR compliance (data export, deletion, cookie consent)
- Audit logging and encryption
- Real-time notifications (email + SMS)
- Analytics and forecasting

## Quick Start

```bash
# Clone and install
git clone https://github.com/your-org/fincommerce.git
cd fincommerce
npm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Start with Docker
docker-compose up -d

# Or run locally
npm run dev
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login with credentials |
| GET | /api/products | List products |
| POST | /api/orders | Create order |
| POST | /api/payments/charge | Process payment |
| GET | /api/invoices | List invoices |
| GET | /api/reports/revenue | Revenue report |
| GET | /api/health | Health check |

## Testing

```bash
npm test
cd analytics && pytest
```

## License

MIT
