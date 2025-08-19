#!/usr/bin/env python3
"""
使用預建向量索引的超快速搜尋
只需要計算查詢的 embedding，不需要重新計算所有文檔
"""
import os
import sys
import json
import pickle
import time
from llama_index.core import StorageContext, load_index_from_storage
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI
from llama_index.core.settings import Settings
from dotenv import load_dotenv

# 載入 .env 檔案
load_dotenv()

# 全局快取索引
_cached_index = None
_index_load_time = 0

def setup_llama_index():
    """設置 LlamaIndex"""
    openai_key = os.getenv('OPENAI_API_KEY')
    if not openai_key:
        return False
    
    Settings.llm = OpenAI(model="gpt-4o-mini", api_key=openai_key, temperature=0)
    Settings.embed_model = OpenAIEmbedding(
        model="text-embedding-3-small",
        api_key=openai_key
    )
    return True

def load_index():
    """載入預建的向量索引"""
    global _cached_index, _index_load_time
    
    # 如果已經載入過，直接返回
    if _cached_index is not None:
        return _cached_index
    
    # 優先使用 pickle 版本（更快）
    pickle_path = 'data/vector_index.pkl'
    if os.path.exists(pickle_path):
        try:
            with open(pickle_path, 'rb') as f:
                _cached_index = pickle.load(f)
                _index_load_time = os.path.getmtime(pickle_path)
                return _cached_index
        except:
            pass
    
    # 備用：從 LlamaIndex 格式載入
    index_dir = 'data/vector_index'
    if os.path.exists(index_dir):
        try:
            storage_context = StorageContext.from_defaults(persist_dir=index_dir)
            _cached_index = load_index_from_storage(storage_context)
            _index_load_time = time.time()
            return _cached_index
        except:
            pass
    
    return None

def search_vector_fast(query, max_results=5):
    """使用預建索引進行快速向量搜尋"""
    try:
        # 設置 OpenAI
        if not setup_llama_index():
            return {'error': 'OPENAI_API_KEY not set', 'query': query}
        
        # 載入索引
        index = load_index()
        if index is None:
            return {
                'error': '向量索引未建立，請先執行: python csv-utils/build_vector_index.py',
                'query': query
            }
        
        # 執行搜尋 - 只需計算查詢的 embedding！
        start_time = time.time()
        
        query_engine = index.as_query_engine(
            similarity_top_k=max_results,
            response_mode="no_text"  # 不生成摘要，只返回相關文檔
        )
        
        response = query_engine.query(query)
        
        # 提取結果
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
                'summary_cn': metadata.get('summary_cn', ''),
                'tags_cn': metadata.get('tags_cn', ''),
                'relevance_score': float(node.score) if hasattr(node, 'score') else 0.0,
                'match_type': 'vector'
            })
        
        elapsed_ms = (time.time() - start_time) * 1000
        
        return {
            'results': results,
            'total': len(results),
            'search_type': 'vector_fast',
            'query': query,
            'search_time_ms': round(elapsed_ms),
            'index_cached': _cached_index is not None
        }
        
    except Exception as e:
        return {'error': str(e), 'query': query}

def search_vector_with_summary(query, max_results=3):
    """向量搜尋並生成摘要（較慢但更智能）"""
    try:
        if not setup_llama_index():
            return {'error': 'OPENAI_API_KEY not set', 'query': query}
        
        index = load_index()
        if index is None:
            return {'error': '向量索引未建立', 'query': query}
        
        start_time = time.time()
        
        # 使用 compact 模式生成簡單摘要
        query_engine = index.as_query_engine(
            similarity_top_k=max_results,
            response_mode="compact"
        )
        
        response = query_engine.query(query)
        
        results = []
        for node in response.source_nodes:
            metadata = node.node.metadata
            results.append({
                'id': metadata.get('id', ''),
                'title_cn': metadata.get('title_cn', ''),
                'summary_cn': metadata.get('summary_cn', ''),
                'relevance_score': float(node.score) if hasattr(node, 'score') else 0.0
            })
        
        elapsed_ms = (time.time() - start_time) * 1000
        
        return {
            'answer': str(response),
            'results': results,
            'total': len(results),
            'search_type': 'vector_with_summary',
            'query': query,
            'search_time_ms': round(elapsed_ms)
        }
        
    except Exception as e:
        return {'error': str(e), 'query': query}

def main():
    """命令行界面"""
    if len(sys.argv) < 3:
        print("Usage: python csv_search_vector_fast.py <search_type> 'query' [max_results]")
        print("Search types: fast, summary")
        sys.exit(1)
    
    search_type = sys.argv[1]
    query = sys.argv[2]
    max_results = int(sys.argv[3]) if len(sys.argv) > 3 else 5
    
    if search_type == 'fast':
        result = search_vector_fast(query, max_results)
    elif search_type == 'summary':
        result = search_vector_with_summary(query, max_results)
    else:
        result = {'error': f'Unknown search type: {search_type}'}
    
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main() 