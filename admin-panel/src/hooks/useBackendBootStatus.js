import { useCallback, useEffect, useState } from "react";

const HEALTH_PATH = "/api/v1/health";

const withTimeout = async (promise, timeoutMs) => {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error("Backend health check timed out"));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export function useBackendBootStatus() {
  const [status, setStatus] = useState("checking");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

    if (!apiBaseUrl) {
      setStatus("unavailable");
      setError("VITE_API_BASE_URL is not defined.");
      return undefined;
    }

    let cancelled = false;
    setStatus("checking");
    setError("");

    const run = async () => {
      try {
        const normalizedBase = apiBaseUrl.replace(/\/$/, "");
        const response = await withTimeout(
          fetch(`${normalizedBase}${HEALTH_PATH}`, {
            method: "GET",
            headers: { Accept: "application/json" },
          }),
          5000,
        );

        if (!response.ok) {
          throw new Error(`Backend health check failed with ${response.status}`);
        }

        const payload = await response.json();
        if (payload?.success !== true) {
          throw new Error("Backend health endpoint returned an invalid response.");
        }

        if (!cancelled) {
          setStatus("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("unavailable");
          setError(
            err?.message ||
              "Could not connect to the backend. Check the API server and environment values.",
          );
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { status, error, retry };
}
