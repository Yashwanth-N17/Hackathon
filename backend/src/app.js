import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectToDB } from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import facultyRoutes from "./routes/faculty.routes.js";
import questionRoutes from "./routes/question.routes.js";
import assessmentRoutes from "./routes/assessment.routes.js";
import placementRoutes from "./routes/placement.routes.js";
import studentRoutes from "./routes/student.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import interviewRoutes from "./routes/interview.routes.js";
import trainingRoutes from "./routes/training.routes.js";
import companyRoutes from "./routes/company.routes.js";


const app = express();
connectToDB();

app.use(express.json());
app.use(cors({
  origin: [process.env.FRONTEND_URL, "http://localhost:8080", "http://127.0.0.1:8080"],
  credentials: true,
}));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/faculty", facultyRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/placement", placementRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/training", trainingRoutes);
app.use("/api/company", companyRoutes);


export default app;