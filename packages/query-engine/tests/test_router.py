from query_engine.router import select_model

def test_conditional_routes_to_deepseek():
    assert select_model("Do I need a permit?", "conditional") == "deepseek"

def test_process_routes_to_deepseek():
    assert select_model("How do I apply?", "process") == "deepseek"

def test_fees_routes_to_deepseek():
    assert select_model("How much?", "fees") == "deepseek"

def test_general_routes_to_deepseek():
    assert select_model("Tell me about permits", "general") == "deepseek"
