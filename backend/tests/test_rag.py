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

        swahili_response = chat(ChatRequest(message="Nimezimia na nina maumivu makali"))
        self.assertIn("urgent, in-person help", swahili_response.answer)

    def test_uncovered_query_uses_honest_fallback(self):
        response = chat(ChatRequest(message="Tell me about deep sea fishing"))
        self.assertFalse(response.grounded)
        self.assertEqual(response.sources, [])
        self.assertIn("I don’t have a reviewed guide", response.answer)

    def test_multilingual_greetings_receive_language_matched_replies(self):
        cases = {
            "Hello!": "Hello.",
            "Habari?": "Habari!",
            "Hola!": "¡Hola!",
            "مرحبا": "مرحبًا!",
            "你好！": "你好！",
        }
        for message, expected in cases.items():
            with self.subTest(message=message):
                response = chat(ChatRequest(message=message))
                self.assertEqual(response.mode, "greeting")
                self.assertIn(expected, response.answer)
                self.assertEqual(response.sources, [])

    def test_common_sexual_health_topics_are_retrievable(self):
        cases = {
            "What contraception options can I use?": "contraception-options",
            "Where can I get tested for an STI?": "sti-testing-and-prevention",
            "What is consent?": "consent-and-boundaries",
            "When should I take a pregnancy test?": "pregnancy-test",
            "What is menopause?": "menopause",
            "What is the HPV vaccine?": "hpv-and-cervical-health",
        }
        for message, expected_id in cases.items():
            with self.subTest(message=message):
                document, score = retrieve(message)
                self.assertGreater(score, 0.28)
                self.assertEqual(document["id"], expected_id)

    def test_pregnancy_concern_after_sex_does_not_retrieve_hiv_passage(self):
        message = "I had sex last week with my girlfriend and I am not sure if they got pregnant"
        document, _ = retrieve(message)
        self.assertEqual(document["id"], "pregnancy-risk-after-sex")
        response = chat(ChatRequest(message=message))
        self.assertEqual(response.sources[0].id, "pregnancy-risk-after-sex")
        self.assertNotIn("HIV", response.answer)

    def test_self_harm_disclosure_is_never_answered_with_unrelated_rag(self):
        response = chat(ChatRequest(message="I feel like killing myself"))
        self.assertEqual(response.mode, "urgent-support")
        self.assertNotIn("consent", response.answer.casefold())
        self.assertIn("immediate danger", response.answer.casefold())

    def test_greeting_with_extra_casual_word_gets_greeting_reply(self):
        response = chat(ChatRequest(message="hello sasa"))
        self.assertEqual(response.mode, "greeting")
        self.assertIn("Sasa!", response.answer)


if __name__ == "__main__":
    unittest.main()
