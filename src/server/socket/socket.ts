import { Server } from "socket.io";

export const initSocket = (server: any) => {
  const io = new Server(server, {
    cors: { origin: "*" },
  });

  let onlineUsers = new Set();

  io.on("connection", (socket) => {
    console.log("ADMIN DASHBOARD CONNECTED");

    // 👤 user online tracking
    socket.on("user-online", (userId) => {
      onlineUsers.add(userId);

      io.emit("live-users", Array.from(onlineUsers));
    });

    socket.on("disconnect", () => {
      console.log("DISCONNECTED");
    });
  });

  return io;
};