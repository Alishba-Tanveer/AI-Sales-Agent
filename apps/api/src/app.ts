import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { authRoutes } from "./modules/auth/auth.routes";
import { onboardingRoutes } from "./modules/onboarding/onboarding.routes";
import { usersRoutes } from "./modules/users/users.routes";
import { teamRoutes } from "./modules/team/team.routes";
import { settingsRoutes } from "./modules/settings/settings.routes";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.WEB_URL }));
app.use(express.json({ limit: "4mb" }));

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "ai-sales-agent-api",
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/settings", settingsRoutes);

app.use(errorHandler);

export default app;