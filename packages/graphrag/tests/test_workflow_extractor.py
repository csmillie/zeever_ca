from graphrag_pkg.models import WorkflowStep

def test_workflow_step_model():
    step = WorkflowStep(
        order=1,
        action="Submit application",
        description="Submit the completed building permit application form",
        requirements=["Application form", "Site plan"],
    )
    assert step.order == 1
    assert step.action == "Submit application"
    assert len(step.requirements) == 2
    assert step.next_steps == []

def test_workflow_step_defaults():
    step = WorkflowStep(order=1, action="Check", description="Check requirements")
    assert step.requirements == []
    assert step.next_steps == []
