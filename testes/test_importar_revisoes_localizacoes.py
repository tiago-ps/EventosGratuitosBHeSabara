"""Testes do importador de revisões de endereço com arquivos temporários."""
import json
import tempfile
import unittest
from pathlib import Path
from scripts.importar_revisoes_localizacoes import plan


def write(root, filename, obj):
    (root / filename).write_text(json.dumps(obj), encoding="utf-8")


class ReviewImportTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        write(self.root, "eventos.json", {"eventos": [
            {"id": "a", "local": "NUFAC", "local_id": "nufac", "endereco": "Rua A, 100"},
            {"id": "b", "local": "NUFAC", "local_id": "nufac", "endereco": "Rua A, 100"},
            {"id": "c", "local": "Outro local", "local_id": "outro", "endereco": "Rua A, 100"},
            {"id": "d", "local": "Conservatório", "local_id": "", "endereco": ""}
        ]})
        write(self.root, "espacos_culturais.json", {"itens": [
            {"id":"nufac","endereco":"Rua A, 100"},
            {"id":"outro","endereco":"Rua A, 100"}
        ]})
        write(self.root, "coordenadas-espacos.json", {"versao":1,"pontos":{}})
        write(self.root, "coordenadas-conteudos.json", {"versao":1,
            "bibliotecas":{},"locais_por_endereco":{}})
        self.review = {
            "chave":"endereco:rua a 100", "local":"NUFAC","local_id":"nufac",
            "endereco":"Rua A, 100", "latitude":-19.91,"longitude":-43.94,
            "fonte":"https://www.openstreetmap.org/", "confirmado_em":"2026-10-20T10:00:00Z",
            "evento_ids":["a","b"],"observacao":"entrada revisada"
        }
    def tearDown(self):
        self.temporary.cleanup()

    def patch(self, reviews=None):
        return {"formato":"tem-sim-uai-localizacoes-revisadas-v1",
                "revisoes":reviews if reviews is not None else [self.review]}

    def test_localiza_eventos_sem_gravar_em_modo_de_previa(self):
        spaces, extra, summary = plan(self.root, self.patch())
        self.assertIn("nufac", spaces["pontos"])
        self.assertIn("Rua A, 100", extra["locais_por_endereco"])
        self.assertIn("nufac", extra["locais_por_id"])
        self.assertIn("nufac", extra["locais_por_nome"])
        self.assertEqual(summary["eventos"], 2)
        self.assertEqual(json.loads((self.root / "coordenadas-espacos.json").read_text())["pontos"], {})

    def test_endereco_compartilhado_nao_associa_id_errado(self):
        review = dict(self.review, evento_ids=["a", "b", "c"])
        spaces, extra, _ = plan(self.root, self.patch([review]))
        self.assertIn("Rua A, 100", extra["locais_por_endereco"])
        self.assertNotIn("nufac", extra["locais_por_id"])
        self.assertNotIn("nufac", extra["locais_por_nome"])
        self.assertIn("nufac", spaces["pontos"])

    def test_rejeita_local_generico(self):
        review = dict(self.review, local="Vários espaços da cidade")
        with self.assertRaisesRegex(ValueError, "genérico"):
            plan(self.root, self.patch([review]))

    def test_rejeita_id_de_evento_desatualizado(self):
        review = dict(self.review, evento_ids=["desconhecido"])
        with self.assertRaisesRegex(ValueError, "não encontrado"):
            plan(self.root, self.patch([review]))

    def test_rejeita_endereco_divergente(self):
        review = dict(self.review, endereco="Outra rua, 200")
        with self.assertRaisesRegex(ValueError, "Endereço diferente"):
            plan(self.root, self.patch([review]))

    def test_local_sem_endereco_por_nome(self):
        review = dict(self.review, chave="nome:conservatorio", local="Conservatório",
                      local_id="", endereco="", evento_ids=["d"])
        spaces, extra, _ = plan(self.root, self.patch([review]))
        self.assertIn("conservatorio", extra["locais_por_nome"])
        self.assertFalse(extra["locais_por_id"])


if __name__ == "__main__":
    unittest.main()
