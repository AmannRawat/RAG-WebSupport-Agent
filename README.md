# 🤖 RAG Web Support Agent

An AI-powered website support agent that crawls websites, indexes their content into a vector database, and answers user questions using Retrieval-Augmented Generation (RAG).

Built with **React, Node.js, Express, BullMQ, Valkey, Puppeteer, Google Gemini, and ChromaDB**, the system separates website crawling into background jobs while keeping the API responsive.

## Demo

**Live Demo:** Coming soon

**Architecture Diagram:** [Architecture.png](./Architecture.png)

<!-- Replace this placeholder with a real demo GIF or screenshot once available. -->
<!-- ![RAG Web Support Agent Demo](./demo.gif) -->

## Features

- 🌐 **Website Crawling:** Extracts rendered content and internal links using Puppeteer.
- ⚛️ **JavaScript-Rendered Pages:** Handles React and other client-rendered websites.
- ⚙️ **Background Processing:** Uses BullMQ and Valkey to process crawl jobs asynchronously.
- 🔄 **Retries and Recovery:** Configurable job retries with exponential backoff.
- 📍 **Crawl Checkpointing:** Saves page-level checkpoints to avoid repeating completed work during retries.
- ✂️ **Text Chunking:** Splits webpage content into smaller pieces for retrieval.
- 🧠 **Vector Embeddings:** Generates embeddings using Google's `gemini-embedding-2` model.
- 🗄️ **Vector Storage:** Stores webpage chunks, embeddings, and metadata in ChromaDB.
- 🔍 **Semantic Retrieval:** Retrieves relevant content filtered by website origin.
- 💬 **AI-Powered Answers:** Uses Gemini to generate answers grounded in retrieved website content.
- 🔗 **Source References:** Returns source URLs alongside answers.
- 📊 **Crawl Progress:** Tracks job status and progress through the API.
- 🛡️ **URL Validation:** Restricts crawling to HTTP/HTTPS URLs and validates destinations against private-network access.
- ⚠️ **Partial Crawl Handling:** Preserves useful results when some pages fail.
- 🧪 **Automated Tests:** Uses Vitest and Supertest to test API routes and core services.

## Architecture

The application separates the frontend, API, background worker, queue, and retrieval pipeline.

```text
                   React Frontend
                         |
                         v
                    Express API
                    /         \
                   v           v
             BullMQ Queue    Chat Service
                   |              |
                   v              v
                 Valkey       Query Embedding
                                  |
                                  v
                              ChromaDB
                                  |
                                  v
                          Retrieved Context
                                  |
                                  v
                            Gemini LLM
                                  |
                                  v
                         Answer + Sources

Background Crawl Pipeline:

Express API
     |
     v
BullMQ Queue <----> Valkey
     |
     v
Background Worker
     |
     v
URL Validation
     |
     v
Puppeteer Scraping
     |
     v
Text Extraction and Chunking
     |
     v
Gemini Embeddings
     |
     v
ChromaDB + Crawl Checkpoints
```

### RAG Pipeline

**Indexing:** Website → URL validation → Scraping → Text extraction → Chunking → Embeddings → ChromaDB

**Question answering:** Question → Query embedding → Similarity search → Retrieved context → Gemini → Answer with source URLs

## Tech Stack

| Category | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Node.js, Express |
| Background Jobs | BullMQ |
| Queue / Cache Backend | Valkey |
| Web Scraping | Puppeteer |
| AI / LLM | Google Gemini |
| Embeddings | `gemini-embedding-2` |
| Vector Database | ChromaDB |
| Testing | Vitest, Supertest |
| Containers | Docker, Docker Compose |
| Language | JavaScript (ES Modules) |

## How It Works

### 1. Submit a website

The user submits a website URL through the frontend. The Express API validates the request and enqueues a crawl job instead of performing the entire crawl inside the HTTP request.

### 2. Process the crawl asynchronously

A BullMQ worker consumes queued jobs using Valkey as its Redis-compatible backend. Job status and progress can be queried through the API.

### 3. Scrape and extract content

Puppeteer loads webpages and extracts rendered text, page information, and internal links. The crawler restricts traversal to the starting website's origin and applies URL safety checks.

### 4. Chunk the content

Extracted text is divided into smaller chunks so relevant sections can be retrieved without sending an entire website to the language model.

### 5. Generate and store embeddings

The `gemini-embedding-2` model converts text chunks into vectors. The application stores vectors, original text, and metadata in ChromaDB.

### 6. Save crawl checkpoints

The crawler stores page-level checkpoint data, including indexed chunk counts and discovered internal links. When a job resumes, valid checkpoints allow previously completed pages to be skipped.

### 7. Retrieve relevant information

When a user asks a question, the application embeds the query and searches ChromaDB for relevant chunks associated with the requested website origin.

### 8. Generate a grounded answer

Gemini receives the question and retrieved content. The system instructs the model to avoid inventing website facts, acknowledge insufficient evidence, and treat retrieved content as untrusted data.

### 9. Return the answer and sources

The API returns the generated answer and source URLs, which the frontend displays to the user.

## Project Structure

