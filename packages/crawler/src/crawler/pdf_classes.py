"""Which audience a Toronto.ca PDF is for, decided from its URL.

The corpus is 10,800 PDFs against 7,700 HTML pages and they retrieve very
differently. Measured over a 295-page sample:

    resident facing      73 percent
    reference/archive    39 percent   (council-meeting alone: 15 percent)
    still unidentified   37 percent
    translated            0 percent

Reference material is council agendas and decisions, engineering specifications,
municipal code chapters, infrastructure project appendices. A resident does not
ask a service assistant what a committee decided on a Thursday in June, so the
breadth eval generates a question from a decision summary and then correctly
fails to retrieve it, which is scored as a failure.

This lives in the crawler package rather than in a script because two things
depend on it now: the URL filter, which decides what to fetch, and the audit,
which reports what was fetched. One copy means a URL list and the numbers
describing it cannot disagree.

Every pattern was taken from a URL present in the corpus. Twice they were guessed
instead, and both times they named about 30 percent of the chunks and left the
rest in a bucket called everything else. Word frequency over the unnamed
filenames produced the classes that matter.
"""
import re

# Corridor names and report vocabulary, as two halves that can appear in either
# order. The first version required the corridor first, so Progress-Report-Eglinton
# never matched. After pruning the reference PDFs, the remaining unnamed filenames
# still led with eglinton 187, blvd 153, yonge 122 and queen 93, beside final 229,
# progress 109, report 94 and summary 86. A corridor alone is not enough, because a
# resident page can name a street, so both halves are required.
_CORRIDOR = (r"(eglinton|yonge|bloor|finch|sheppard|keele|dufferin|lawrence|"
             r"steeles|jane|danforth|queen|dundas|bathurst|kingston|midtown|"
             r"waterfront|portlands|blvd|boulevard)")
_REPORT = (r"(appendix|report|study|progress|final|phase|section|assessment|"
           r"update|corridor|reconstruction|environmental|summary|"
           r"streetscape|realignment|widening)")
_CORRIDOR_THEN_REPORT = _CORRIDOR + r"[-_].*" + _REPORT
_REPORT_THEN_CORRIDOR = _REPORT + r"[-_].*" + _CORRIDOR

