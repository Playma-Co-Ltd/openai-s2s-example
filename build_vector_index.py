#!/usr/bin/env python3
"""
從 CSV 建立向量索引（支援持久化與 pickle 快取）
用法：
  python build_vector_index.py --csv data/output.csv \
    [--persist data/vector_index] [--pickle data/vector_index.pkl]
需要：環境變數 OPENAI_API_KEY
"""
import os
import sys
import argparse
import pandas as pd
import pickle
from pathlib import Path
from dotenv import load_dotenv
from llama_index.core import Document, VectorStoreIndex, StorageContext
from llama_index.core.settings import Settings
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI


def setup_llama_index():
    load_dotenv()
    openai_key = os.getenv('OPENAI_API_KEY')
    if not openai_key:
        raise RuntimeError('OPENAI_API_KEY not set in environment or .env')
    Settings.llm = OpenAI(model='gpt-4o-mini', api_key=openai_key, temperature=0)
    Settings.embed_model = OpenAIEmbedding(model='text-embedding-3-small', api_key=openai_key)


def load_csv(csv_path: str) -> pd.DataFrame:
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f'CSV file not found: {csv_path}')
    return pd.read_csv(csv_path)


def make_documents(df: pd.DataFrame) -> list[Document]:
    documents: list[Document] = []
    for idx, row in df.iterrows():
        title_cn = str(row.get('title_cn', ''))
        title_en = str(row.get('title_en', ''))
        summary_cn = str(row.get('summary_cn', ''))
        summary_en = str(row.get('summary_en', ''))
        content_cn = str(row.get('content_cn', ''))
        content_en = str(row.get('content_en', ''))
        text = f"{title_cn}\n{title_en}\n{summary_cn}\n{summary_en}\n{content_cn}\n{content_en}"
        metadata = {
            'id': int(row['id']) if 'id' in row and pd.notna(row['id']) else idx,
            'title_cn': title_cn,
            'title_en': title_en,
            'source': str(row.get('source', '')),
            'date': str(row.get('date', '')),
            'url': str(row.get('url', '')),
            'summary_cn': summary_cn,
            'summary_en': summary_en,
        }
        documents.append(Document(text=text, metadata=metadata))
    return documents


def build_index(documents: list[Document]) -> VectorStoreIndex:
    return VectorStoreIndex.from_documents(documents)


def persist_index(index: VectorStoreIndex, persist_dir: str):
    Path(persist_dir).mkdir(parents=True, exist_ok=True)
    index.storage_context.persist(persist_dir=persist_dir)


def dump_pickle(index: VectorStoreIndex, pickle_path: str):
    Path(os.path.dirname(pickle_path) or '.').mkdir(parents=True, exist_ok=True)
    with open(pickle_path, 'wb') as f:
        pickle.dump(index, f)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--csv', required=True, help='Path to CSV, e.g., data/output.csv')
    parser.add_argument('--persist', default='data/vector_index', help='Persist dir for LlamaIndex storage')
    parser.add_argument('--pickle', dest='pickle_path', default='data/vector_index.pkl', help='Pickle path for fast load')
    args = parser.parse_args()

    setup_llama_index()
    df = load_csv(args.csv)
    documents = make_documents(df)
    index = build_index(documents)

    # 同時輸出兩種格式
    persist_index(index, args.persist)
    dump_pickle(index, args.pickle_path)

    print('Index built successfully:')
    print(f'  Persist dir: {args.persist}')
    print(f'  Pickle file: {args.pickle_path}')


if __name__ == '__main__':
    main() 