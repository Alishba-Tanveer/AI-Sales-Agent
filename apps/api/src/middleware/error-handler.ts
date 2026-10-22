import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/app-error";

export const errorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next,
) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      message: error.message,
    });
    return;
  }

  // Validation failures (controllers that call schema.parse) are the client's mistake: answer 400, not 500.
  if (error instanceof ZodError) {
    res.status(400).json({
      message: error.issues.map((i) => i.message).join(", ") || "Invalid request",
    });
    return;
  }

  console.error(error);

  res.status(500).json({
    message: "Internal server error",
  });
};
