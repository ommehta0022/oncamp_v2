"""
Redis Caching Utilities for Performance Optimization
Provides decorators and functions for caching API responses.
"""

import functools
import hashlib
import json
import logging
from typing import Any, Callable, Optional
from fastapi import Request, Response
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class CacheManager:
    """Manages Redis caching for API endpoints."""
    
    def __init__(self, redis_client):
        self.redis = redis_client
        self.enabled = redis_client.enabled if redis_client else False
    
    def generate_cache_key(self, prefix: str, **kwargs) -> str:
        """Generate a unique cache key from prefix and parameters."""
        # Sort kwargs for consistent key generation
        sorted_params = sorted(kwargs.items())
        params_str = json.dumps(sorted_params, sort_keys=True)
        params_hash = hashlib.md5(params_str.encode()).hexdigest()[:12]
        return f"cache:{prefix}:{params_hash}"
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        if not self.enabled:
            return None
        try:
            result = self.redis.command("GET", key)
            if result:
                return json.loads(result)
            return None
        except Exception as e:
            logger.warning(f"Cache get error: {e}")
            return None
    
    def set(self, key: str, value: Any, ttl: int = 60) -> bool:
        """Set value in cache with TTL in seconds."""
        if not self.enabled:
            return False
        try:
            serialized = json.dumps(value, default=str)
            self.redis.command("SETEX", key, ttl, serialized)
            return True
        except Exception as e:
            logger.warning(f"Cache set error: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """Delete key from cache."""
        if not self.enabled:
            return False
        try:
            self.redis.command("DEL", key)
            return True
        except Exception as e:
            logger.warning(f"Cache delete error: {e}")
            return False
    
    def delete_pattern(self, pattern: str) -> bool:
        """Delete all keys matching pattern."""
        if not self.enabled:
            return False
        try:
            # Get all matching keys
            keys = self.redis.command("KEYS", pattern)
            if keys and isinstance(keys, list):
                for key in keys:
                    self.redis.command("DEL", key)
            return True
        except Exception as e:
            logger.warning(f"Cache delete pattern error: {e}")
            return False
    
    def invalidate_dashboard(self):
        """Invalidate all dashboard-related caches."""
        self.delete_pattern("cache:dashboard:*")
        self.delete_pattern("cache:stats:*")
    
    def invalidate_users(self):
        """Invalidate user-related caches."""
        self.delete_pattern("cache:users:*")
        self.delete_pattern("cache:dashboard:*")  # Dashboard shows user count
    
    def invalidate_groups(self):
        """Invalidate group-related caches."""
        self.delete_pattern("cache:groups:*")
        self.delete_pattern("cache:dashboard:*")  # Dashboard shows group count
    
    def invalidate_reports(self):
        """Invalidate report-related caches."""
        self.delete_pattern("cache:reports:*")
        self.delete_pattern("cache:dashboard:*")  # Dashboard shows pending reports
    
    def invalidate_analytics(self):
        """Invalidate analytics caches."""
        self.delete_pattern("cache:analytics:*")


def cached(
    cache_manager: CacheManager,
    key_prefix: str,
    ttl: int = 60,
    include_user: bool = False
):
    """
    Decorator for caching endpoint responses.
    
    Args:
        cache_manager: CacheManager instance
        key_prefix: Prefix for cache key (e.g., 'dashboard', 'users')
        ttl: Time-to-live in seconds (default: 60s)
        include_user: Include user ID in cache key (for user-specific data)
    
    Usage:
        @cached(cache_manager, 'dashboard', ttl=60)
        async def get_dashboard(user_id: str):
            return {"data": "..."}
    """
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Skip caching if not enabled
            if not cache_manager.enabled:
                return await func(*args, **kwargs) if asyncio.iscoroutinefunction(func) else func(*args, **kwargs)
            
            # Extract user_id if needed
            cache_params = {}
            if include_user:
                # Try to get user from kwargs or args
                user = kwargs.get('user')
                if user and hasattr(user, 'id'):
                    cache_params['user_id'] = user.id
            
            # Add query parameters to cache key
            for key in ['page', 'limit', 'status', 'search', 'city', 'category', 'visibility']:
                if key in kwargs and kwargs[key] is not None:
                    cache_params[key] = kwargs[key]
            
            # Generate cache key
            cache_key = cache_manager.generate_cache_key(key_prefix, **cache_params)
            
            # Try to get from cache
            cached_value = cache_manager.get(cache_key)
            if cached_value is not None:
                logger.info(f"Cache HIT: {cache_key}")
                return cached_value
            
            # Cache miss - call function
            logger.info(f"Cache MISS: {cache_key}")
            result = await func(*args, **kwargs) if asyncio.iscoroutinefunction(func) else func(*args, **kwargs)
            
            # Store in cache
            cache_manager.set(cache_key, result, ttl)
            
            return result
        
        return wrapper
    return decorator


def add_cache_headers(response: Response, max_age: int = 60, public: bool = True):
    """Add HTTP cache headers to response."""
    cache_control = f"{'public' if public else 'private'}, max-age={max_age}"
    response.headers["Cache-Control"] = cache_control
    response.headers["X-Cache-TTL"] = str(max_age)
    return response


# For sync functions compatibility
import asyncio
