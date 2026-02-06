import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient

from analytics.app import app
from analytics.models.schema import (
    ForecastRequest,
    ComplianceCheckRequest,
    ServiceContainer,
    CustomerProfile,
)
from analytics.services.forecast import ForecastService
from analytics.services.compliance_check import ComplianceChecker


@pytest.fixture
def mock_db():
    """Create a mock database."""
    db = MagicMock()
    collection = MagicMock()
    collection.count_documents = AsyncMock(return_value=5)
    collection.aggregate = MagicMock()
    collection.aggregate.return_value.to_list = AsyncMock(return_value=[
        {"_id": "2024-01-01", "value": 100},
        {"_id": "2024-01-02", "value": 120},
        {"_id": "2024-01-03", "value": 95},
        {"_id": "2024-01-04", "value": 140},
        {"_id": "2024-01-05", "value": 130},
        {"_id": "2024-01-06", "value": 110},
        {"_id": "2024-01-07", "value": 125},
        {"_id": "2024-01-08", "value": 135},
        {"_id": "2024-01-09", "value": 145},
        {"_id": "2024-01-10", "value": 150},
    ])
    collection.find = MagicMock()
    collection.find.return_value.to_list = AsyncMock(return_value=[])
    db.get_collection = MagicMock(return_value=collection)
    return db


@pytest.fixture
def mock_cache():
    """Create a mock Redis cache."""
    cache = MagicMock()
    cache.get = AsyncMock(return_value=None)
    cache.set = AsyncMock()
    return cache


class TestForecastService:
    @pytest.mark.asyncio
    async def test_generate_revenue_forecast(self, mock_db, mock_cache):
        service = ForecastService(mock_db, mock_cache)
        request = ForecastRequest(metric="revenue", period="7d")

        result = await service.generate_forecast(request)

        assert result.metric == "revenue"
        assert result.period == "7d"
        assert len(result.data_points) == 7
        assert result.confidence >= 0 and result.confidence <= 1

    @pytest.mark.asyncio
    async def test_generate_order_forecast(self, mock_db, mock_cache):
        service = ForecastService(mock_db, mock_cache)
        request = ForecastRequest(metric="orders", period="30d")

        result = await service.generate_forecast(request)

        assert result.metric == "orders"
        assert len(result.data_points) == 30

    @pytest.mark.asyncio
    async def test_forecast_insufficient_data(self, mock_db, mock_cache):
        # Override mock to return insufficient data
        collection = MagicMock()
        collection.aggregate = MagicMock()
        collection.aggregate.return_value.to_list = AsyncMock(return_value=[
            {"_id": "2024-01-01", "value": 100},
        ])
        mock_db.get_collection = MagicMock(return_value=collection)

        service = ForecastService(mock_db, mock_cache)
        request = ForecastRequest(metric="revenue", period="7d")

        with pytest.raises(ValueError, match="Insufficient historical data"):
            await service.generate_forecast(request)


class TestComplianceChecker:
    @pytest.mark.asyncio
    async def test_gdpr_check_no_issues(self, mock_db):
        collection = MagicMock()
        collection.count_documents = AsyncMock(return_value=0)
        collection.find = MagicMock()
        collection.find.return_value.to_list = AsyncMock(return_value=[])
        mock_db.get_collection = MagicMock(return_value=collection)

        checker = ComplianceChecker(mock_db)
        request = ComplianceCheckRequest(check_type="gdpr")
        result = await checker.run_check(request)

        assert result.status == "pass"
        assert result.summary["total_issues"] == 0

    @pytest.mark.asyncio
    async def test_gdpr_check_with_issues(self, mock_db):
        collection = MagicMock()
        collection.count_documents = AsyncMock(return_value=10)
        collection.find = MagicMock()
        collection.find.return_value.to_list = AsyncMock(return_value=[])
        mock_db.get_collection = MagicMock(return_value=collection)

        checker = ComplianceChecker(mock_db)
        request = ComplianceCheckRequest(check_type="gdpr")
        result = await checker.run_check(request)

        assert result.status in ("warning", "fail")
        assert result.summary["total_issues"] > 0

    @pytest.mark.asyncio
    async def test_pci_check(self, mock_db):
        collection = MagicMock()
        collection.count_documents = AsyncMock(return_value=0)
        mock_db.get_collection = MagicMock(return_value=collection)

        checker = ComplianceChecker(mock_db)
        request = ComplianceCheckRequest(check_type="pci")
        result = await checker.run_check(request)

        assert result.check_type == "pci"

    @pytest.mark.asyncio
    async def test_data_retention_check(self, mock_db):
        collection = MagicMock()
        collection.count_documents = AsyncMock(return_value=0)
        mock_db.get_collection = MagicMock(return_value=collection)

        checker = ComplianceChecker(mock_db)
        request = ComplianceCheckRequest(check_type="data_retention")
        result = await checker.run_check(request)

        assert result.check_type == "data_retention"


class TestSchemaModels:
    def test_customer_profile_pii_fields(self):
        profile = CustomerProfile(
            customer_id="cust_123",
            email="test@example.com",
            full_name="John Doe",
            phone="+1234567890",
            date_of_birth=datetime(1990, 1, 15),
            tax_id="123-45-6789",
            total_orders=5,
            total_spent=500.00,
        )

        assert profile.email == "test@example.com"
        assert profile.phone == "+1234567890"
        assert profile.tax_id == "123-45-6789"

    def test_service_container_di(self):
        ServiceContainer.register("test_service", {"key": "value"})
        resolved = ServiceContainer.resolve("test_service")
        assert resolved["key"] == "value"

    def test_service_container_unregistered(self):
        with pytest.raises(ValueError):
            ServiceContainer.resolve("nonexistent_service")


class TestHealthEndpoint:
    @pytest.mark.asyncio
    async def test_health_check(self):
        async with AsyncClient(app=app, base_url="http://test") as client:
            # This would need proper mocking of db/redis in real tests
            pass  # Placeholder for integration test
