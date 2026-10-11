import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';

interface Bucket {
  tokens: number;
  updated: number;
}

/**
 * Small in-memory token bucket per client IP for the write endpoints. Enough for a single
 * instance; swap for a shared store if the app is ever scaled out.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private readonly capacity = 30; // burst
  private readonly refillPerSec = 0.5; // sustained: 30 per minute

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const b = this.buckets.get(key) ?? { tokens: this.capacity, updated: now };
    b.tokens = Math.min(this.capacity, b.tokens + ((now - b.updated) / 1000) * this.refillPerSec);
    b.updated = now;
    if (b.tokens < 1) {
      this.buckets.set(key, b);
      throw new HttpException('Too many requests, slow down a little.', HttpStatus.TOO_MANY_REQUESTS);
    }
    b.tokens -= 1;
    this.buckets.set(key, b);
    if (this.buckets.size > 10000) this.buckets.clear();
    return true;
  }
}
