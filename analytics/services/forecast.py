# Heavy coupling example - this file intentionally imports many modules
# to trigger the heavy_coupling / circular_risk scanner patterns

import os
import sys
import json
import logging
import hashlib
import datetime
import math
import statistics
import collections
import functools
import itertools
import operator
import copy
import re
import io
import csv
from typing import Dict, List, Optional, Any, Tuple

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler

from models.schema import (
    ForecastRequest,
    ForecastResponse,
    ForecastDataPoint,
    CustomerProfile,
    TransactionAnalytics,
    ServiceContainer,
)

# TODO: Refactor this service - it's doing too much
# FIXME: Memory leak when processing large datasets
# TODO: Add proper error handling for database timeouts
# FIXME: The linear regression model is too simplistic for real forecasting
# TODO: Implement ARIMA or Prophet for better time series forecasting
# TODO: Add caching for frequently requested forecasts
# FIXME: Race condition when multiple forecasts run simultaneously

logger = logging.getLogger(__name__)


class ForecastService:
    """Financial forecasting service.

    This service handles revenue, order, and customer forecasting
    using historical data and machine learning models.
    """

    def __init__(self, db, cache):
        self.db = db
        self.cache = cache
        self.scaler = StandardScaler()
        self.model = LinearRegression()
        self._cache_ttl = 3600
        self._max_data_points = 10000

    async def generate_forecast(self, request: ForecastRequest) -> ForecastResponse:
        """Generate a forecast for the requested metric and period."""
        # Check cache first
        cache_key = f"forecast:{request.metric}:{request.period}"
        cached = await self._get_cached(cache_key)
        if cached:
            return ForecastResponse(**json.loads(cached))

        # Fetch historical data
        historical_data = await self._fetch_historical_data(
            request.metric, request.start_date, request.end_date
        )

        if len(historical_data) < 7:
            raise ValueError("Insufficient historical data for forecasting (need at least 7 days)")

        # Prepare data for model
        df = self._prepare_dataframe(historical_data)

        # Train model and generate predictions
        predictions = self._run_forecast(df, request.period)

        # Build response
        data_points = []
        for _, row in predictions.iterrows():
            data_points.append(ForecastDataPoint(
                date=row["date"].strftime("%Y-%m-%d"),
                actual=row.get("actual"),
                predicted=round(row["predicted"], 2),
                lower_bound=round(row["lower_bound"], 2),
                upper_bound=round(row["upper_bound"], 2),
            ))

        response = ForecastResponse(
            metric=request.metric,
            period=request.period,
            data_points=data_points,
            confidence=self._calculate_confidence(df, predictions),
            model_info={
                "algorithm": "linear_regression",
                "r_squared": round(self.model.score(
                    df[["day_index"]].values,
                    df["value"].values
                ), 4) if len(df) > 1 else 0,
                "data_points_used": len(historical_data),
                "training_window": f"{len(df)} days",
            },
        )

        # Cache the result
        await self._set_cached(cache_key, response.model_dump_json(), self._cache_ttl)

        return response

    async def _fetch_historical_data(
        self, metric: str, start_date: Optional[datetime.datetime], end_date: Optional[datetime.datetime]
    ) -> List[Dict]:
        """Fetch historical data from the database."""
        collection_name = self._get_collection_for_metric(metric)
        collection = self.db.get_collection(collection_name)

        query = {}
        if start_date:
            query["createdAt"] = {"$gte": start_date}
        if end_date:
            query.setdefault("createdAt", {})["$lte"] = end_date

        if metric == "revenue":
            pipeline = [
                {"$match": {**query, "paymentStatus": "paid"}},
                {"$group": {
                    "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$createdAt"}},
                    "value": {"$sum": "$total"},
                    "count": {"$sum": 1},
                }},
                {"$sort": {"_id": 1}},
                {"$limit": self._max_data_points},
            ]
        elif metric == "orders":
            pipeline = [
                {"$match": query},
                {"$group": {
                    "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$createdAt"}},
                    "value": {"$sum": 1},
                }},
                {"$sort": {"_id": 1}},
                {"$limit": self._max_data_points},
            ]
        elif metric == "customers":
            collection = self.db.get_collection("users")
            pipeline = [
                {"$match": query},
                {"$group": {
                    "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$createdAt"}},
                    "value": {"$sum": 1},
                }},
                {"$sort": {"_id": 1}},
            ]
        else:
            raise ValueError(f"Unknown metric: {metric}")

        results = await collection.aggregate(pipeline).to_list(self._max_data_points)
        return [{"date": r["_id"], "value": r["value"]} for r in results]

    def _prepare_dataframe(self, data: List[Dict]) -> pd.DataFrame:
        """Prepare data for model training."""
        df = pd.DataFrame(data)
        df["date"] = pd.to_datetime(df["date"])
        df = df.sort_values("date").reset_index(drop=True)
        df["day_index"] = range(len(df))
        df["day_of_week"] = df["date"].dt.dayofweek
        df["month"] = df["date"].dt.month
        return df

    def _run_forecast(self, df: pd.DataFrame, period: str) -> pd.DataFrame:
        """Train model and generate forecast."""
        period_days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)

        # Train on historical data
        X_train = df[["day_index"]].values
        y_train = df["value"].values

        self.model.fit(X_train, y_train)

        # Generate predictions for future dates
        last_index = df["day_index"].max()
        last_date = df["date"].max()

        future_indices = np.arange(last_index + 1, last_index + 1 + period_days).reshape(-1, 1)
        predictions = self.model.predict(future_indices)

        # Calculate prediction intervals
        residuals = y_train - self.model.predict(X_train)
        std_residual = float(np.std(residuals)) if len(residuals) > 1 else 0
        margin = 1.96 * std_residual

        future_dates = [last_date + datetime.timedelta(days=i + 1) for i in range(period_days)]

        result = pd.DataFrame({
            "date": future_dates,
            "predicted": predictions,
            "lower_bound": predictions - margin,
            "upper_bound": predictions + margin,
        })

        # Ensure no negative values for metrics that can't be negative
        result["predicted"] = result["predicted"].clip(lower=0)
        result["lower_bound"] = result["lower_bound"].clip(lower=0)

        return result

    def _calculate_confidence(self, historical: pd.DataFrame, predictions: pd.DataFrame) -> float:
        """Calculate forecast confidence score (0-1)."""
        if len(historical) < 10:
            return 0.5

        X = historical[["day_index"]].values
        y = historical["value"].values
        r_squared = self.model.score(X, y)

        data_quality = min(len(historical) / 90, 1.0)
        confidence = (r_squared * 0.6 + data_quality * 0.4)

        return round(max(0.0, min(1.0, confidence)), 2)

    def _get_collection_for_metric(self, metric: str) -> str:
        return {"revenue": "orders", "orders": "orders", "customers": "users"}.get(metric, "orders")

    async def _get_cached(self, key: str) -> Optional[str]:
        try:
            return await self.cache.get(key)
        except Exception:
            return None

    async def _set_cached(self, key: str, value: str, ttl: int):
        try:
            await self.cache.set(key, value, ex=ttl)
        except Exception:
            logger.warning("Failed to cache forecast result")
