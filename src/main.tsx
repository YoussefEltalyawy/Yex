import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Shell } from "./app/Shell";
import { initBackend } from "./lib/backend";
import { queryClient } from "./lib/query";
import "./styles/index.css";

initBackend()
  .then(() =>
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <Shell />
        </QueryClientProvider>
      </StrictMode>,
    ),
  )
  .catch((e) => {
    document.body.innerHTML = `<pre style="padding:24px;font:13px system-ui;color:#c33">YEX failed to start:\n${String(e)}</pre>`;
  });
