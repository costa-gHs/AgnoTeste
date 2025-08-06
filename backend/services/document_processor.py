import io
import asyncio
from typing import List, Optional, Dict, Any
import PyPDF2
import docx
import markdown
import re
from pathlib import Path
import magic
import hashlib


class DocumentProcessor:
    """Serviço para processamento de documentos"""

    def __init__(self):
        self.supported_types = {
            'application/pdf': self.extract_pdf_text,
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': self.extract_docx_text,
            'text/plain': self.extract_text,
            'text/markdown': self.extract_markdown,
            'text/csv': self.extract_csv,
            'application/json': self.extract_json
        }

    async def extract_text_from_file(
            self,
            file_content: bytes,
            content_type: str,
            filename: Optional[str] = None
    ) -> str:
        """Extrai texto de arquivo baseado no content-type"""

        if content_type not in self.supported_types:
            raise ValueError(f"Tipo de arquivo não suportado: {content_type}")

        try:
            # Executar extração em thread separada para não bloquear
            loop = asyncio.get_event_loop()
            text = await loop.run_in_executor(
                None,
                self.supported_types[content_type],
                file_content
            )

            # Limpeza básica do texto
            text = self._clean_text(text)

            return text

        except Exception as e:
            raise Exception(f"Erro ao extrair texto de {filename or 'arquivo'}: {str(e)}")

    def extract_pdf_text(self, content: bytes) -> str:
        """Extrai texto de PDF"""
        text = ""

        try:
            pdf_file = io.BytesIO(content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)

            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"

        except Exception as e:
            raise Exception(f"Erro ao processar PDF: {str(e)}")

        return text

    def extract_docx_text(self, content: bytes) -> str:
        """Extrai texto de documento Word"""
        try:
            doc_file = io.BytesIO(content)
            document = docx.Document(doc_file)

            text = ""
            for paragraph in document.paragraphs:
                text += paragraph.text + "\n"

            return text

        except Exception as e:
            raise Exception(f"Erro ao processar DOCX: {str(e)}")

    def extract_text(self, content: bytes) -> str:
        """Extrai texto de arquivo texto simples"""
        try:
            return content.decode('utf-8')
        except UnicodeDecodeError:
            # Tentar outras codificações
            encodings = ['latin-1', 'cp1252', 'iso-8859-1']
            for encoding in encodings:
                try:
                    return content.decode(encoding)
                except UnicodeDecodeError:
                    continue

            raise Exception("Não foi possível decodificar o arquivo de texto")

    def extract_markdown(self, content: bytes) -> str:
        """Extrai texto de arquivo Markdown"""
        markdown_content = self.extract_text(content)

        # Converter Markdown para HTML e depois extrair texto puro
        html = markdown.markdown(markdown_content)

        # Remover tags HTML básicas
        text = re.sub(r'<[^>]+>', '', html)

        return text

    def extract_csv(self, content: bytes) -> str:
        """Extrai texto de CSV (converte para formato legível)"""
        import csv

        try:
            csv_content = self.extract_text(content)
            csv_file = io.StringIO(csv_content)

            reader = csv.reader(csv_file)
            text = ""

            for row in reader:
                text += " | ".join(row) + "\n"

            return text

        except Exception as e:
            raise Exception(f"Erro ao processar CSV: {str(e)}")

    def extract_json(self, content: bytes) -> str:
        """Extrai texto de arquivo JSON"""
        try:
            json_content = self.extract_text(content)
            data = json.loads(json_content)

            # Converter JSON para texto legível
            return json.dumps(data, indent=2, ensure_ascii=False)

        except Exception as e:
            raise Exception(f"Erro ao processar JSON: {str(e)}")

    def split_text(
            self,
            text: str,
            chunk_size: int = 1000,
            chunk_overlap: int = 200,
            separators: Optional[List[str]] = None
    ) -> List[str]:
        """Divide texto em chunks com sobreposição"""

        if separators is None:
            separators = ["\n\n", "\n", ". ", "! ", "? ", " ", ""]

        chunks = []

        # Se o texto é menor que chunk_size, retornar como único chunk
        if len(text) <= chunk_size:
            return [text.strip()]

        # Dividir recursivamente usando separadores
        texts = self._split_with_separators(text, separators, chunk_size, chunk_overlap)

        # Limpar chunks vazios
        chunks = [chunk.strip() for chunk in texts if chunk.strip()]

        return chunks

    def _split_with_separators(
            self,
            text: str,
            separators: List[str],
            chunk_size: int,
            chunk_overlap: int
    ) -> List[str]:
        """Divisão recursiva com separadores"""

        if not separators:
            return self._split_by_length(text, chunk_size, chunk_overlap)

        separator = separators[0]
        remaining_separators = separators[1:]

        splits = text.split(separator)

        chunks = []
        current_chunk = ""

        for split in splits:
            if len(current_chunk + separator + split) <= chunk_size:
                current_chunk += (separator if current_chunk else "") + split
            else:
                if current_chunk:
                    chunks.append(current_chunk)

                # Se o split atual é muito grande, dividir recursivamente
                if len(split) > chunk_size:
                    sub_chunks = self._split_with_separators(
                        split,
                        remaining_separators,
                        chunk_size,
                        chunk_overlap
                    )
                    chunks.extend(sub_chunks)
                    current_chunk = ""
                else:
                    current_chunk = split

        if current_chunk:
            chunks.append(current_chunk)

        # Aplicar sobreposição
        if chunk_overlap > 0 and len(chunks) > 1:
            chunks = self._apply_overlap(chunks, chunk_overlap)

        return chunks

    def _split_by_length(
            self,
            text: str,
            chunk_size: int,
            chunk_overlap: int
    ) -> List[str]:
        """Divisão simples por tamanho"""
        chunks = []
        start = 0

        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end]
            chunks.append(chunk)

            if end >= len(text):
                break

            start = end - chunk_overlap

        return chunks

    def _apply_overlap(self, chunks: List[str], overlap_size: int) -> List[str]:
        """Aplica sobreposição entre chunks"""
        if len(chunks) <= 1:
            return chunks

        overlapped_chunks = [chunks[0]]

        for i in range(1, len(chunks)):
            prev_chunk = chunks[i - 1]
            current_chunk = chunks[i]

            # Pegar o final do chunk anterior
            if len(prev_chunk) > overlap_size:
                overlap_text = prev_chunk[-overlap_size:]
                overlapped_chunk = overlap_text + " " + current_chunk
                overlapped_chunks.append(overlapped_chunk)
            else:
                overlapped_chunks.append(current_chunk)

        return overlapped_chunks

    def _clean_text(self, text: str) -> str:
        """Limpeza básica do texto extraído"""

        # Remover múltiplas quebras de linha
        text = re.sub(r'\n+', '\n', text)

        # Remover múltiplos espaços
        text = re.sub(r' +', ' ', text)

        # Remover espaços no início e fim
        text = text.strip()

        return text

    def calculate_file_hash(self, content: bytes) -> str:
        """Calcula hash SHA256 do arquivo para detectar duplicatas"""
        return hashlib.sha256(content).hexdigest()

    def detect_content_type(self, content: bytes, filename: str) -> str:
        """Detecta o tipo de conteúdo do arquivo"""
        try:
            # Usar python-magic para detectar tipo MIME
            mime_type = magic.from_buffer(content, mime=True)
            return mime_type
        except:
            # Fallback baseado na extensão do arquivo
            extension = Path(filename).suffix.lower()

            extension_map = {
                '.pdf': 'application/pdf',
                '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                '.txt': 'text/plain',
                '.md': 'text/markdown',
                '.csv': 'text/csv',
                '.json': 'application/json'
            }

            return extension_map.get(extension, 'application/octet-stream')
