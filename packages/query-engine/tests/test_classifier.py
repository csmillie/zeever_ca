from query_engine.classifier import classify_query

def test_conditional_query():
    assert classify_query("Do I need a building permit for a deck?") == "conditional"

def test_fee_query():
    assert classify_query("How much does a building permit cost?") == "fees"

def test_documents_query():
    assert classify_query("What documents do I need to submit?") == "documents"

def test_process_query():
    assert classify_query("What is the process for applying?") == "process"

def test_inspection_query():
    assert classify_query("What inspections are required?") == "inspections"

def test_general_query():
    assert classify_query("Tell me about building permits") == "general"

def test_apply_query():
    assert classify_query("How do I apply for a building permit?") == "process"

def test_cost_query():
    assert classify_query("What is the cost of a permit?") == "fees"
