
import { useEffect, useState } from "react";
import {
  Globe,
  Search,
  LoaderCircle,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ExternalLink,
  MessageCircle,
  Send,
  Bot,
  User,
  RefreshCw,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function App() {
  const [url, setUrl] = useState("");
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiOnline, setApiOnline] = useState(false);

  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  const state = job?.state || job?.status;
  const completed = state === "completed";
  const failed = state === "failed";
  const active = Boolean(job && !completed && !failed);
  const websiteUrl = job?.url || job?.result?.websiteUrl || "";

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      try {
        const response = await fetch(`${API_URL}/health`);
        if (!response.ok) throw new Error("API unavailable");
        if (!cancelled) setApiOnline(true);
      } catch {
        if (!cancelled) setApiOnline(false);
      }
    }

    checkHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!job?.jobId || completed || failed) return;

    let cancelled = false;

    const timer = setInterval(async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/crawls/${encodeURIComponent(job.jobId)}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not fetch job status.");
        }

        if (!cancelled) {
          setError("");
          setJob((current) =>
            current?.jobId === data.jobId ? data : current
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not fetch job status.");
        }
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [job?.jobId, completed, failed]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setJob(null);
    setMessages([]);
    setQuestion("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/crawls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not start the crawl.");
      }

      setJob({
        ...data,
        state: data.status || "waiting",
        progress: 0,
      });
    } catch (err) {
      setError(err.message || "Could not connect to the API.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAsk(event) {
    event.preventDefault();

    const userQuestion = question.trim();
    if (!userQuestion || !websiteUrl || chatLoading) return;

    setError("");
    setChatLoading(true);
    setQuestion("");

    setMessages((current) => [
      ...current,
      { role: "user", text: userQuestion },
    ]);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteUrl,
          question: userQuestion,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to answer this question.");
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: data.answer || "The assistant returned an empty answer.",
          sources: data.sources || [],
        },
      ]);
    } catch (err) {
      setError(err.message || "Could not reach the chat API.");
    } finally {
      setChatLoading(false);
    }
  }

  function resetChat() {
    setMessages([]);
    setError("");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cyan-400/10 p-2.5 text-cyan-300">
              <Globe size={23} />
            </div>
            <div>
              <p className="font-semibold tracking-tight">Site Intelligence</p>
              <p className="text-xs text-slate-400">
                Website crawling & RAG assistant
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span
              className={`h-2 w-2 rounded-full ${
                apiOnline ? "bg-emerald-400" : "bg-red-400"
              }`}
            />
            {apiOnline ? "API connected" : "API disconnected"}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 pb-20 pt-14 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/5 px-4 py-2 text-sm text-cyan-200">
            <Globe size={15} />
            Website intelligence, powered by RAG
          </div>

          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
            Understand any
            <span className="block text-cyan-300">website, deeply.</span>
          </h1>

          <p className="mt-5 leading-7 text-slate-400">
            Crawl a website, index its content, and ask questions grounded in
            the pages it contains.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-9 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.04] p-3"
        >
          <label
            htmlFor="website-url"
            className="mb-2 block px-3 text-sm text-slate-300"
          >
            Website URL
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/10 bg-slate-900 px-4">
              <Globe size={19} className="shrink-0 text-slate-500" />
              <input
                id="website-url"
                type="url"
                required
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com"
                className="w-full bg-transparent py-4 text-sm outline-none placeholder:text-slate-600"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !apiOnline}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-6 py-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <LoaderCircle className="animate-spin" size={18} />
              ) : (
                <Search size={18} />
              )}
              {loading ? "Submitting..." : "Start crawl"}
            </button>
          </div>
        </form>

        {error && (
          <div
            role="alert"
            className="mx-auto mt-5 flex max-w-3xl items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200"
          >
            <CircleAlert size={19} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {job && (
          <section className="mx-auto mt-6 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">Crawl job</p>
                <p className="mt-1 break-all text-xs text-slate-500">
                  ID: {job.jobId}
                </p>
              </div>
              {completed ? (
                <CheckCircle2 className="shrink-0 text-emerald-400" />
              ) : failed ? (
                <CircleAlert className="shrink-0 text-red-400" />
              ) : (
                <LoaderCircle className="shrink-0 animate-spin text-cyan-300" />
              )}
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm">
              <Clock3 size={16} className="text-slate-400" />
              <span className="capitalize">{state || "waiting"}</span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-all ${
                  failed ? "bg-red-400" : "bg-cyan-300"
                }`}
                style={{
                  width: `${Math.max(0, Math.min(100, Number(job.progress) || 0))}%`,
                }}
              />
            </div>

            <p className="mt-2 text-right text-xs text-slate-500">
              {Number(job.progress) || 0}% reported progress
            </p>

            {failed && (
              <p className="mt-3 break-words text-sm text-red-300">
                {job.failedReason || "The crawl failed. Check worker logs."}
              </p>
            )}

            {completed && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-400/5 p-3 text-sm text-emerald-200">
                <CheckCircle2 size={17} />
                Website crawl completed successfully.
              </div>
            )}

            {job.url && (
              <a
                href={job.url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200"
              >
                Open website <ExternalLink size={15} />
              </a>
            )}
          </section>
        )}

        {completed && (
          <section className="mx-auto mt-8 max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70">
            <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-cyan-300/10 p-2 text-cyan-300">
                  <MessageCircle size={21} />
                </div>
                <div>
                  <h2 className="font-semibold">Chat with this website</h2>
                  <p className="max-w-lg break-all text-xs text-slate-400">
                    {websiteUrl}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={resetChat}
                disabled={chatLoading || messages.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-40"
              >
                <RefreshCw size={14} /> Clear chat
              </button>
            </div>

            <div className="flex min-h-64 flex-col gap-5 p-5">
              {messages.length === 0 && (
                <div className="m-auto max-w-md py-7 text-center">
                  <Bot size={30} className="mx-auto text-cyan-300" />
                  <h3 className="mt-3 font-medium">Ask the website anything</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Answers use retrieved content from the indexed website.
                    Start with a question about its purpose, services, or
                    information.
                  </p>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={`${index}-${message.role}`}
                  className={`flex gap-3 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="mt-1 h-fit rounded-lg bg-cyan-300/10 p-2 text-cyan-300">
                      <Bot size={17} />
                    </div>
                  )}

                  <div
                    className={`min-w-0 max-w-[88%] rounded-2xl px-4 py-3 ${
                      message.role === "user"
                        ? "bg-cyan-300 text-slate-950"
                        : "border border-white/10 bg-white/[0.04] text-slate-200"
                    }`}
                  >
                    {message.role === "user" ? (
                      <div className="whitespace-pre-wrap break-words text-sm leading-6">
                        {message.text}
                      </div>
                    ) : (
                      <>
                        <div className="whitespace-pre-wrap break-words text-sm leading-7">
                          {message.text}
                        </div>

                        {message.sources?.length > 0 && (
                          <div className="mt-4 border-t border-white/10 pt-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Sources
                            </p>
                            <div className="flex flex-col gap-2">
                              {message.sources.map((source) => (
                                <a
                                  key={source.url}
                                  href={source.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-start gap-2 break-all text-xs text-cyan-300 hover:text-cyan-200"
                                >
                                  <ExternalLink
                                    size={14}
                                    className="mt-0.5 shrink-0"
                                  />
                                  {source.title || source.url}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {message.role === "user" && (
                    <div className="mt-1 h-fit rounded-lg bg-white/10 p-2 text-slate-300">
                      <User size={17} />
                    </div>
                  )}
                </div>
              ))}

              {chatLoading && (
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <LoaderCircle size={18} className="animate-spin text-cyan-300" />
                  Searching website content and generating an answer...
                </div>
              )}
            </div>

            <form
              onSubmit={handleAsk}
              className="border-t border-white/10 p-4"
            >
              <div className="flex items-end gap-3 rounded-xl border border-white/10 bg-slate-950 px-3">
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder="Ask a question about this website..."
                  rows={2}
                  disabled={chatLoading}
                  className="max-h-32 min-h-12 flex-1 resize-y bg-transparent py-3 text-sm leading-6 outline-none placeholder:text-slate-600 disabled:opacity-50"
                />

                <button
                  type="submit"
                  disabled={chatLoading || !question.trim()}
                  aria-label="Send question"
                  className="mb-2 rounded-lg bg-cyan-300 p-3 text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {chatLoading ? (
                    <LoaderCircle size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Enter to send · Shift + Enter for a new line
              </p>
            </form>
          </section>
        )}

        <div className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-3">
          {[
            ["01", "Crawl", "Discover and extract website pages"],
            ["02", "Index", "Chunk content and generate embeddings"],
            ["03", "Ask", "Retrieve relevant content for answers"],
          ].map(([number, title, description]) => (
            <div
              key={number}
              className="rounded-xl border border-white/10 bg-white/[0.025] p-4"
            >
              <p className="text-xs text-cyan-300">{number}</p>
              <h2 className="mt-3 font-medium">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