# Every pattern below was taken from a URL actually present in the corpus.
PDF_CLASSES = [
    ("legdocs-mmis", r"/legdocs/mmis/",
     "Council and committee background files, agendas, decision documents"),
    ("legdocs-municode", r"/legdocs/municode/",
     "Municipal code chapters, the bylaws themselves"),
    ("legdocs-other", r"/legdocs/",
     "Other legislative documents"),
    ("ecs-specs", r"ecs-specs|ecs_specs|-ts[-_]\d|standard-construction",
     "Engineering construction specifications and standards"),
    ("study-ea", r"environmental-assessment|-ea-study|feasibility|scope-of-the-study",
     "Environmental assessments and feasibility studies"),
    ("budget-financial", r"budget|financial-statement|annual-report|audit",
     "Budgets, financial statements, annual reports"),
    ("consultation", r"display-panel|open-house|public-consultation|meeting-notes|presentation",
     "Consultation display panels, open house boards, presentations"),
    # The biggest thing in the corpus, and it was hiding outside /legdocs/mmis/.
    # Word frequency over the unidentified filenames returned summary 800, agenda
    # 782, decisions 684 and thursday 445, which is one document family: committee
    # and council meeting papers published under wp-content/uploads instead. The
    # day name is a meeting date, and it only counts alongside the other signals.
    ("council-meeting", r"[-_](agenda|decisions?|minutes|smis)[-_.]|"
                        r"committee[-_]|[-_](council|cc\d+|ph\d+|ex\d+|te\d+|ny\d+)[-_]|"
                        r"[-_](monday|tuesday|wednesday|thursday|friday)[-_.]",
     "Committee and council meeting agendas, decisions and summaries"),
    # An AODA-tagged file is usually an accessible re-publication of a document
    # already in the corpus, so it competes with its own original.
    ("accessible-copy", r"aoda",
     "Accessible (AODA) re-publications of a document already indexed"),
    # What remained after the council papers were named. Word frequency returned
    # eglinton 189, yonge 170, blvd 154, queen 93, bloor 81, finch 64, sheppard 59
    # and keele 53, sitting beside appendix 269, final 243, progress 110 and
    # report 131. That is infrastructure project documentation filed by corridor:
    # transit studies, road reconstruction, appendices and progress reports. A
    # corridor name alone is not enough, since a resident page can mention a
    # street, so it has to pair with report structure or project vocabulary.
    ("project-doc", _CORRIDOR_THEN_REPORT + "|" + _REPORT_THEN_CORRIDOR + "|"
                    r"(appendix|progress[-_]report|technical[-_]report)[-_]",
     "Infrastructure project documentation, filed by street or corridor"),
    # Matched before the language pattern on purpose: GreekTown and Chinatown are
    # BIA names, not languages, and the language list would claim them first.
    ("bia-profile", r"-bia[-_.]|business-improvement-area",
     "Business Improvement Area profiles, one per neighbourhood, near-identical format"),
    # The same document republished in fifteen languages. An English query cannot
    # match the Punjabi copy, so each one is a guaranteed miss for an English-only
    # product, and they crowd the English original in the index.
    ("translated", r"translation|[-_](punjabi|farsi|persian|gujarati|spanish|urdu|serbian|"
                   r"bengali|korean|vietnamese|chinese|arabic|french|greek|italian|"
                   r"portuguese|russian|tagalog|tamil|hindi|polish|somali|ukrainian|"
                   r"amharic|nepali|dari|pashto|tigrinya)[-_.]",
     "The same document republished in another language"),
    ("job-posting", r"sample[-_](admin|foreperson|clerk|operator|supervisor|manager)|"
                    r"job-description|sample_[a-z]+_[a-z]+",
     "Sample job descriptions and hiring templates"),
    ("fact-sheet", r"fact[-_]sheet|info[-_]sheet|tip[-_]sheet",
     "Fact sheets and info sheets for residents"),
    ("form-application", r"application|form|checklist|guide|brochure|handbook",
     "Forms, applications, guides and brochures for residents"),
    # [-_]plan[-_.] rather than -plan-, so a filename ending in "-Plan.pdf" is
    # caught. Bounded on both sides so it does not swallow "Planning", which
    # belongs to council-meeting and is matched earlier anyway.
    ("map-plan", r"map|[-_]plan[-_.]|drawing|schedule[-_][a-z]",
     "Maps, plans and drawings"),
    ("uploads-other", r"/wp-content/uploads/",
     "Everything else under wp-content/uploads"),
]


# Which group each class belongs to. Used by the report and by --urls-out, so a
# URL list and the numbers describing it can never disagree.
RESIDENT = {"form-application", "fact-sheet", "map-plan", "bia-profile"}
REFERENCE = {"ecs-specs", "legdocs-mmis", "legdocs-municode", "legdocs-other",
             "study-ea", "budget-financial", "consultation", "job-posting",
             "council-meeting", "accessible-copy", "project-doc"}
UNKNOWN = {"uploads-other", "unclassified"}
# Its own group because the decision is its own. At 0 percent recall these are not
# underperforming, they are unreachable: an English query cannot match a Punjabi
# document. Whether to drop them or to support the languages is a product
# question, not a retrieval one, and folding them into either of the groups above
# would bury it.
TRANSLATED = {"translated"}

# Every class must land in exactly one group. It did not: translated belonged to
# none of them, so its 925 chunks were quietly missing from the split totals while
# the report looked complete. Checked at import so the next class added cannot
# repeat it.
_ALL_CLASSES = {name for name, _, _ in PDF_CLASSES} | {"unclassified"}
_GROUPED = RESIDENT | REFERENCE | UNKNOWN | TRANSLATED
assert _ALL_CLASSES == _GROUPED, (
    f"every PDF class needs a group. Ungrouped: {_ALL_CLASSES - _GROUPED}. "
    f"Unknown names in a group: {_GROUPED - _ALL_CLASSES}")


def classify(url: str) -> str:
    low = (url or "").lower()
    for name, pattern, _ in PDF_CLASSES:
        if re.search(pattern, low):
            return name
    return "unclassified"
