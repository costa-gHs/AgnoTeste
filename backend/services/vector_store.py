import chromadb
from chromadb.config import Settings
import os
from typing import List, Dict, Any, Optional
import uuid
import json


class VectorStoreService:
    """Serviço para gerenciar vector store usando ChromaDB"""

    def __init__(self):
        # Configurar ChromaDB
        persist_directory = os.getenv("VECTOR_DB_PATH", "./vector_db")

        self.client = chromadb.PersistentClient(
            path=persist_directory,
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )

    async def create_collection(
            self,
            name: str,
            metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """Cria uma nova coleção (índice)"""
        try:
            collection = self.client.create_collection(
                name=name,
                metadata=metadata or {},
                get_or_create=True
            )
            return collection.name
        except Exception as e:
            logger.error(f"Erro ao criar coleção {name}: {e}")
            raise

    async def add_documents(
            self,
            index_name: str,
            documents: List[Dict[str, Any]],
            embeddings: List[List[float]]
    ) -> List[str]:
        """Adiciona documentos ao índice"""
        if len(documents) != len(embeddings):
            raise ValueError("Número de documentos deve ser igual ao número de embeddings")

        try:
            collection = self.client.get_collection(name=index_name)

            # Preparar dados para inserção
            ids = []
            texts = []
            metadatas = []

            for i, doc in enumerate(documents):
                doc_id = str(uuid.uuid4())
                ids.append(doc_id)
                texts.append(doc['text'])

                # Metadados (excluindo o texto para evitar duplicação)
                metadata = {k: v for k, v in doc.items() if k != 'text'}
                metadatas.append(metadata)

            # Inserir no ChromaDB
            collection.add(
                ids=ids,
                documents=texts,
                embeddings=embeddings,
                metadatas=metadatas
            )

            logger.info(f"Adicionados {len(documents)} documentos ao índice {index_name}")
            return ids

        except Exception as e:
            logger.error(f"Erro ao adicionar documentos ao índice {index_name}: {e}")
            raise

    async def search(
            self,
            index_name: str,
            query_embedding: List[float],
            top_k: int = 5,
            threshold: float = 0.7,
            metadata_filter: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Busca documentos similares no índice"""
        try:
            collection = self.client.get_collection(name=index_name)

            # Executar busca
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                where=metadata_filter,
                include=['documents', 'metadatas', 'distances']
            )

            # Processar resultados
            search_results = []

            if results['ids'] and results['ids'][0]:
                for i, doc_id in enumerate(results['ids'][0]):
                    # Calcular score (ChromaDB retorna distâncias, não similaridade)
                    distance = results['distances'][0][i]
                    similarity = 1 - (distance / 2)  # Converter distância para similaridade

                    # Filtrar por threshold
                    if similarity >= threshold:
                        result = {
                            'id': doc_id,
                            'text': results['documents'][0][i],
                            'metadata': results['metadatas'][0][i] or {},
                            'score': similarity,
                            'distance': distance
                        }
                        search_results.append(result)

            logger.info(f"Encontrados {len(search_results)} resultados no índice {index_name}")
            return search_results

        except Exception as e:
            logger.error(f"Erro ao buscar no índice {index_name}: {e}")
            raise

    async def delete_index(self, index_name: str) -> bool:
        """Remove um índice completo"""
        try:
            self.client.delete_collection(name=index_name)
            logger.info(f"Índice {index_name} removido com sucesso")
            return True
        except Exception as e:
            logger.error(f"Erro ao remover índice {index_name}: {e}")
            return False

    async def get_collection_info(self, index_name: str) -> Dict[str, Any]:
        """Obtém informações sobre uma coleção"""
        try:
            collection = self.client.get_collection(name=index_name)
            count = collection.count()

            return {
                'name': collection.name,
                'count': count,
                'metadata': collection.metadata
            }
        except Exception as e:
            logger.error(f"Erro ao obter info da coleção {index_name}: {e}")
            return {}