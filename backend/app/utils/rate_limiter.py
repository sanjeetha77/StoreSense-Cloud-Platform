import time
from threading import Lock
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

class TokenBucketRateLimiter:
    def __init__(self, capacity: int, refill_rate: float):
        """
        capacity: Maximum number of tokens in the bucket.
        refill_rate: Number of tokens added to the bucket per second.
        """
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.buckets = {}
        self.lock = Lock()

    def _get_bucket(self, ip: str):
        now = time.time()
        if ip not in self.buckets:
            self.buckets[ip] = {
                "tokens": float(self.capacity),
                "last_refill": now
            }
        else:
            # Calculate refilled tokens based on time passed
            elapsed = now - self.buckets[ip]["last_refill"]
            refilled = elapsed * self.refill_rate
            if refilled > 0:
                self.buckets[ip]["tokens"] = min(
                    float(self.capacity),
                    self.buckets[ip]["tokens"] + refilled
                )
                self.buckets[ip]["last_refill"] = now
        return self.buckets[ip]

    def consume(self, ip: str) -> bool:
        with self.lock:
            bucket = self._get_bucket(ip)
            if bucket["tokens"] >= 1.0:
                bucket["tokens"] -= 1.0
                return True
            return False

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, capacity: int = 60, refill_rate: float = 1.0):
        super().__init__(app)
        self.limiter = TokenBucketRateLimiter(capacity, refill_rate)

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        # Exclude health check and metrics scraping from rate limiting
        if path in ["/health", "/metrics", "/nginx_status"] or path.startswith("/metrics"):
            return await call_next(request)

        client_ip = "unknown"
        if request.client:
            client_ip = request.client.host

        # Extract client IP from X-Forwarded-For header set by proxy
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()

        if not self.limiter.consume(client_ip):
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Try again later."}
            )

        return await call_next(request)
