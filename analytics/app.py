import os
import logging
from contextlib import asynccontextmanager

import structlog
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import motor.motor_asyncio
import redis.asyncio as aioredis

from models.schema import (
    ForecastRequest, ForecastResponse,
    ComplianceCheckRequest, ComplianceCheckResponse,
    HealthResponse,
)
from services.forecast import ForecastService
from services.compliance_check import ComplianceChecker

load_dotenv()

# Environment variables
DATABASE_URL = os.getenv("DATABASE_URL", "mongodb://localhost:27017/fincommerce")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
LOG_LEVEL = os.getenv("LOG_LEVEL", "info")
PORT = int(os.getenv("PORT", 8000))

# Structured logging setup using structlog
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
)

logging.basicConfig(level=getattr(logging, LOG_LEVEL.upper(), logging.INFO))
logger = structlog.get_logger(__name__)

# Database and Redis connections
mongo_client = None
redis_client = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global mongo_client, redis_client
    # Startup
    mongo_client = motor.motor_asyncio.AsyncIOMotorClient(DATABASE_URL)
    redis_client = aioredis.from_url(REDIS_URL)
    logger.info("analytics_service_started", database=DATABASE_URL, port=PORT)
    yield
    # Shutdown
    mongo_client.close()
    await redis_client.close()
    logger.info("analytics_service_stopped")


app = FastAPI(
    title="FinCommerce Analytics",
    description="Financial analytics and forecasting microservice",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    return mongo_client.get_database()


def get_redis():
    return redis_client


@app.get("/health", response_model=HealthResponse)
async def health_check():
    checks = {}
    try:
        await mongo_client.admin.command("ping")
        checks["mongodb"] = "healthy"
    except Exception:
        checks["mongodb"] = "unhealthy"

    try:
        await redis_client.ping()
        checks["redis"] = "healthy"
    except Exception:
        checks["redis"] = "unhealthy"

    status = "ok" if all(v == "healthy" for v in checks.values()) else "degraded"
    return HealthResponse(status=status, checks=checks)


@app.post("/api/forecast", response_model=ForecastResponse)
async def generate_forecast(
    request: ForecastRequest,
    db=Depends(get_db),
    cache=Depends(get_redis),
):
    logger.info("forecast_requested", period=request.period, metric=request.metric)
    service = ForecastService(db, cache)
    result = await service.generate_forecast(request)
    return result


@app.post("/api/compliance-check", response_model=ComplianceCheckResponse)
async def run_compliance_check(
    request: ComplianceCheckRequest,
    db=Depends(get_db),
):
    logger.info("compliance_check_requested", check_type=request.check_type)
    checker = ComplianceChecker(db)
    result = await checker.run_check(request)
    return result


@app.get("/api/metrics")
async def get_metrics(db=Depends(get_db)):
    orders_collection = db.get_collection("orders")
    total_orders = await orders_collection.count_documents({})
    paid_orders = await orders_collection.count_documents({"paymentStatus": "paid"})

    pipeline = [
        {"$match": {"paymentStatus": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "avg": {"$avg": "$total"}}},
    ]
    revenue = await orders_collection.aggregate(pipeline).to_list(1)

    return {
        "total_orders": total_orders,
        "paid_orders": paid_orders,
        "total_revenue": revenue[0]["total"] if revenue else 0,
        "average_order_value": revenue[0]["avg"] if revenue else 0,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
