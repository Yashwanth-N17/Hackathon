import { Server } from "socket.io";
import { InterviewService } from "../services/interview.service.js";

let ioInstance;

export function setupSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: [process.env.FRONTEND_URL, "http://localhost:8080", "http://127.0.0.1:8080"],
      methods: ["GET", "POST"]
    }
  });

  ioInstance = io;

  io.on("connection", (socket) => {
    console.log("New client connected", socket.id);

    socket.on("join_interview", (interviewId) => {
      socket.join(interviewId);
      console.log(`Socket ${socket.id} joined interview ${interviewId}`);
    });

    socket.on("send_message", async (data) => {
      const { interviewId, senderRole, senderName, text } = data;
      const message = await InterviewService.addMessage(interviewId, senderRole, senderName, text);
      io.to(interviewId).emit("receive_message", message);
    });

    socket.on("send_live_transcript", ({ interviewId, text, senderId }) => {
      socket.to(interviewId).emit("receive_live_transcript", { text, senderId });
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected");
    });
  });

  return io;
}

export const getIO = () => ioInstance;
