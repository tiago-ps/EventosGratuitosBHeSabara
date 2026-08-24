from __future__ import annotations

import hashlib
import io
import sys
import tempfile
import time
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from preparar_filmes_lgbtflix import optimize_image, public_record  # noqa: E402


class PreparacaoFilmesTest(unittest.TestCase):
    def test_otimizacao_e_idempotente(self) -> None:
        source_buffer = io.BytesIO()
        Image.new("RGB", (1200, 600), "#335577").save(source_buffer, "PNG")
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "cartaz.webp"
            width, height, reused = optimize_image(source_buffer.getvalue(), output)
            first_hash = hashlib.sha256(output.read_bytes()).hexdigest()
            first_mtime = output.stat().st_mtime_ns
            time.sleep(0.01)
            width_again, height_again, reused_again = optimize_image(source_buffer.getvalue(), output)
            self.assertEqual((width, height), (800, 400))
            self.assertEqual((width_again, height_again), (800, 400))
            self.assertFalse(reused)
            self.assertTrue(reused_again)
            self.assertEqual(output.stat().st_mtime_ns, first_mtime)
            self.assertEqual(hashlib.sha256(output.read_bytes()).hexdigest(), first_hash)

    def test_registro_publico_exclui_embed_e_vazios(self) -> None:
        record = {
            "id": "lgbtflix:abc",
            "fonte_id": "abc",
            "titulo": "Exemplo",
            "direcao": [],
            "generos": [],
            "temas": [],
            "letras": [],
            "colecoes": [],
            "alertas": [],
            "premios": [],
            "pagina_oficial": "https://flix.votelgbt.org/assistir/abc",
            "video_embed": "https://example.invalid/embed",
            "status_manual": "revisar",
        }
        public = public_record(record, "", 0, 0)
        self.assertNotIn("video_embed", public)
        self.assertNotIn("imagem", public)
        self.assertNotIn("generos", public)
        self.assertEqual(public["status_manual"], "revisar")


if __name__ == "__main__":
    unittest.main()
