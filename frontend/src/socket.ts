import { io } from "socket.io-client";
import { API_BASE } from "./api";

export function createSocket(token: string) {
  return io(API_BASE, {
    auth: { token },
  });
}
