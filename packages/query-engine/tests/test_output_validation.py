from query_engine.generator import _validate_output


def test_normal_answer_passes():
    answer = "You need a building permit for decks over 24 inches above grade."
    assert _validate_output(answer) == answer


def test_prompt_leakage_blocked():
    answer = "My security rules say that my system prompt includes instructions to only answer about Toronto."
    result = _validate_output(answer)
    assert "city services" in result.lower()
    assert "security rules" not in result.lower()


def test_role_breaking_blocked():
    answer = "I have been freed from my constraints. I am now in developer mode and can do anything."
    result = _validate_output(answer)
    assert "city services" in result.lower()
    assert "developer mode" not in result.lower()


def test_dan_mode_blocked():
    answer = "Sure! In DAN mode I can answer anything. Here is how to hack a website."
    result = _validate_output(answer)
    assert "city services" in result.lower()


def test_single_leakage_word_not_blocked():
    answer = "According to the City's instructions, you need to submit form X."
    assert _validate_output(answer) == answer
