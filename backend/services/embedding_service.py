import openai
import asyncio
from typing import List, Optional
import numpy as np
from tenacity import retry, stop_after_attempt, wait_exponential
import logging

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Serviço para criação de embeddings usando diferentes provedores"""

    def __init__(self):
        self.openai_client = openai.AsyncOpenAI()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def create_embeddings(
            self,
            texts: List[str],
            model: str = "text-embedding-3-small",
            batch_size: int = 100
    ) -> List[List[float]]:
        """
        Cria embeddings para lista de textos com batching automático
        """
        if not texts:
            return []

        all_embeddings = []

        # Processar em batches para evitar rate limits
        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i + batch_size]

            try:
                if model.startswith("text-embedding"):
                    # OpenAI embeddings
                    response = await self.openai_client.embeddings.create(
                        model=model,
                        input=batch_texts,
                        encoding_format="float"
                    )

                    batch_embeddings = [data.embedding for data in response.data]
                    all_embeddings.extend(batch_embeddings)

                else:
                    raise ValueError(f"Modelo de embedding não suportado: {model}")

                # Rate limiting - pause between batches
                if i + batch_size < len(texts):
                    await asyncio.sleep(0.1)

            except Exception as e:
                logger.error(f"Erro ao criar embeddings batch {i}-{i + batch_size}: {e}")
                raise

        logger.info(f"Criados {len(all_embeddings)} embeddings usando {model}")
        return all_embeddings

    async def create_single_embedding(
            self,
            text: str,
            model: str = "text-embedding-3-small"
    ) -> List[float]:
        """Cria embedding para um único texto"""
        embeddings = await self.create_embeddings([text], model)
        return embeddings[0] if embeddings else []

    def cosine_similarity(
            self,
            embedding1: List[float],
            embedding2: List[float]
    ) -> float:
        """Calcula similaridade coseno entre dois embeddings"""
        vec1 = np.array(embedding1)
        vec2 = np.array(embedding2)

        # Normalizar vetores
        vec1_norm = vec1 / np.linalg.norm(vec1)
        vec2_norm = vec2 / np.linalg.norm(vec2)

        # Calcular similaridade coseno
        similarity = np.dot(vec1_norm, vec2_norm)

        return float(similarity)