```text
RAG-WebSupport-Agent/
├── client/
│   └── src/
│       └── App.jsx
├── server/
│   ├── src/
│   │   ├── config/
│   │   │   ├── chroma.js
│   │   │   └── queue.js
│   │   ├── security/
│   │   │   └── urlSafety.js
│   │   ├── services/
│   │   │   ├── answer.service.js
│   │   │   ├── chunking.service.js
│   │   │   ├── crawlCheckpoint.service.js
│   │   │   ├── crawlJobProcessor.js
│   │   │   ├── crawlQueue.service.js
│   │   │   ├── crawler.service.js
│   │   │   ├── embedding.service.js
│   │   │   ├── scraper.service.js
│   │   │   └── vectorStore.service.js
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── worker.js
│   │   └── ...
│   ├── package.json
│   └── .env.example
├── docker-compose.yml
├── Architecture.png
└── README.md
```

*The structure above highlights key files; test files and other project configuration files are omitted for readability.*

## Prerequisites

- Node.js and npm
- Docker Desktop with Docker Compose
- A Google Gemini API key

## Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/AmannRawat/RAG-WebSupport-Agent.git
cd RAG-WebSupport-Agent
```

### 2. Start the infrastructure

From the project root:

```bash
docker compose up -d chromadb valkey
```

This starts the ChromaDB and Valkey services defined in the Compose configuration. If your service names or Compose configuration differ, use the names defined in your local `docker-compose.yml`.

The current local development configuration uses host ports `8001` for ChromaDB and `6380` for Valkey.

### 3. Configure the backend

```bash
cd server
npm install
```

Create `server/.env` using the following configuration:

```env
GEMINI_API_KEY=your_gemini_api_key
CHROMA_HOST=127.0.0.1
CHROMA_PORT=8001
VALKEY_URL=redis://127.0.0.1:6380
PORT=4000
```

Keep API keys and other secrets out of Git. Use `.env.example` to document required variables without real credentials.

### 4. Start the API

In the `server` directory:

```bash
npm run dev:api
```

The API runs on port `4000` by default.

### 5. Start the background worker

Open a second terminal in the `server` directory:

```bash
npm run dev:worker
```

The worker connects to Valkey and processes queued crawl jobs.

### 6. Start the frontend

Open a third terminal:

```bash
cd client
npm install
npm run dev
```

Open the local URL printed by Vite, typically `http://localhost:5173`.

Ensure the frontend API URL points to your running backend. The application defaults to `http://localhost:4000`.

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Check API health |
| POST | `/api/crawls` | Validate and enqueue a website crawl |
| GET | `/api/crawls/:jobId` | Retrieve crawl status, progress, and results |
| POST | `/api/chat` | Ask a question about indexed website content |

### Example: Enqueue a crawl

```http
POST /api/crawls
Content-Type: application/json
```

```json
{
  "url": "https://example.com"
}
```

The API returns HTTP `202 Accepted` when the crawl job is successfully queued.

### Example: Ask a question

```http
POST /api/chat
Content-Type: application/json
```

```json
{
  "websiteUrl": "https://example.com",
  "question": "What does this website offer?"
}
```

The chat endpoint requires the website to have indexed content. The response includes an answer and source URLs.

## Testing

Run the automated backend tests from the `server` directory:

```bash
npm test
```

Run tests in watch mode during development:

```bash
npm run test:watch
```

The test suite covers API behavior, request validation, embedding generation, vector storage, crawl job processing, and crawler checkpoint behavior. External services are mocked in unit tests so these tests can run without live API calls.

The project has also been tested with live crawling and question answering against a running local infrastructure.

## Engineering Decisions

### Asynchronous job processing

Crawling, scraping, and embedding can take longer than a typical HTTP request. BullMQ allows the API to accept work quickly while a separate worker handles long-running jobs.

### Retry and recovery

BullMQ is configured for multiple attempts with exponential backoff. Page checkpoints help the crawler avoid repeating completed work during retries.

### Idempotent vector writes

Deterministic vector IDs and ChromaDB upserts help prevent duplicate records when the same chunks are indexed again.

### Website-scoped retrieval

Retrieved content is filtered by website origin so that answers are based on the selected website rather than unrelated indexed content.

### Grounded responses

The answer-generation prompt instructs Gemini to rely on retrieved content and acknowledge when evidence is insufficient.

### URL safety

The application validates HTTP/HTTPS URLs and checks destinations to reduce server-side request forgery (SSRF) risks. Production deployment should also enforce network-level egress restrictions and protect against DNS rebinding.

## Challenges Solved

- **JavaScript-rendered content:** Used Puppeteer to extract content rendered by React applications.
- **Long webpage content:** Implemented text chunking before generating embeddings.
- **Repeated crawl work:** Normalized URLs, tracked visited pages, and added page-level checkpoints.
- **Long-running requests:** Moved crawling to a BullMQ background worker.
- **Temporary failures:** Configured job retries and exponential backoff.
- **Relevant answers:** Used embedding-based retrieval before generating answers.
- **Unreliable page coverage:** Tracked crawl results and distinguished partial success from total failure.
- **Testing without external dependencies:** Mocked Gemini, ChromaDB, queue services, and crawler dependencies in automated tests.

## Current Limitations

- Crawling is restricted to the starting website's origin.
- Website coverage depends on page accessibility, JavaScript rendering, and the crawler's configured page and depth limits.
- Answer quality depends on the quality and completeness of indexed content.
- The current system is not a substitute for production-grade authentication, authorization, network isolation, and operational monitoring.

## Author

**Aman Rawat**

- GitHub: https://github.com/AmannRawat
- LinkedIn: https://www.linkedin.com/in/amanrwtt
