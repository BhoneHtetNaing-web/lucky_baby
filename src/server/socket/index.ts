import { Server } from "socket.io";

export const setupSocket = (server: any) => {
  const io = new Server(server, { cors: { origin: "*" } });

  io.on("connection", (socket) => {
    console.log("user connected");

    socket.on("join-admin", () => {
      socket.join("admin-room");
    });

    socket.on("join-flight-stream", () => {
      socket.join("flight-stream");
    });
  });

  // 🚀 AUTOPILOT EVENT EMITTER
  const emitAutopilot = (data: any) => {
    io.to("admin-room").emit("autopilot-log", data);
  };

  return { io, emitAutopilot };
};