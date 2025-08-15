#!/usr/bin/env python3
"""
LlamaIndex CSV Search Script
Processes output.csv file and creates a searchable vector index for AI queries
"""
import os
import sys
import pandas as pd
import json
from llama_index.core import Document, VectorStoreIndex
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI
from llama_index.core.settings import Settings

def setup_llama_index():
    """Set up LlamaIndex settings with OpenAI models"""
    # Get OpenAI API key from environment
    openai_key = os.getenv('OPENAI_API_KEY')
    if not openai_key:
        raise ValueError("OPENAI_API_KEY environment variable is required")
    
    # Configure LlamaIndex to use OpenAI
    Settings.llm = OpenAI(model="gpt-4", api_key=openai_key)
    Settings.embed_model = OpenAIEmbedding(model="text-embedding-ada-002", api_key=openai_key)

def load_csv_data(csv_path):
    """Load CSV data and convert to LlamaIndex Documents"""
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"CSV file not found: {csv_path}")
    
    # Read CSV file
    df = pd.read_csv(csv_path)
    documents = []
    
    for index, row in df.iterrows():
        # Combine relevant fields for search
        # Use both English and Chinese content for comprehensive search
        title = row.get('title_cn', '') or row.get('title_en', '')
        content_cn = row.get('content_cn', '')
        content_en = row.get('content_en', '')
        summary_cn = row.get('summary_cn', '')
        summary_en = row.get('summary_en', '')
        tags_cn = row.get('tags_cn', '')
        tags_en = row.get('tags_en', '')
        source = row.get('source', '')
        date = row.get('date', '')
        url = row.get('url', '')
        
        # Create comprehensive text for search
        search_text = f"標題: {title}\n"
        if content_cn:
            search_text += f"內容: {content_cn}\n"
        if content_en:
            search_text += f"English Content: {content_en}\n"
        if summary_cn:
            search_text += f"摘要: {summary_cn}\n"
        if summary_en:
            search_text += f"Summary: {summary_en}\n"
        if tags_cn:
            search_text += f"標籤: {tags_cn}\n"
        if tags_en:
            search_text += f"Tags: {tags_en}\n"
        if source:
            search_text += f"來源: {source}\n"
        if date:
            search_text += f"日期: {date}\n"
        if url:
            search_text += f"連結: {url}\n"
        
        # Create document with metadata
        metadata = {
            'id': row.get('id', index),
            'title_cn': title,
            'source': source,
            'date': date,
            'url': url,
            'row_index': index
        }
        
        doc = Document(text=search_text, metadata=metadata)
        documents.append(doc)
    
    return documents

def create_search_index(documents):
    """Create vector search index from documents"""
    index = VectorStoreIndex.from_documents(documents)
    return index

def search_csv(query, csv_path='data/output.csv', top_k=3):
    """Search CSV data using natural language query"""
    try:
        # Set up LlamaIndex
        setup_llama_index()
        
        # Load and process CSV data
        documents = load_csv_data(csv_path)
        
        # Create search index
        index = create_search_index(documents)
        
        # Create query engine
        query_engine = index.as_query_engine(
            similarity_top_k=top_k,
            response_mode="tree_summarize"
        )
        
        # Perform search
        response = query_engine.query(query)
        
        # Extract source documents for additional context
        source_nodes = response.source_nodes
        results = []
        
        for node in source_nodes:
            metadata = node.node.metadata
            results.append({
                'score': node.score,
                'title': metadata.get('title_cn', ''),
                'source': metadata.get('source', ''),
                'date': metadata.get('date', ''),
                'url': metadata.get('url', ''),
                'content': node.node.text[:500] + '...' if len(node.node.text) > 500 else node.node.text
            })
        
        return {
            'answer': str(response),
            'sources': results,
            'query': query
        }
        
    except Exception as e:
        return {
            'error': str(e),
            'query': query
        }

def main():
    """Main function for command line usage"""
    if len(sys.argv) < 2:
        print("Usage: python csv_search.py 'your search query here'")
        sys.exit(1)
    
    query = sys.argv[1]
    result = search_csv(query)
    
    # Output as JSON for easy parsing in Node.js
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()