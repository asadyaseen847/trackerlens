import mongoose from 'mongoose';
import { loadEnv } from '../config/env.js';

interface MongoCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Cached on globalThis so warm Vercel invocations (and tsx watch reloads) reuse one connection.
const globalForMongo = globalThis as typeof globalThis & { __mongo?: MongoCache };
const cache: MongoCache = (globalForMongo.__mongo ??= { conn: null, promise: null });

export async function connectMongo(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    const uri = loadEnv().MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not set');
    cache.promise = mongoose.connect(uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 8000,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }
  return cache.conn;
}
