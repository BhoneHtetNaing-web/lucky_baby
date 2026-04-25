import { WebSocketServer } from "ws";

export const initMultiFlightTracking = (server: any) => {
  const wss = new WebSocketServer({ server });

  const flights = [
    {
      id: 1,
      lat: 16.8661,
      lng: 96.1951,
    },
    {
      id: 2,
      lat: 13.7563,
      lng: 100.5018,
    },
    {
      id: 3,
      lat: 35.6762,
      lng: 139.6503,
    },
  ];

  wss.on("connection", (ws) => {
    console.log("Multi flight tracking connected");

    const interval = setInterval(() => {
      const updated = flights.map((f) => {
        f.lat += (Math.random() - 0.5) * 0.1;
        f.lng += (Math.random() - 0.5) * 0.1;
        return f;
      });

      ws.send(JSON.stringify(updated));
    }, 3000);

    ws.on("close", () => clearInterval(interval));
  });
};