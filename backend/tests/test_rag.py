import unittest

from backend.main import ChatRequest, chat, retrieve


class RetrievalTests(unittest.TestCase):
    def test_abortion_query_returns_grounded_provider_guidance(self):
        document, score = retrieve("I want an abortion and need safe information")
        self.assertGreater(score, 0.28)
        self.assertEqual(document["id"], "abortion-information")
        response = chat(ChatRequest(message="I want an abortion and need safe information"))
        self.assertTrue(response.grounded)
        self.assertIn("qualified reproductive-health provider", response.answer)
        self.assertEqual(response.sources[0].id, "abortion-information")

    def test_kiswahili_query_retrieves_decision_support(self):
        document, score = retrieve("nimepima na siko ready")
        self.assertGreater(score, 0.28)
        self.assertEqual(document["id"], "pregnancy-decision-support")

    def test_urgent_symptom_bypasses_normal_retrieval(self):
        response = chat(ChatRequest(message="I am pregnant and fainting with severe pain"))
        self.assertIn("urgent, in-person help", response.answer)
        self.assertEqual(response.sources[0].id, "urgent-care")

    def test_uncovered_query_uses_honest_fallback(self):
        response = chat(ChatRequest(message="Tell me about deep sea fishing"))
        self.assertFalse(response.grounded)
        self.assertEqual(response.sources, [])
        self.assertIn("I don’t have a reviewed guide", response.answer)


if __name__ == "__main__":
    unittest.main()
