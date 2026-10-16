import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { authRoutes } from "./modules/auth/auth.routes";
import { onboardingRoutes } from "./modules/onboarding/onboarding.routes";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.WEB_URL }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "ai-sales-agent-api",
  });
});

// Auth endpoints
app.use("/api/auth", authRoutes);
app.use("/api/onboarding", onboardingRoutes);

app.use(errorHandler);

export default app;