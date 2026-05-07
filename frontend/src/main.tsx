import { StrictMode, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "@/app/router";
import { useAuthStore } from "@/app/store/authStore";
import "leaflet/dist/leaflet.css";
import "./styles/tokens.css";
import "./index.css";

export function AppRoot() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshSession = useAuthStore((state) => state.refreshSession);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    void refreshSession();
  }, [accessToken, refreshSession]);

  return <RouterProvider router={router} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
);
