from llm_router.provider import LLMResponse

def test_llm_response_model():
    r = LLMResponse(text="hello", model="claude-sonnet-4-20250514", input_tokens=10, output_tokens=5)
    assert r.text == "hello"
    assert r.total_tokens == 15

def test_llm_response_serialization():
    r = LLMResponse(text="test", model="test-model", input_tokens=100, output_tokens=50)
    d = r.model_dump()
    assert d["text"] == "test"
    assert d["input_tokens"] == 100
