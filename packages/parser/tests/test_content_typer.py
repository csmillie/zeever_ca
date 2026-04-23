from parser.content_typer import classify_content


def test_fee_schedule_classification():
    assert classify_content("Building Permit Fees", "The fee for a building permit is calculated...") == "fee_schedule"


def test_process_guide_classification():
    assert classify_content("Before You Apply", "Step 1: Determine if you need a permit. Step 2: Gather documents...") == "guide"


def test_regulation_classification():
    assert classify_content("Building Permit Regulations", "Ontario Building Code section 1.1...") == "regulation"


def test_generic_page():
    assert classify_content("Building Permits", "Learn about building permits in Toronto.") == "page"


def test_inspection_classification():
    assert classify_content("Building Inspections", "Mandatory building inspections during construction...") == "inspection"


def test_form_classification():
    assert classify_content("Application Form", "Complete this form to apply...") == "form"


def test_guide_from_steps():
    assert classify_content("Getting a Permit", "Step 1: Check zoning. Step 2: Submit drawings.") == "guide"


def test_review_streams_is_guide_not_fee():
    """Review streams page mentions fees but is primarily a process guide."""
    assert classify_content(
        "Building Permit Review Streams",
        "Toronto Building has created three review streams. Complete applications reviewed within 10 business days. All fees have been paid."
    ) == "guide"


def test_express_permits_is_guide():
    assert classify_content("Express Building Permits", "Small projects may qualify for expedited processing.") == "guide"


def test_plan_review_is_guide():
    assert classify_content("Plan Review Process", "Once you submit your permit application...") == "guide"


def test_submission_guide():
    assert classify_content("Electronic Submission Guidelines", "Submit your application electronically...") == "guide"
