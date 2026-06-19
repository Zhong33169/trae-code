import express from "express";
import cors from "cors";
import { initDb } from "./db.js";
import authRoutes from "./routes/auth.js";
import orderRoutes from "./routes/orders.js";
import evidenceRoutes from "./routes/evidence.js";
import { seedData } from "./seed.js";

const app = express();
const PORT = 8002;

app.use(
  cors({
    origin: "http://localhost:3002",
    credentials: true,
  })
);

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/orders", evidenceRoutes);

initDb();
seedData();

app.listen(PORT, () => {
  console.log(`后端服务已启动: http://localhost:${PORT}`);
  console.log(`CORS 放行: http://localhost:3002`);
});
