# 🧠 SiteMind AI — Website Intelligence & Support Agent

**Turn any website into a searchable AI knowledge base.**

SiteMind AI is an AI-powered website support agent that crawls websites, indexes their content in a vector database, and answers questions using Retrieval-Augmented Generation (RAG).

Built with **React, Node.js, Express, BullMQ, Valkey, Puppeteer, Google Gemini, and Qdrant**, it combines asynchronous website crawling with semantic retrieval to generate answers grounded in website content.

## ✨ Features

- 🌐 **Website Crawling:** Crawl websites and discover internal links.
- ⚛️ **JavaScript Rendering:** Extract content from React and other JavaScript-rendered websites using Puppeteer.
- ⚙️ **Background Jobs:** Process long-running crawls asynchronously using BullMQ and Valkey.
- 🔄 **Retry Mechanism:** Configure job retries with exponential backoff.
- 📍 **Crawl Checkpointing:** Save page-level progress to help avoid repeating completed work after retries.
- ✂️ **Text Chunking:** Split webpage content into smaller, retrieval-friendly chunks.
- 🧠 **Vector Embeddings:** Generate embeddings using Google's `gemini-embedding-2` model.
- 🗄️ **Vector Database:** Store embeddings, text, and metadata in Qdrant.
- 🔍 **Semantic Search:** Retrieve relevant content using vector similarity and website-specific filtering.
- 💬 **AI-Powered Answers:** Generate answers using retrieved website content as context.
- 🔗 **Source References:** Return source URLs alongside generated answers.
- 📊 **Job Tracking:** Expose crawl status, progress, and results through API endpoints.
- 🛡️ **URL Safety:** Validate website URLs and restrict access to unsafe network destinations.
- ⚠️ **Partial Success Handling:** Preserve useful crawl results when some pages fail.
- 🧪 **Automated Testing:** Test API routes and core services with Vitest and Supertest.

## 🏗️ System Architecture

The application separates website ingestion from question answering. Crawling runs in a background worker, while the API handles incoming requests and chat queries.

