#!/usr/bin/env python3
"""
超級優化版 CSV 搜尋系統 - 多種性能提升策略
"""
import os
import sys
import pandas as pd
import json
import pickle
import time
from pathlib import Path
from llama_index.core import Document, VectorStoreIndex
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI
from llama_index.core.settings import Settings

# 全局緩存變數
_df_cache = None
_df_cache_time = 0
_index_cache = None

def setup_llama_index():
    """設置 LlamaIndex 使用最快的模型"""
    openai_key = os.getenv('OPENAI_API_KEY')
    if not openai_key:
        raise ValueError("OPENAI_API_KEY environment variable is required")
    
    # 使用最快的模型組合
    Settings.llm = OpenAI(model="gpt-4o-mini", api_key=openai_key, temperature=0)
    Settings.embed_model = OpenAIEmbedding(
        model="text-embedding-3-small",
        api_key=openai_key
    )

def load_csv_data_cached():
    """載入 CSV 資料 - 帶記憶體快取"""
    global _df_cache, _df_cache_time
    
    csv_path = 'data/output.csv'
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"CSV file not found: {csv_path}")
    
    current_mtime = os.path.getmtime(csv_path)
    
    # 檢查快取是否有效
    if _df_cache is not None and _df_cache_time >= current_mtime:
        return _df_cache
    
    # 重新載入資料 - 不輸出到 stderr 避免干擾 JSON
    # print("Loading CSV data...", file=sys.stderr)
    _df_cache = pd.read_csv(csv_path)
    _df_cache_time = current_mtime
    # print(f"Loaded {len(_df_cache)} records", file=sys.stderr)
    
    return _df_cache

# ===== 超快速搜尋工具 (使用記憶體快取) =====

def search_titles_ultra_fast(query, max_results=5):
    """超快速標題搜尋 - 使用向量化 pandas 操作，支援多關鍵字"""
    try:
        df = load_csv_data_cached()
        
        # 分割查詢為多個關鍵字（支援空格分隔）
        keywords = query.lower().split()
        
        # 初始化為全False的mask
        title_mask = pd.Series([False] * len(df))
        
        # 對每個關鍵字進行搜尋（OR邏輯）
        for keyword in keywords:
            keyword_mask = (
                df['title_cn'].fillna('').str.lower().str.contains(keyword, regex=False) |
                df['title_en'].fillna('').str.lower().str.contains(keyword, regex=False)
            )
            title_mask = title_mask | keyword_mask
        
        matches = df[title_mask].head(max_results)
        
        # 快速轉換為結果格式
        results = []
        for _, row in matches.iterrows():
            results.append({
                'id': int(row['id']) if pd.notna(row['id']) else 0,
                'title_cn': str(row.get('title_cn', '')),
                'title_en': str(row.get('title_en', '')),
                'source': str(row.get('source', '')),
                'date': str(row.get('date', '')),
                'url': str(row.get('url', '')),
                'tags_cn': str(row.get('tags_cn', '')),
                'match_type': 'title'
            })
        
        return {
            'results': results,
            'total': len(results),
            'search_type': 'ultra_fast_title',
            'query': query
        }
        
    except Exception as e:
        return {'error': str(e), 'query': query}

def search_summaries_ultra_fast(query, max_results=5):
    """超快速摘要搜尋 - 支援多關鍵字"""
    try:
        df = load_csv_data_cached()
        
        # 分割查詢為多個關鍵字
        keywords = query.lower().split()
        
        # 初始化為全False的mask
        summary_mask = pd.Series([False] * len(df))
        
        # 對每個關鍵字進行搜尋（OR邏輯）
        for keyword in keywords:
            keyword_mask = (
                df['summary_cn'].fillna('').str.lower().str.contains(keyword, regex=False) |
                df['summary_en'].fillna('').str.lower().str.contains(keyword, regex=False)
            )
            summary_mask = summary_mask | keyword_mask
        
        matches = df[summary_mask].head(max_results)
        
        results = []
        for _, row in matches.iterrows():
            summary_cn = str(row.get('summary_cn', ''))
            summary_en = str(row.get('summary_en', ''))
            
            results.append({
                'id': int(row['id']) if pd.notna(row['id']) else 0,
                'title_cn': str(row.get('title_cn', '')),
                'title_en': str(row.get('title_en', '')),
                'summary_cn': summary_cn[:200] + '...' if len(summary_cn) > 200 else summary_cn,
                'summary_en': summary_en[:200] + '...' if len(summary_en) > 200 else summary_en,
                'source': str(row.get('source', '')),
                'date': str(row.get('date', '')),
                'url': str(row.get('url', '')),
                'tags_cn': str(row.get('tags_cn', '')),
                'match_type': 'summary'
            })
        
        return {
            'results': results,
            'total': len(results),
            'search_type': 'ultra_fast_summary',
            'query': query
        }
        
    except Exception as e:
        return {'error': str(e), 'query': query}

