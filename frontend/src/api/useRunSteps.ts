import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { SOCKET_EVENTS, type RunStepEvent, type RunUpdateEvent, type Step } from "@playground/shared";
import { api } from "./client";

/** Follow one run: load the steps it already has, then stay subscribed for new ones. */
export function useRunSteps(runId?: string) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [update, setUpdate] = useState<RunUpdateEvent | null>(null);

  useEffect(() => {
    if (!runId) {
      setSteps([]);
      setUpdate(null);
      return;
    }

    let active = true;
    api
      .getRun(runId)
      .then((run) => {
        if (active) setSteps(run.steps);
      })
      .catch(() => undefined);

    const socket: Socket = io(api.baseUrl, { transports: ["websocket", "polling"] });
    socket.emit(SOCKET_EVENTS.subscribe, runId);
    socket.on(SOCKET_EVENTS.step, (event: RunStepEvent) => {
      setSteps((current) => (current.some((s) => s.id === event.step.id) ? current : [...current, event.step]));
    });
    socket.on(SOCKET_EVENTS.update, (event: RunUpdateEvent) => setUpdate(event));

    return () => {
      active = false;
      socket.emit(SOCKET_EVENTS.unsubscribe, runId);
      socket.disconnect();
    };
  }, [runId]);

  return { steps, update };
}
