export interface Citation {
  id: string;
  title: string;
  sourceUrl: string;
  sourceTitle: string;
  sourceType: string;
  pageNumber?: number;
  chunkId?: string;
  author?: string;
  lastModified?: string;
  department?: string;
  documentType?: string;
  documentVersion?: string;
  sectionTitle?: string;
}

export interface SearchResultWithCitation {
  content: string;
  citation: Citation;
  score: number;
  semanticScore?: number;
  captions?: string[];
}

export type SearchType = "text" | "semantic" | "hybrid";

export interface SearchOptions {
  top?: number;
  filter?: string;
  searchType?: SearchType;
}

export interface SearchDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  source_url: string;
  source_title: string;
  source_type: string;
  page_number?: number;
  chunk_id?: string;
  author?: string;
  last_modified?: string;
  department?: string;
  document_type?: string;
  document_version?: string;
  effective_date?: string;
  section_title?: string;
}
