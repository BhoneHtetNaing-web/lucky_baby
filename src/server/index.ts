import { setupSocket } from "./socket/index.js";

const { io, emitAutopilot } = setupSocket(server);