def search_tags_ultra_fast(query, max_results=10):
    """超快速標籤搜尋 - 支援多關鍵字"""
    try:
        df = load_csv_data_cached()
        
        # 分割查詢為多個關鍵字
        keywords = query.lower().split()
        
        # 初始化為全False的mask
        tag_mask = pd.Series([False] * len(df))
        
        # 對每個關鍵字進行搜尋（OR邏輯）
        for keyword in keywords:
            keyword_mask = (
                df['tags_cn'].fillna('').str.lower().str.contains(keyword, regex=False) |
                df['tags_en'].fillna('').str.lower().str.contains(keyword, regex=False)
            )
            tag_mask = tag_mask | keyword_mask
        
        matches = df[tag_mask].head(max_results)
        
        results = []
        for _, row in matches.iterrows():
            results.append({
                'id': int(row['id']) if pd.notna(row['id']) else 0,
                'title_cn': str(row.get('title_cn', '')),
                'title_en': str(row.get('title_en', '')),
                'source': str(row.get('source', '')),
                'date': str(row.get('date', '')),
                'url': str(row.get('url', '')),
                'tags_cn': str(row.get('tags_cn', '')),
                'tags_en': str(row.get('tags_en', '')),
                'match_type': 'tags'
            })
        
        return {
            'results': results,
            'total': len(results),
            'search_type': 'ultra_fast_tags',
            'query': query
        }
        
    except Exception as e:
        return {'error': str(e), 'query': query}

# ===== 智能混合搜尋 =====

def search_smart_hybrid(query, max_results=5):
    """智能混合搜尋 - 組合快速搜尋結果，支援多關鍵字"""
    try:
        # 如果查詢包含「語音辨識」這種複合詞，將其拆分
        if '辨識' in query and '語音' not in query:
            query = query.replace('辨識', '辨識 識別 recognition')
        if '語音' in query and '辨識' in query:
            query = query.replace('語音辨識', '語音 辨識 speech voice recognition')
        
        # 並行搜尋多個欄位
        title_results = search_titles_ultra_fast(query, 3)
        summary_results = search_summaries_ultra_fast(query, 3)
        tag_results = search_tags_ultra_fast(query, 2)
        
        # 去重和合併結果
        seen_ids = set()
        combined_results = []
        
        # 按優先級合併：標題 > 摘要 > 標籤
        for result_set in [title_results, summary_results, tag_results]:
            if 'results' in result_set:
                for item in result_set['results']:
                    if item['id'] not in seen_ids and len(combined_results) < max_results:
                        seen_ids.add(item['id'])
                        combined_results.append(item)
        
        return {
            'results': combined_results,
            'total': len(combined_results),
            'search_type': 'smart_hybrid',
            'query': query,
            'sources': ['titles', 'summaries', 'tags']
        }
        
    except Exception as e:
        return {'error': str(e), 'query': query}

# ===== 優化的向量搜尋 =====

def create_mini_documents(max_chars=100):
    """創建極簡文檔用於向量搜尋"""
    df = load_csv_data_cached()
    documents = []
    
    for index, row in df.iterrows():
        # 只使用標題和極短摘要
        title_cn = str(row.get('title_cn', ''))
        title_en = str(row.get('title_en', ''))
        summary_cn = str(row.get('summary_cn', ''))[:max_chars]
        
        # 極簡文本
        text = f"{title_cn} {title_en} {summary_cn}"[:max_chars * 2]
        
        metadata = {
            'id': int(row['id']) if pd.notna(row['id']) else index,
            'title_cn': title_cn,
            'title_en': title_en,
            'source': str(row.get('source', '')),
            'date': str(row.get('date', '')),
            'url': str(row.get('url', '')),
            'row_index': index
        }
        
        documents.append(Document(text=text, metadata=metadata))
    
    return documents

def search_content_mini(query, max_results=3, max_chars=100):
    """極簡內容搜尋 - 犧牲準確度換取速度"""
    global _index_cache
    
    try:
        setup_llama_index()
        
        # 使用全局快取的索引
        if _index_cache is None:
            # print(f"Building mini index (max {max_chars} chars)...", file=sys.stderr)
            documents = create_mini_documents(max_chars)
            _index_cache = VectorStoreIndex.from_documents(documents)
            # print("Mini index ready", file=sys.stderr)
        
        # 使用最簡單的查詢模式
        query_engine = _index_cache.as_query_engine(
            similarity_top_k=max_results,
            response_mode="no_text"  # 不生成總結，只返回相關文檔
        )
        
        # 執行搜尋
        response = query_engine.query(query)
        
        results = []
        for node in response.source_nodes:
            metadata = node.node.metadata
            results.append({
                'id': metadata.get('id', ''),
                'title_cn': metadata.get('title_cn', ''),
                'title_en': metadata.get('title_en', ''),
                'source': metadata.get('source', ''),
                'date': metadata.get('date', ''),
                'url': metadata.get('url', ''),
                'relevance_score': float(node.score) if hasattr(node, 'score') else 0.0,
                'match_type': 'mini_content'
            })
        
        return {
            'results': results,
            'total': len(results),
            'search_type': 'mini_content',
            'char_limit': max_chars,
            'query': query
        }
        
    except Exception as e:
        return {'error': str(e), 'query': query}

def main():
    """命令行界面"""
    if len(sys.argv) < 3:
        print("Usage: python csv_search_ultra_fast.py <search_type> 'query' [max_chars]")
        print("Search types: title, summary, tags, hybrid, mini")
        print("max_chars: for mini content search (default: 100)")
        sys.exit(1)
    
    search_type = sys.argv[1]
    query = sys.argv[2]
    max_chars = int(sys.argv[3]) if len(sys.argv) > 3 else 100
    
    start_time = time.time()
    
    if search_type == 'title':
        result = search_titles_ultra_fast(query)
    elif search_type == 'summary':
        result = search_summaries_ultra_fast(query)
    elif search_type == 'tags':
        result = search_tags_ultra_fast(query)
    elif search_type == 'hybrid':
        result = search_smart_hybrid(query)
    elif search_type == 'mini':
        result = search_content_mini(query, max_chars=max_chars)
    else:
        result = {'error': f'Unknown search type: {search_type}'}
    
    end_time = time.time()
    result['search_time_ms'] = round((end_time - start_time) * 1000)
    
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main() 