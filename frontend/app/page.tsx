"use client";

import { useState } from "react";

interface AskResponse {
  result: string;
  error: string;
}

const apiUrl = "";

export default function Home() {
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function ask() {
    setIsLoading(true);
    setResponse(null);

    try {
      const result = await fetch("/api/ask", { method: "POST" });
      const body = (await result.json()) as AskResponse;
      setResponse(body);
    } catch {
      setResponse({
        result: "",
        error: "The API could not be reached.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="panel" aria-labelledby="page-title">
        <p className="eyebrow">BLOGRESEARCH / WORKSPACE</p>
        <h1 id="page-title">Ask the research engine.</h1>
        <p className="lede">
          Run the configured provider through the application&apos;s presenter
          pipeline and inspect the response here.
        </p>
        <button type="button" onClick={ask} disabled={isLoading}>
          {isLoading ? "Working..." : "Ask"}
        </button>
        {response?.result && (
          <output className="result" aria-live="polite">
            <span>Result</span>
            {response.result}
          </output>
        )}
        {response?.error && (
          <p className="error" role="alert">
            {response.error}
          </p>
        )}
      </section>
      <aside className="signal" aria-label="Application status">
        <span className="signal-dot" />
        <span>Provider pipeline online</span>
      </aside>
    </main>
  );
}
