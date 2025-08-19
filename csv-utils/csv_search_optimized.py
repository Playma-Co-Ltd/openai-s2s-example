#!/usr/bin/env python3
"""
優化版 CSV 搜尋系統 - 支援多層搜尋工具
提供快速標題/摘要搜尋和詳細內容搜尋
"""
import os
import sys
import pandas as pd
import json
import pickle
from pathlib import Path
try:
    from llama_index.core import Document, VectorStoreIndex
    from llama_index.embeddings.openai import OpenAIEmbedding
    from llama_index.llms.openai import OpenAI
    from llama_index.core.settings import Settings
    HAS_LLAMA = True
except Exception:
    Document = VectorStoreIndex = OpenAIEmbedding = OpenAI = Settings = None
    HAS_LLAMA = False

def setup_llama_index():
    """設置 LlamaIndex 使用更快的模型"""
    openai_key = os.getenv('OPENAI_API_KEY')
    if not openai_key:
        raise ValueError("OPENAI_API_KEY environment variable is required")
    
    # 使用更快的模型
    if not HAS_LLAMA:
        raise RuntimeError('llama-index not installed. Please install: pip install llama-index openai')
    Settings.llm = OpenAI(model="gpt-4o-mini", api_key=openai_key)
    Settings.embed_model = OpenAIEmbedding(
        model="text-embedding-3-small",  # 更快的嵌入模型
        api_key=openai_key
    )

def load_csv_data():
    """載入 CSV 資料"""
    csv_path = 'data/output.csv'
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"CSV file not found: {csv_path}")
    
    return pd.read_csv(csv_path)

# ===== 快速搜尋工具 (無需向量化) =====

def search_titles_fast(query, max_results=5):
    """快速搜尋標題 - 使用字符串匹配，超快速"""
    try:
        df = load_csv_data()
        query_lower = query.lower()
        
        # 搜尋中文和英文標題
        title_matches = df[
            (df['title_cn'].fillna('').str.lower().str.contains(query_lower, regex=False)) |
            (df['title_en'].fillna('').str.lower().str.contains(query_lower, regex=False))
        ].head(max_results)
        
        results = []
        for _, row in title_matches.iterrows():
            results.append({
                'id': row.get('id', ''),
                'title_cn': row.get('title_cn', ''),
                'title_en': row.get('title_en', ''),
                'source': row.get('source', ''),
                'date': row.get('date', ''),
                'url': row.get('url', ''),
                'tags_cn': row.get('tags_cn', ''),
                'match_type': 'title'
            })
        
        return {
            'results': results,
            'total': len(results),
            'search_type': 'fast_title',
            'query': query
        }
        
    except Exception as e:
        return {'error': str(e), 'query': query}

def search_summaries_fast(query, max_results=5):
    """快速搜尋摘要 - 使用字符串匹配"""
    try:
        df = load_csv_data()
        query_lower = query.lower()
        
        # 搜尋中文和英文摘要
        summary_matches = df[
            (df['summary_cn'].fillna('').str.lower().str.contains(query_lower, regex=False)) |
            (df['summary_en'].fillna('').str.lower().str.contains(query_lower, regex=False))
        ].head(max_results)
        
        results = []
        for _, row in summary_matches.iterrows():
            summary_cn = row.get('summary_cn', '')
            summary_en = row.get('summary_en', '')
            
            results.append({
                'id': row.get('id', ''),
                'title_cn': row.get('title_cn', ''),
                'title_en': row.get('title_en', ''),
                'summary_cn': summary_cn[:300] + '...' if len(summary_cn) > 300 else summary_cn,
                'summary_en': summary_en[:300] + '...' if len(summary_en) > 300 else summary_en,
                'source': row.get('source', ''),
                'date': row.get('date', ''),
                'url': row.get('url', ''),
                'tags_cn': row.get('tags_cn', ''),
                'match_type': 'summary'
            })
        
        return {
            'results': results,
            'total': len(results),
            'search_type': 'fast_summary',
            'query': query
        }
        
    except Exception as e:
        return {'error': str(e), 'query': query}

def search_tags_fast(query, max_results=10):
    """快速搜尋標籤"""
    try:
        df = load_csv_data()
        query_lower = query.lower()
        
        # 搜尋中文和英文標籤
        tag_matches = df[
            (df['tags_cn'].fillna('').str.lower().str.contains(query_lower, regex=False)) |
            (df['tags_en'].fillna('').str.lower().str.contains(query_lower, regex=False))
        ].head(max_results)
        
        results = []
        for _, row in tag_matches.iterrows():
            results.append({
                'id': row.get('id', ''),
                'title_cn': row.get('title_cn', ''),
                'title_en': row.get('title_en', ''),
                'source': row.get('source', ''),
                'date': row.get('date', ''),
                'url': row.get('url', ''),
                'tags_cn': row.get('tags_cn', ''),
                'tags_en': row.get('tags_en', ''),
                'match_type': 'tags'
            })
        
        return {
            'results': results,
            'total': len(results),
            'search_type': 'fast_tags',
            'query': query
        }
        
    except Exception as e:
        return {'error': str(e), 'query': query}

# ===== 詳細內容搜尋 (使用向量化，較慢但準確) =====

def get_content_index_path():
    """獲取內容索引緩存路徑"""
    return 'data/content_index_cache.pkl'

