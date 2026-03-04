import { io } from "socket.io-client";
import { API_BASE } from "./api";

export function createAdminSocket(token: string) {
  return io(API_BASE, {
    auth: { token },
    transports: ["websocket"], // força websocket (mais estável)
  });
}