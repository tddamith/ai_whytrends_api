export interface NewsItem {
  title: string;
  url: string;
  source: string;
  picture?: string;
}

export interface Trend {
  title: string;
  approxTraffic: number;
  publishedAt: Date;
  newsItems: NewsItem[];
}

export interface SourceDoc {
  url: string;
  source: string;
  title: string;
  text: string;
}

export type ArticleStatus = "review" | "published" | "rejected";
