import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { captureError, record402 } from "@/lib/monitor";

export type ErrorCode =
  | "VALIDATION_ERROR" | "UNAUTHORIZED" | "CREDIT_LIMIT" | "NOT_FOUND"
  | "INVALID_STATE" | "UNCITED_CLAIM" | "RATE_LIMITED" | "VENDOR_ERROR";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400, UNAUTHORIZED: 401, CREDIT_LIMIT: 402, NOT_FOUND: 404,
  INVALID_STATE: 409, UNCITED_CLAIM: 422, RATE_LIMITED: 429, VENDOR_ERROR: 502,
};

export class ApiError extends Error {
  constructor(public code: ErrorCode, message: string, public details: Record<string, unknown> = {}, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

/** Single error shape for every route: { error: { code, message, details } } */
export function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    if (err.code === "CREDIT_LIMIT") record402();
    if (err.code === "VENDOR_ERROR") captureError(err, { code: err.code, ...err.details });
    return NextResponse.json({ error: { code: err.code, message: err.message, details: err.details }, ...err.extra }, { status: STATUS[err.code] });
  }
  if (err instanceof ZodError) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request", details: { issues: err.issues } } }, { status: 400 });
  }
  captureError(err, { unhandled: true });
  return NextResponse.json({ error: { code: "VENDOR_ERROR", message: "Unexpected server error", details: {} } }, { status: 502 });
}

/** Wrap a route handler so thrown errors use the standard shape. */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try { return await fn(...args); } catch (e) { return errorResponse(e); }
  };
}
