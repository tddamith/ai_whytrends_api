# WhyTrends API

Pipeline and read API for [WhyTrends.com](https://whytrends.com): every 30 minutes it reads Google Trends
"Trending now" for the US, gathers news coverage for each new trend, has Claude write an original
"why is this trending" explainer with cited sources, runs a quality gate, and publishes it or sends it
to the review queue. The site lives in `ai_whytrends_web` and reads from this API.

```
Google Trends RSS ─► Triage (Claude Haiku 5.5) ─► Gather 2-5 sources ─► Write (Claude Opus 5.5)
                                                                              │
          Readers ◄─ web (Next.js, CDN) ◄─ Publish ◄── passes ── Quality gate ┘
                                              ▲                       │ fails / sensitive / review mode
                                              └── approve ── Review queue (admin API)
```

## Quality gate

An article auto-publishes only when `PUBLISH_MODE=auto` **and** all checks pass:

- cites at least 2 sources, every key fact cites a real source, and at least half the facts are in 2+ sources
- body is 350 to 950 words, with a real "why it's trending" answer
- no run of 12+ consecutive words copied from any source
- the topic is not sensitive (deaths, crime, health, elections, minors, allegations); those always go to review

Everything else waits in the review queue. Start in `review` mode and switch to `auto` once the queue
looks consistently good. Images come only from Pexels (licensed, credited), never from news sites.

## Setup

```bash
npm ci
cp .env.example .env        # fill in DATABASE_URL, ANTHROPIC_API_KEY, ADMIN_TOKEN
npm run migrate
npm run pipeline            # one run
npm run dev                 # API on :8787
npm test                    # unit tests; set TEST_DATABASE_URL to also run the pipeline integration test
```

### Production

- **Database:** Postgres on Neon or Supabase (free tier is fine to start). Put the URL in `DATABASE_URL`.
- **Pipeline:** `.github/workflows/pipeline.yml` runs every 30 minutes. Add repo secrets `DATABASE_URL`,
  `ANTHROPIC_API_KEY`, optional `PEXELS_API_KEY` and `WEB_REVALIDATE_SECRET`; optional repo variables
  `PUBLISH_MODE`, `MAX_ARTICLES_PER_RUN`, `WEB_REVALIDATE_URL`.
- **API:** any Node 20+ host (Render, Railway, Fly.io or a small VPS): `npm ci && npm start`, behind Cloudflare.
  Responses carry `s-maxage` cache headers so the CDN absorbs read traffic.

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/articles?limit=20&offset=0&category=sports` | Published articles, newest first |
| GET | `/articles/:slug` | One published article |
| GET | `/trends?limit=20` | Trends seen in the last 24h, with the linked article if any |
| GET | `/admin/queue` | Review queue (Bearer `ADMIN_TOKEN`) |
| POST | `/admin/articles/:id/approve` | Publish, then revalidate the web page |
| POST | `/admin/articles/:id/reject` | Reject |
| PATCH | `/admin/articles/:id` | Edit `headline`, `dek`, `whyTrending`, `bodyMarkdown` |

Article JSON: `slug, trend, approxTraffic, headline, dek, whyTrending, bodyMarkdown, keyFacts[{fact, source_numbers}],
sources[{n, outlet, title, url}], tags, category, imageUrl, imageCredit, imageCreditUrl, publishedAt, updatedAt`.

## Cost

About 15k input and 2k output tokens per article on Claude Opus 5.5 ($4 / $20 per 1M tokens), so roughly
$0.10 per article, or about $180 a month at 60 articles a day. Triage on Claude Haiku 5.5 is under $5 a month.
A refused or truncated request simply skips that trend.

## Known limits

- Google Trends has no official API. The RSS feed can change or rate-limit; the run fails cleanly and retries next time.
- Google News search links are redirect pages that often can't be read server-side, so most sources come from the
  direct links in the Trends feed. Trends with fewer than 2 readable sources are retried on later runs.
