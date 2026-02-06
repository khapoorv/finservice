from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, EmailStr


# Dependency injection pattern via Pydantic models with inject-style defaults

class DatabaseConfig:
    """Injectable database configuration."""
    def __init__(self, connection_string: str = None):
        self.connection_string = connection_string


class CacheConfig:
    """Injectable cache configuration."""
    def __init__(self, redis_url: str = None, ttl: int = 3600):
        self.redis_url = redis_url
        self.ttl = ttl


# Service container for dependency injection
class ServiceContainer:
    """DI container that manages service lifecycle and injection."""
    _instances: Dict[str, Any] = {}

    @classmethod
    def register(cls, name: str, instance: Any):
        cls._instances[name] = instance

    @classmethod
    def resolve(cls, name: str) -> Any:
        if name not in cls._instances:
            raise ValueError(f"Service '{name}' not registered")
        return cls._instances[name]

    @classmethod
    def inject(cls, name: str):
        """Decorator for dependency injection."""
        def decorator(func):
            def wrapper(*args, **kwargs):
                kwargs[name] = cls.resolve(name)
                return func(*args, **kwargs)
            return wrapper
        return decorator


# Request/Response schemas

class ForecastRequest(BaseModel):
    metric: str = Field(..., description="Metric to forecast (revenue, orders, customers)")
    period: str = Field(default="30d", description="Forecast period (7d, 30d, 90d)")
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class ForecastDataPoint(BaseModel):
    date: str
    actual: Optional[float] = None
    predicted: float
    lower_bound: float
    upper_bound: float


class ForecastResponse(BaseModel):
    metric: str
    period: str
    data_points: List[ForecastDataPoint]
    confidence: float
    model_info: Dict[str, Any]


class ComplianceCheckRequest(BaseModel):
    check_type: str = Field(..., description="Type of compliance check (gdpr, pci, data_retention)")
    target: Optional[str] = None


class ComplianceIssue(BaseModel):
    severity: str  # critical, high, medium, low
    category: str
    description: str
    recommendation: str
    affected_records: int = 0


class ComplianceCheckResponse(BaseModel):
    check_type: str
    status: str  # pass, fail, warning
    issues: List[ComplianceIssue]
    summary: Dict[str, Any]
    checked_at: datetime = Field(default_factory=datetime.utcnow)


class HealthResponse(BaseModel):
    status: str
    checks: Dict[str, str]


# PII-containing models for analytics

class CustomerProfile(BaseModel):
    """Customer analytics profile - contains PII fields."""
    customer_id: str
    email: EmailStr               # PII
    full_name: str                # PII
    phone: Optional[str] = None   # PII
    date_of_birth: Optional[datetime] = None  # PII
    address: Optional[Dict[str, str]] = None  # PII
    tax_id: Optional[str] = None  # PII - Tax identification number

    # Analytics data
    total_orders: int = 0
    total_spent: float = 0.0
    average_order_value: float = 0.0
    first_purchase: Optional[datetime] = None
    last_purchase: Optional[datetime] = None
    customer_segment: str = "new"

    class Config:
        json_schema_extra = {
            "example": {
                "customer_id": "cust_123",
                "email": "john@example.com",
                "full_name": "John Doe",
                "phone": "+1234567890",
                "total_orders": 15,
                "total_spent": 1250.00,
            }
        }


class TransactionAnalytics(BaseModel):
    transaction_id: str
    amount: float
    currency: str = "USD"
    payment_method: str
    status: str
    customer_id: str
    timestamp: datetime
    risk_score: Optional[float] = None
