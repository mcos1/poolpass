import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "../lib/api";
import { getAccessToken } from "../lib/tokenStore";
import { useAuth } from "../lib/auth";

export function useLiveJobs(enabled: boolean) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled || !user) return;
    const token = getAccessToken();
    if (!token) return;

    const socket = io(API_BASE_URL || undefined, {
      path: "/socket.io",
      auth: { token },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    const bump = () => {
      void qc.invalidateQueries({ queryKey: ["jobs"], exact: false });
    };

    socket.on("job:created", bump);
    socket.on("job:updated", bump);
    socket.on("job:deleted", bump);
    socket.on("note:added", bump);

    return () => {
      socket.off("job:created", bump);
      socket.off("job:updated", bump);
      socket.off("job:deleted", bump);
      socket.off("note:added", bump);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, user, qc]);
}