![SiteMind AI System Architecture](https://github.com/AmannRawat/SiteMind-AI/blob/main/Architecture.png?raw=true)

### Website ingestion pipeline

**Website URL → Express API → BullMQ → Valkey → Background Worker → Puppeteer → Text Chunking → Gemini Embeddings → Qdrant Cloud**

The crawler validates URLs, extracts rendered content, follows eligible same-origin links, generates embeddings, and stores indexed content. Page checkpoints help the crawler resume work after interruptions.

### Question-answering pipeline

**User Question → Express Chat API → Query Embedding → Qdrant Similarity Search → Retrieved Context → Gemini Flash → Answer + Source URLs**

The system retrieves relevant website content before generating an answer. The model is instructed to acknowledge insufficient evidence instead of inventing website facts.

## 🛠️ Tech Stack

| Category | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Node.js, Express |
| Language | JavaScript, ES Modules |
| Background Jobs | BullMQ |
| Queue Backend | Valkey |
| Web Scraping | Puppeteer |
| AI / LLM | Google Gemini |
| Embedding Model | `gemini-embedding-2` |
| Vector Database | Qdrant Cloud |
| Testing | Vitest, Supertest |
| Infrastructure | Docker, Docker Compose, Render, Vercel |

## ⚙️ How It Works

### 1. Submit a website

The user submits a website URL through the React frontend. The Express API validates the request and adds a crawl job to the queue.

### 2. Process the crawl asynchronously

BullMQ manages crawl jobs using Valkey as its Redis-compatible backend. A separate worker consumes jobs, reports progress, and processes the crawl independently of the initial HTTP request.

### 3. Crawl and extract website content

Puppeteer renders JavaScript-heavy pages and extracts page content and internal links. The crawler normalizes URLs, tracks visited pages, enforces crawl limits, and applies URL safety checks.

### 4. Chunk the extracted text

The extracted content is split into smaller chunks to make retrieval more focused and reduce the amount of text passed to the language model.

### 5. Generate embeddings

The `gemini-embedding-2` model converts text chunks into vector representations. The same embedding service is used to represent incoming user questions.

### 6. Store the knowledge base

Qdrant Cloud stores the vectors, original text, and associated metadata, including source URLs and website origin. Deterministic IDs and upserts help make repeated indexing safer.

### 7. Save crawl checkpoints

The crawler records completed-page information and discovered internal links. During a retry, valid checkpoints allow previously completed pages to be skipped.

### 8. Retrieve relevant information

The user's question is embedded and used to search Qdrant for relevant chunks associated with the selected website.

### 9. Generate grounded answers

Gemini receives the question and retrieved context. The prompt instructs the model to use the supplied evidence, identify insufficient information, and treat retrieved website content as untrusted data.

### 10. Return answers and sources

The API returns the generated answer and source URLs. The React frontend displays the response so users can trace answers back to indexed pages.

## 📁 Project Structure

```text
RAG-WebSupport-Agent/
├── client/
│   └── src/
│       └── App.jsx
├── server/
│   ├── src/
│   │   ├── config/
│   │   │   ├── qdrant.js
│   │   │   ├── gemini.js
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
│   │   ├── app.test.js
│   │   └── ...
│   ├── package.json
│   └── .env.example
├── docker-compose.yml
├── Architecture.png
└── README.md
```

*This is a simplified overview. Some test files and configuration files are omitted.*

## 🚀 Getting Started

### Prerequisites

- Node.js and npm
- Docker Desktop with Docker Compose
- A Google Gemini API key
- A Qdrant Cloud cluster and API key

### 1. Clone the repository

```bash
git clone https://github.com/AmannRawat/RAG-WebSupport-Agent.git
cd RAG-WebSupport-Agent
```

### 2. Start Valkey

From the project root:

```bash
docker compose up -d valkey
```

The current Docker Compose configuration starts Valkey locally. Qdrant is hosted on Qdrant Cloud and does not need a local Docker container.

The current local development configuration uses:

| Service | Host port |
|---|---:|
| Valkey | `6380` |
| Express API | `4000` |
| Docker frontend | `5174` |
| Vite development server | `5173` by default |
| Qdrant | Qdrant Cloud HTTPS endpoint |

Check `docker-compose.yml` if your local port mappings differ.

### 3. Install backend dependencies

```bash
cd server
npm install
```

Create `server/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key

QDRANT_URL=https://your-qdrant-cluster-url
QDRANT_API_KEY=your_qdrant_api_key
QDRANT_COLLECTION=SiteMind-AI
QDRANT_VECTOR_SIZE=3072

VALKEY_URL=redis://127.0.0.1:6380
PORT=4000
```

Use your actual Qdrant Cloud endpoint and API key in your local `.env`. Never commit secrets to GitHub.

### 4. Start the Express API

From the `server` directory:

```bash
npm run dev:api
```

The API runs on port `4000` by default.

### 5. Start the background worker

Open a second terminal in the `server` directory:

```bash
npm run dev:worker
```

The worker connects to Valkey and begins processing queued crawl jobs.

### 6. Install and start the frontend

Open a third terminal from the project root:

```bash
cd client
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

If necessary, configure `VITE_API_URL` to point to the Express API:

```env
VITE_API_URL=http://localhost:4000
```

**Local development note:** The commands above run the API, worker, and frontend locally, while Valkey runs in Docker and Qdrant remains hosted on Qdrant Cloud. This avoids relying on stale application container images.

## 🔌 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Check API health |
| `POST` | `/api/crawls` | Validate and enqueue a crawl job |
| `GET` | `/api/crawls/:jobId` | Retrieve crawl status and results |
| `POST` | `/api/chat` | Ask a question about indexed website content |

### Submit a crawl

**Request**

```http
POST /api/crawls
Content-Type: application/json
```

```json
{
  "url": "https://example.com"
}
```

A successfully queued job returns HTTP `202 Accepted` with a job ID that can be used to track progress.

### Check crawl status

```http
GET /api/crawls/YOUR_JOB_ID
```

The response includes job status, progress, crawl results when available, and failure information when applicable.

### Ask a question

**Request**

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

The website must have indexed content. The response includes the generated answer and source URLs.

## 🧪 Testing

Run the backend test suite from the `server` directory:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

The test suite covers API routes, request validation, embedding generation, vector storage, crawl-job processing, and crawler checkpoint behavior.

External dependencies are mocked in unit tests, allowing the tests to run without live Gemini, Qdrant, or Valkey connections.

The current suite contains **41 passing tests**.

## 🧠 Engineering Decisions

### Asynchronous processing

Website crawling and embedding generation can take considerably longer than a normal HTTP request. A background worker allows the API to enqueue work and respond without waiting for the entire crawl to finish.

### Retry and recovery

BullMQ supports configurable retries and exponential backoff. Page-level checkpoints reduce repeated work when a job resumes.

### Safer repeated writes

Deterministic vector IDs and Qdrant upserts help prevent duplicate records when chunks are indexed again. This does not make the entire crawl transactional.

### Website-scoped retrieval

Queries filter retrieved chunks by website origin, helping keep answers relevant to the selected website.

### Grounded generation

The answer-generation prompt instructs Gemini to rely on retrieved context, acknowledge insufficient evidence, and avoid following instructions embedded in untrusted website content.

### URL security

The application validates HTTP/HTTPS URLs and checks destinations to reduce SSRF risks. Production deployment should additionally enforce network-level egress restrictions and address DNS rebinding risks.

### Automated testing

Vitest and Supertest provide repeatable tests for API behavior and core services without requiring real external API calls for every test.

## 🧩 Challenges Solved

- **JavaScript-rendered websites:** Used Puppeteer to extract rendered content.
- **Long webpage content:** Implemented chunking before embedding generation.
- **Repeated crawling:** Added URL normalization, visited-page tracking, checkpoints, and incremental page-state caching.
- **Long-running tasks:** Separated crawl processing from the HTTP request lifecycle.
- **Transient failures:** Configured job retries with exponential backoff.
- **Relevant AI responses:** Implemented embedding-based retrieval before answer generation.
- **Partial crawl failures:** Tracked crawl outcomes instead of treating every incomplete crawl as total failure.
- **External-service testing:** Mocked dependencies to test error handling and core logic in isolation.

## ⚠️ Current Limitations

- Crawling is restricted to the starting website's origin.
- Some pages may be inaccessible or fail during rendering and extraction.
- Answer quality depends on the completeness of the indexed content and retrieval relevance.
- Checkpointing helps recovery but does not guarantee exactly-once processing.
- Production use requires additional deployment hardening, authentication and authorization where appropriate, network isolation, and operational monitoring.

## 👨‍💻 Author

**Aman Rawat**

- GitHub: [AmannRawat](https://github.com/AmannRawat)
- LinkedIn: [amanrwtt](https://www.linkedin.com/in/amanrwtt)

---

*SiteMind AI — turning website content into searchable knowledge.*
