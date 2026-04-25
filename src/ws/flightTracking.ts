import { WebSocketServer } from "ws";

export const initFlightTracking = (server: any) => {
  const wss = new WebSocketServer({ server });

  let position = {
    lat: 16.8661,
    lng: 96.1951,
  };

  wss.on("connection", (ws) => {
    console.log("Flight tracker connected");

    const interval = setInterval(() => {
      position.lat += 0.01;
      position.lng += 0.02;

      ws.send(
        JSON.stringify({
          flightId: 1,
          position,
        })
      );
    }, 3000);

    ws.on("close", () => clearInterval(interval));
  });
};