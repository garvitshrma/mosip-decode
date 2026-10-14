import type { Server } from "socket.io";
import { SOCKET_EVENTS, type RunStepEvent, type RunUpdateEvent } from "@playground/shared";

// The inspector follows one run at a time, so the room name is the run id.
let io: Server | undefined;

export function setSocketServer(server: Server): void {
  io = server;
  io.on("connection", (socket) => {
    socket.on(SOCKET_EVENTS.subscribe, (runId: string) => {
      if (typeof runId === "string" && runId) socket.join(runId);
    });
    socket.on(SOCKET_EVENTS.unsubscribe, (runId: string) => {
      if (typeof runId === "string" && runId) socket.leave(runId);
    });
  });
}

export function emitStep(event: RunStepEvent): void {
  io?.to(event.runId).emit(SOCKET_EVENTS.step, event);
}

export function emitRunUpdate(event: RunUpdateEvent): void {
  io?.to(event.runId).emit(SOCKET_EVENTS.update, event);
}
