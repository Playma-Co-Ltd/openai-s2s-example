#!/usr/bin/env python3
"""
預建向量索引腳本 - 一次性建立所有文檔的向量索引
只需執行一次，之後搜尋會很快
"""
import os
import sys
import pandas as pd
import pickle
from llama_index.core import Document, VectorStoreIndex, StorageContext, load_index_from_storage
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI
from llama_index.core.settings import Settings
import time
from dotenv import load_dotenv

# 載入 .env 檔案
load_dotenv()

def setup_llama_index():
    """設置 LlamaIndex"""
    openai_key = os.getenv('OPENAI_API_KEY')
    if not openai_key:
        print("錯誤：需要設定 OPENAI_API_KEY 環境變數")
        sys.exit(1)
    
    Settings.llm = OpenAI(model="gpt-4o-mini", api_key=openai_key, temperature=0)
    Settings.embed_model = OpenAIEmbedding(
        model="text-embedding-3-small",
        api_key=openai_key
    )
    print("✓ OpenAI 設定完成")

def load_csv_and_create_documents():
    """載入 CSV 並創建文檔"""
    csv_path = 'data/output.csv'
    if not os.path.exists(csv_path):
        print(f"錯誤：找不到 {csv_path}")
        sys.exit(1)
    
    print(f"正在載入 {csv_path}...")
    df = pd.read_csv(csv_path)
    print(f"✓ 載入 {len(df)} 筆資料")
    
    documents = []
    for index, row in df.iterrows():
        # 組合所有重要欄位
        title_cn = row.get('title_cn', '')
        title_en = row.get('title_en', '')
        summary_cn = row.get('summary_cn', '')
        summary_en = row.get('summary_en', '')
        tags_cn = row.get('tags_cn', '')
        tags_en = row.get('tags_en', '')
        content_cn = str(row.get('content_cn', ''))[:500]  # 限制內容長度
        
        # 建立完整文本
        full_text = f"""
標題: {title_cn}
Title: {title_en}
摘要: {summary_cn}
Summary: {summary_en}
標籤: {tags_cn}
Tags: {tags_en}
內容: {content_cn}
        """.strip()
        
        # 儲存元資料
        metadata = {
            'id': row.get('id', index),
            'title_cn': title_cn,
            'title_en': title_en,
            'source': row.get('source', ''),
            'date': row.get('date', ''),
            'url': row.get('url', ''),
            'summary_cn': summary_cn[:200] if summary_cn else '',
            'tags_cn': tags_cn
        }
        
        doc = Document(text=full_text, metadata=metadata)
        documents.append(doc)
        
        if (index + 1) % 100 == 0:
            print(f"  處理進度: {index + 1}/{len(df)}")
    
    print(f"✓ 創建 {len(documents)} 個文檔")
    return documents

def build_and_save_index(documents):
    """建立向量索引並儲存"""
    index_dir = 'data/vector_index'
    
    # 建立索引目錄
    os.makedirs(index_dir, exist_ok=True)
    
    print("\n開始建立向量索引（這會花費 1-3 分鐘）...")
    print("正在呼叫 OpenAI Embedding API...")
    
    start_time = time.time()
    
    # 建立向量索引
    index = VectorStoreIndex.from_documents(
        documents,
        show_progress=True  # 顯示進度條
    )
    
    elapsed = time.time() - start_time
    print(f"✓ 向量索引建立完成！耗時: {elapsed:.1f} 秒")
    
    # 儲存索引到磁碟
    print(f"\n正在儲存索引到 {index_dir}...")
    index.storage_context.persist(persist_dir=index_dir)
    print(f"✓ 索引已儲存")
    
    # 也儲存一份 pickle 版本以便快速載入
    pickle_path = 'data/vector_index.pkl'
    with open(pickle_path, 'wb') as f:
        pickle.dump(index, f)
    print(f"✓ Pickle 版本已儲存到 {pickle_path}")
    
    return index

def test_index(index):
    """測試索引搜尋功能"""
    print("\n=== 測試搜尋功能 ===")
    
    test_queries = [
        "AI 人工智慧",
        "語音辨識",
        "最新科技新聞",
        "Anthropic Claude"
    ]
    
    for query in test_queries:
        print(f"\n搜尋: '{query}'")
        start = time.time()
        
        query_engine = index.as_query_engine(
            similarity_top_k=3,
            response_mode="no_text"  # 只返回文檔，不生成摘要
        )
        
        response = query_engine.query(query)
        
        print(f"  耗時: {(time.time() - start)*1000:.0f}ms")
        print(f"  找到 {len(response.source_nodes)} 個相關文檔:")
        
        for node in response.source_nodes[:2]:
            metadata = node.metadata
            print(f"    - {metadata.get('title_cn', 'N/A')} (相關度: {node.score:.3f})")

def main():
    print("=== 向量索引預建腳本 ===")
    print("此腳本只需執行一次，建立的索引可重複使用\n")
    
    # 檢查是否已有索引
    if os.path.exists('data/vector_index.pkl'):
        response = input("發現已存在的索引，是否重建？(y/n): ")
        if response.lower() != 'y':
            print("取消操作")
            return
    
    # 設置 OpenAI
    setup_llama_index()
    
    # 載入資料並創建文檔
    documents = load_csv_and_create_documents()
    
    # 建立並儲存索引
    index = build_and_save_index(documents)
    
    # 測試索引
    test_index(index)
    
    print("\n=== 完成！===")
    print("索引已建立並儲存。現在搜尋將會快很多！")
    print("檔案位置:")
    print("  - data/vector_index/ (LlamaIndex 格式)")
    print("  - data/vector_index.pkl (Pickle 格式)")

if __name__ == "__main__":
    main()