def create_content_documents(max_content_chars=300):
    """創建內容文檔用於向量搜尋，限制內容長度以提升性能"""
    df = load_csv_data()
    documents = []
    
    for index, row in df.iterrows():
        # 限制內容長度以提升搜尋速度
        content_cn = row.get('content_cn', '')
        content_en = row.get('content_en', '')
        title_cn = row.get('title_cn', '')
        title_en = row.get('title_en', '')
        summary_cn = row.get('summary_cn', '')
        summary_en = row.get('summary_en', '')
        
        # 優先使用摘要，再使用有限的內容
        full_text = f"標題: {title_cn}\nTitle: {title_en}\n"
        
        # 添加摘要（通常比完整內容更相關）
        if summary_cn:
            full_text += f"摘要: {summary_cn}\n"
        if summary_en:
            full_text += f"Summary: {summary_en}\n"
        
        # 添加限制長度的內容
        if content_cn:
            limited_content_cn = content_cn[:max_content_chars]
            if len(content_cn) > max_content_chars:
                limited_content_cn += '...'
            full_text += f"內容: {limited_content_cn}\n"
            
        if content_en:
            limited_content_en = content_en[:max_content_chars]
            if len(content_en) > max_content_chars:
                limited_content_en += '...'
            full_text += f"Content: {limited_content_en}\n"
        
        metadata = {
            'id': row.get('id', index),
            'title_cn': title_cn,
            'title_en': title_en,
            'source': row.get('source', ''),
            'date': row.get('date', ''),
            'url': row.get('url', ''),
            'summary_cn': summary_cn,
            'summary_en': summary_en,
            'row_index': index
        }
        
        doc = Document(text=full_text, metadata=metadata)
        documents.append(doc)
    
    return documents

def load_or_create_content_index(max_content_chars=300):
    """載入或創建內容索引"""
    csv_path = 'data/output.csv'
    index_path = get_content_index_path()
    
    # 檢查是否需要重建索引
    rebuild_index = True
    if os.path.exists(index_path) and os.path.exists(csv_path):
        csv_mtime = os.path.getmtime(csv_path)
        index_mtime = os.path.getmtime(index_path)
        if index_mtime > csv_mtime:
            rebuild_index = False
    
    if not rebuild_index:
        # 載入現有索引
        try:
            with open(index_path, 'rb') as f:
                return pickle.load(f)
        except:
            rebuild_index = True
    
    if rebuild_index:
        # 重建索引 - 不輸出到 stderr 避免干擾 JSON
        # print(f"正在建立內容索引（限制 {max_content_chars} 字符）...", file=sys.stderr)
        documents = create_content_documents(max_content_chars)
        index = VectorStoreIndex.from_documents(documents)
        
        # 保存索引
        os.makedirs(os.path.dirname(index_path), exist_ok=True)
        with open(index_path, 'wb') as f:
            pickle.dump(index, f)
        # print("索引建立完成", file=sys.stderr)
        
        return index

def search_content_detailed(query, max_results=3, max_content_chars=300):
    """詳細內容搜尋 - 使用向量搜尋，可配置內容長度"""
    try:
        if not HAS_LLAMA:
            return {'error': 'llama-index 未安裝。請先安裝: pip install llama-index openai', 'query': query}
        setup_llama_index()
        
        # 載入索引
        index = load_or_create_content_index(max_content_chars)
        
        # 創建查詢引擎 - 使用更簡單的模式提升速度
        query_engine = index.as_query_engine(
            similarity_top_k=max_results,
            response_mode="compact"  # 改用更快的模式
        )
        
        # 執行搜尋
        response = query_engine.query(query)
        
        # 提取結果
        source_nodes = response.source_nodes
        results = []
        
        for node in source_nodes:
            metadata = node.node.metadata
            # 限制回傳的內容片段長度
            content_snippet = node.node.text[:max_content_chars] + '...' if len(node.node.text) > max_content_chars else node.node.text
            
            results.append({
                'id': metadata.get('id', ''),
                'title_cn': metadata.get('title_cn', ''),
                'title_en': metadata.get('title_en', ''),
                'source': metadata.get('source', ''),
                'date': metadata.get('date', ''),
                'url': metadata.get('url', ''),
                'summary_cn': metadata.get('summary_cn', ''),
                'summary_en': metadata.get('summary_en', ''),
                'content_snippet': content_snippet,
                'relevance_score': float(node.score) if hasattr(node, 'score') else 0.0,
                'match_type': 'content'
            })
        
        return {
            'answer': str(response),
            'results': results,
            'total': len(results),
            'search_type': 'detailed_content',
            'content_limit': max_content_chars,
            'query': query
        }
        
    except Exception as e:
        return {'error': str(e), 'query': query}

# ===== 主要函數 =====

def main():
    """命令行界面"""
    if len(sys.argv) < 3:
        print("Usage: python csv_search_optimized.py <search_type> 'query' [max_content_chars]")
        print("Search types: title, summary, tags, content")
        print("max_content_chars: for content search only (default: 100)")
        sys.exit(1)
    
    search_type = sys.argv[1]
    query = sys.argv[2]
    max_content_chars = int(sys.argv[3]) if len(sys.argv) > 3 else 100  # 預設100字
    
    if search_type == 'title':
        result = search_titles_fast(query)
    elif search_type == 'summary':
        result = search_summaries_fast(query)
    elif search_type == 'tags':
        result = search_tags_fast(query)
    elif search_type == 'content':
        result = search_content_detailed(query, max_content_chars=max_content_chars)
    else:
        result = {'error': f'Unknown search type: {search_type}'}
    
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main() 