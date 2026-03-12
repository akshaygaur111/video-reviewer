"""
Video review service — 3-pass progressive rigor system.

Pass 1: Standard audit    (temperature=0.10) — always runs
Pass 2: Enhanced scrutiny (temperature=0.05) — always runs
Pass 3: Maximum scrutiny  (temperature=0.01) — always runs

All three passes run unconditionally and their findings are merged.

All passes run sequentially per video.
Multiple videos in a job are processed sequentially (one at a time).
"""

import asyncio
import json
import re
import os
import traceback
from datetime import datetime
from typing import List, Dict, Any, Optional

from bson import ObjectId
from google import genai
from google.genai import types

from app.database import get_db
from app.services.drive import download_from_drive, download_video


MODEL_NAME = "gemini-2.5-flash"


# ── Reference video analysis prompt ───────────────────────────────────────────

REFERENCE_ANALYSIS_PROMPT = """
You are a master educational content analyst. Your task is to meticulously analyse
this reference video and extract EVERY detail about its pedagogical content,
structure, and teaching approach. Leave nothing out — even small details matter.

Extract and return a JSON object with the following keys:

{
  "topic": "The precise topic and subtopic of the video (e.g. 'Multiplying fractions by whole numbers')",
  "concepts_covered": [
    "Exhaustive list — every concept, sub-concept, or idea introduced, even briefly.
     Include the specific order they appear in. E.g.:
     '1. Recap: what a fraction means (numerator/denominator)',
     '2. What it means to multiply a fraction by a whole number',
     '3. Visual model: repeated addition of fractions',
     ..."
  ],
  "examples_used": [
    "List every example worked through, with exact values. E.g.:
     '1/3 × 4 = 4/3',
     '2/5 × 3 = 6/5 (simplified to 1 1/5)',
     ..."
  ],
  "pedagogical_approach": {
    "intro_style": "How the video opens — recap, hook, direct statement of topic, etc.",
    "teaching_method": "Direct instruction / guided discovery / worked examples / visual model / etc.",
    "scaffolding": "How the video builds from simple to complex — describe the progression",
    "difficulty_progression": "Describe how the examples increase in difficulty",
    "conclusion_style": "How the video closes — summary, call to action, recap, etc."
  },
  "sequencing": [
    "Step-by-step ordered list of what happens in the video, with approximate timestamps.
     E.g.: '0:00-0:15 — Title card and topic introduction',
           '0:15-0:45 — Recap of fraction basics',
           '0:45-2:00 — First worked example: 1/3 × 4', ..."
  ],
  "visual_style": {
    "highlighting_technique": "How elements are highlighted or emphasised on screen",
    "progressive_reveal": "Does the video reveal content step by step or show all at once?",
    "colour_usage": "How colour is used to distinguish elements",
    "animation_style": "What kind of animations or transitions are used"
  },
  "key_vocabulary": [
    "Every domain-specific term introduced or used in the video"
  ],
  "small_but_important_details": [
    "Any specific notation choices, formatting conventions, verbal phrasing patterns,
     or unique pedagogical moves that a competing video should match or improve upon.
     E.g.: 'Always says the full fraction name before writing it',
           'Uses a number line to verify results',
           'Explicitly tells students to simplify at the end'..."
  ],
  "scope_boundaries": {
    "what_is_included": "Clear statement of what the video DOES cover",
    "what_is_excluded": "Concepts deliberately left out or mentioned as out-of-scope"
  }
}

Output ONLY the JSON object. No other text.
"""


# ── Universal review dimensions ───────────────────────────────────────────────
# These are topic-agnostic aspects every educational video should be checked
# against, regardless of subject matter.

REVIEW_DIMENSIONS = """
REVIEW DIMENSIONS — apply all of these to every video regardless of topic:

1. VISUAL-AUDIO SYNCHRONISATION
   Check that every on-screen element (text, highlight, animation, diagram)
   appears at the exact moment the narrator introduces it — not before, not
   significantly after. Any mismatch between what is said and what is shown is
   a defect.

2. PROGRESSIVE REVEAL
   Content must build up step by step as the narrator explains it. Nothing
   should be pre-filled, pre-highlighted, or already on screen before being
   introduced. Elements should arrive as the narrator speaks them.

3. HIGHLIGHTING DISCIPLINE
   Only the element currently being discussed should be highlighted or
   emphasised. Flag: over-highlighting, too many simultaneous highlights,
   highlights on the wrong element, and highlights that start too early or
   linger too long. Visual emphasis must always match narrative focus.
   When zooming into or focusing on a sub-part of a larger structure,
   the outer structure should remain visible and distinguished (e.g.
   highlighted border), not hidden or removed.

4. FACTUAL & CONTENT ACCURACY
   Verify every value, calculation, label, or statement shown on screen is
   correct. Check that no wrong, partial, or intermediate results are shown
   when only the final correct value should appear. Verify any steps shown
   are logically sound and complete.
   - ANSWER BOX VERIFICATION (mandatory): For every result box, ordered list,
     or final answer displayed on screen, individually compare each displayed
     value against the ORIGINAL numbers stated in the problem. The displayed
     value must be exactly equal in meaning — same fraction, same sign, same
     magnitude. A fraction like -14/25 must NOT appear as -14 20/5, -14 2/5,
     or any other form. A mixed number like 20 3/40 must NOT appear as 20 20/40
     or any other incorrect equivalent. Treat any mismatch as a Critical error.
   - FRACTION RENDERING: Verify every fraction on screen has correct numerator
     and denominator. Check that the denominator has not been accidentally
     replaced by a different value due to a rendering or layout error (e.g.
     the fraction 14/25 wrongly displayed with the whole number -14 beside a
     new fraction 20/5 is a Critical factual error, not a cosmetic one).

5. LANGUAGE & TERMINOLOGY
   Concepts and terms should be introduced and referred to consistently using
   proper, age-appropriate language throughout the video. Prefer full words
   over symbols or abbreviations when introducing a concept for the first time.
   Spoken language must match on-screen text — flag any discrepancy.

6. TEXT & VISUAL FORMATTING
   On-screen text must be spelled correctly, grammatically correct, properly
   punctuated, and consistently formatted. Check: spelling of every word on
   screen (misspellings are Critical errors), capitalisation, punctuation in
   titles and labels, alignment of columns or equations, readability of font
   sizes, and that all visual elements are large enough to be clearly seen.

7. PEDAGOGICAL STRUCTURE
   Evaluate the teaching approach:
   - Examples should guide the student toward the answer, not just test them.
   - Consecutive examples should vary in approach and not repeat the same
     method or structure.
   - Difficulty should progress logically (simpler before complex).
   - Every concept introduced must be explained — do not leave anything
     unresolved.
   - Key terms or elements from a problem should be identified and explained
     before being used in a solution.

8. EXAMPLE DIVERSITY & COVERAGE
   The set of examples in the video should collectively cover the concept
   broadly. Flag if: all examples follow the same pattern, examples lack
   variety in scale or form, or the examples do not adequately represent the
   range of situations a student might encounter.

9. INTRO & PACING
   The introduction should be concise and directly relevant. Flag any intro
   that is unnecessarily long before the actual content begins (provide
   timestamps). Check that the overall pacing allows students adequate time
   to absorb each step.

10. CONTENT COMPLETENESS
    Every concept or element introduced in the video must be fully addressed.
    Flag anything that is shown or mentioned but not explained, any steps that
    are skipped without acknowledgement, and any visual elements that appear
    without context.

11. PEDAGOGICAL FLOW & SEQUENCING
    Evaluate whether the order of instruction supports understanding:
    - New concepts must be introduced only after prerequisite knowledge has been
      activated or recalled — not assumed silently.
    - When a problem is stated (e.g. "A × B"), the visual demonstration must
      follow the same conceptual order. Demonstrating "B of A" when the problem
      says "A × B" reverses the stated order and forces unnecessary cognitive
      re-mapping; flag this as a sequencing issue.
    - Guided worked examples must come before independent practice. Students
      should not be asked to solve a problem type they have not yet been shown.
    - Concrete representations (physical, visual, numerical) should precede
      abstract ones (formulas, symbols). Flag premature abstraction.
    - Difficulty should increase gradually — flag any jump where a harder
      variant is introduced without adequate scaffolding from an easier one.

12. COGNITIVE LOAD MANAGEMENT
    Assess whether the video respects the limits of working memory:
    - No more than 2–3 new concepts or procedural steps should appear in rapid
      succession without a pause, summary, or consolidation moment.
    - On-screen elements visible simultaneously should reflect only what the
      narrator is currently addressing. Surplus simultaneous elements (labels,
      numbers, highlights) compete for attention and should be flagged.
    - Each step must be fully resolved and removed or de-emphasised before the
      next step is introduced — avoid layering unresolved information.
    - Pacing must allow enough time for the target learner to absorb each idea
      before the next arrives; flag sections that are rushed.
    - Transitional summaries or recaps after multi-step sequences are expected;
      flag their absence when the preceding content was complex.

13. ANIMATION MATHEMATICAL ACCURACY
    Verify that every animation directly and correctly encodes the mathematics
    it is meant to illustrate — not just the outcome, but the internal
    structure of the operation:
    - STEP COUNT: The number of distinct visual steps in an animation must
      equal the mathematical quantity it represents. For example, when showing
      decimal point movement for ×10^n, the animation must show exactly n
      individual hops (one per place-value shift) — not a single large arc
      that spans all n digits at once. A single sweeping motion collapses n
      steps into 1 and destroys the one-to-one mapping the animation is
      meant to teach.
    - MAGNITUDE vs. COUNT: Flag any animation where size, arc length, or
      visual weight increases with the exponent/multiplier instead of the
      COUNT of distinct visual events increasing. Larger hops are not the
      same as more hops.
    - CORRESPONDENCE: Every animated element (arrow, bracket, jump, tick)
      must map to exactly one unit of the mathematical quantity being shown.
      If the animation uses 2 arrows for a ×100 step, that is a visual lie
      even if the final answer is correct.
    - ZERO-FILL ANIMATION: When zeros must be appended to complete a decimal
      shift, each zero must be added individually and visibly — not appear
      all at once — so the student can count them against the exponent.
"""


# ── Helpers ───────────────────────────────────────────────────────────────────

def extract_json(text: str) -> List[Dict]:
    """Extract a JSON array from Gemini's response (handles markdown code fences)."""
    if not text:
        return []
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if fence:
        try:
            return json.loads(fence.group(1))
        except Exception:
            pass

    arr = re.search(r"\[[\s\S]*\]", text)
    if arr:
        try:
            return json.loads(arr.group())
        except Exception:
            pass

    return []


def _format_reference_block(reference_analysis: Dict) -> str:
    """Build the reference comparison context block injected into review prompts."""
    import json as _json
    ref_json = _json.dumps(reference_analysis, indent=2)
    return f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REFERENCE VIDEO ANALYSIS (IXL / Benchmark)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{ref_json}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMPARISON MISSION:
Your goal is to help make the submitted video BETTER THAN the reference above,
while staying within the SAME scope and pedagogical framework.

When reviewing the submitted video, additionally flag:

A) SCOPE GAPS — concepts or sub-topics covered in the reference that the
   submitted video MISSES entirely or handles incompletely. Use category
   "Scope Gap" for these issues.

B) PEDAGOGICAL DEVIATIONS — places where the submitted video uses a
   teaching approach that differs from the reference in ways likely to be
   LESS effective (wrong order, skipped scaffolding, different difficulty
   progression). Use category "Pedagogy" for these.

C) IMPROVEMENT OPPORTUNITIES — places where the submitted video COULD do
   better than the reference (clearer visual, better pacing, richer example
   variety). Use category "Enhancement" for these. These are positive flags —
   not errors, but upgrade suggestions.

D) SCOPE OVERREACH — if the submitted video introduces content BEYOND the
   reference's scope_boundaries.what_is_included, flag it so the team can
   decide whether to keep or trim it. Use category "Scope Overreach".

IMPORTANT: The 12 standard review dimensions still apply fully — do not
skip them just because a reference is present. The reference context is
ADDITIVE to the normal review.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""


def _normalize_transcript(transcript: str) -> str:
    """
    Convert raw transcript timestamps from the verbose Gemini format
    ( e.g.  [ 0m1s497ms - 0m7s27ms ] )
    to a compact, model-friendly format
    ( e.g.  [0:01 - 0:07] )
    so the model can easily match issues to the correct second.
    """
    def _parse_ts(raw: str) -> str:
        """XmYsZms → M:SS"""
        m = re.match(r"(\d+)m(\d+)s", raw.strip())
        if m:
            mins, secs = int(m.group(1)), int(m.group(2))
            return f"{mins}:{secs:02d}"
        return raw.strip()

    def _replace(match):
        start = _parse_ts(match.group(1))
        end   = _parse_ts(match.group(2))
        return f"[{start} - {end}]"

    return re.sub(
        r"\[\s*(\d+m\d+s\d*m?s?)\s*-\s*(\d+m\d+s\d*m?s?)\s*\]",
        _replace,
        transcript,
    )


def _format_prior_issues(previous_passes: List[Dict]) -> str:
    """Flatten issues from all previous passes into a readable summary."""
    items = []
    for p in previous_passes:
        for issue in p.get("issues", []):
            ts = issue.get("timestamp", "?")
            cat = issue.get("category", "")
            desc = issue.get("description", "")
            items.append(f"  [{ts}] ({cat}) {desc}")
    return "\n".join(items) if items else "  (none)"


def _rigor_prompt(
    rigor: str,
    transcript: str,
    grade: Optional[str] = None,
    include_suggestions: bool = True,
    previous_passes: Optional[List[Dict]] = None,
    reference_analysis: Optional[Dict] = None,
) -> str:
    previous_passes = previous_passes or []

    grade_block = ""
    if grade:
        grade_block = f"""
GRADE CONTEXT: This video is designed for {grade} students.
Calibrate your assessment accordingly:
- Use age-appropriate expectations for vocabulary, concept complexity, and prior knowledge.
- Flag pacing or cognitive load issues that would be problematic specifically for {grade} learners.
- Sequencing issues (e.g. skipped scaffolding, premature abstraction) should be judged relative to what {grade} students can reasonably be expected to know.
"""

    output_keys = "timestamp, category, severity, description, suggestion" if include_suggestions else "timestamp, category, severity, description"
    suggestion_note = "" if include_suggestions else "\n  Do NOT include a 'suggestion' key — omit it entirely."
    transcript = _normalize_transcript(transcript)

    prior_block = ""
    if previous_passes:
        total_prior = sum(p.get("issues_found", 0) for p in previous_passes)
        prior_block = f"""
ISSUES ALREADY REPORTED BY PREVIOUS PASSES ({total_prior} total — do NOT repeat these):
{_format_prior_issues(previous_passes)}

Your task: find issues that the previous pass(es) MISSED. Look for different dimensions,
different timestamps, and subtler defects not yet captured above.
"""

    reference_block = ""
    if reference_analysis:
        reference_block = _format_reference_block(reference_analysis)

    checklist = """
MANDATORY ANALYSIS METHOD — work through EVERY dimension below BEFORE writing your JSON:
  1. VISUAL-AUDIO SYNCHRONISATION  — scan every moment a new element appears or changes
  2. PROGRESSIVE REVEAL            — nothing pre-shown or pre-filled before introduction
  3. HIGHLIGHTING DISCIPLINE       — only current element is highlighted; no over-highlighting
  4. FACTUAL & CONTENT ACCURACY    — verify EVERY number, calculation, label, and formula on screen
  5. LANGUAGE & TERMINOLOGY        — consistent, age-appropriate, spoken = written
  6. TEXT & VISUAL FORMATTING      — grammar, punctuation, capitalisation, readability
  7. PEDAGOGICAL STRUCTURE         — examples guide, difficulty progresses, nothing unresolved
  8. EXAMPLE DIVERSITY & COVERAGE  — sufficient variety in the example set
  9. INTRO & PACING                — concise intro; enough time at each step
 10. CONTENT COMPLETENESS          — every introduced concept is fully addressed
 11. PEDAGOGICAL FLOW & SEQUENCING — correct order; no premature abstraction; guided before independent
 12. COGNITIVE LOAD MANAGEMENT     — working memory respected; no surplus simultaneous elements

VISUAL ACCURACY REQUIREMENT:
  For every number, variable, or formula that appears on screen:
    - Verify its value is mathematically correct.
    - Verify it appears at the exact moment the narrator states it (not before, not after).
    - Verify any labels (e.g. "Product =", "Length =") are used with the correct meaning.
  For every shading, highlighting, or animation:
    - Verify the order and direction of the operation matches how the problem was stated.
    - Verify the result of the operation is shown correctly.
"""

    base = f"""
TRANSCRIPT (ground truth for audio):
{transcript}
{grade_block}{reference_block}{prior_block}
{REVIEW_DIMENSIONS}
{checklist}
SEVERITY CLASSIFICATION — assign exactly one severity value to every issue:
  "Critical" — Factual or mathematical errors that will directly mislead students
               (wrong answer, wrong formula, incorrect label, calculation mistake).
               ALSO: any spelling mistake in on-screen text — misspelled words
               teach students incorrect language and are always Critical regardless
               of how minor they appear visually.
  "Major"    — Significant pedagogical or synchronisation flaws that noticeably
               impair learning (audio-visual mismatch, wrong instructional order,
               missing scaffolding, cognitive overload, scope gaps).
  "Minor"    — Purely cosmetic or consistency issues that do not affect the
               accuracy of any word, number, or concept shown on screen
               (capitalisation of titles, punctuation style, slight pacing
               variance, mild over-highlighting, minor terminology inconsistency).
               NOTE: spelling errors are NEVER Minor — see Critical above.

OUTPUT: First briefly note (one line per dimension) whether each of the 12 dimensions is clean or has issues.
Then output ONLY a JSON array of issue objects. Each element must have keys:
  {output_keys}{suggestion_note}

TIMESTAMP RULES — zero tolerance for approximation:
  - Every "timestamp" value MUST be the START time of the transcript line
    where the issue first occurs, copied verbatim from the transcript above.
  - Format: M:SS  (e.g. "1:08", "2:42"). Never guess or round.
  - Do NOT use range format (e.g. "1:08-1:24") — use only the single start time.
  - If an issue spans multiple transcript lines, use the start time of the
    FIRST affected line.
  - Do NOT invent a timestamp that does not appear as a start time in the
    transcript.

ONE ISSUE PER DEFECT — if a single on-screen problem (e.g. wrong label text)
  touches multiple review dimensions (e.g. Factual Accuracy AND Formatting),
  file it as ONE issue under the MOST SPECIFIC applicable category. Do NOT
  duplicate the same defect under multiple categories.

If there are no issues return an empty array [].
"""
    if rigor == "standard":
        return f"""
You are a Senior QA Specialist reviewing an educational video.

{base}

Apply all 12 REVIEW DIMENSIONS systematically. Confidence threshold: 85%.
"""
    elif rigor == "enhanced":
        prior_count = sum(p.get("issues_found", 0) for p in previous_passes)
        context = (
            f"Pass 1 found {prior_count} issue(s) (listed above). Your job is to find ADDITIONAL issues it missed."
            if prior_count > 0
            else "The previous pass found no issues — look harder."
        )
        return f"""
You are a Senior QA Specialist with eagle-eye attention to detail.
{context}

{base}

Apply all 12 REVIEW DIMENSIONS with extra scrutiny on:
- Subtle timing gaps (even 1–2 seconds) between audio and visual.
- Inconsistencies in how terms, values, or labels are written vs spoken.
- Elements appearing or disappearing at the wrong moment.
- Steps skipped without acknowledgement.
- Sequencing issues: does the visual order match the stated problem order?
- Cognitive load: are too many elements visible simultaneously?
- Any label or annotation used with an incorrect meaning.

Confidence threshold: 70%.
"""
    else:  # maximum
        prior_count = sum(p.get("issues_found", 0) for p in previous_passes)
        context = (
            f"Previous passes found {prior_count} issue(s) (listed above). Find what they STILL missed."
            if prior_count > 0
            else "Two previous passes found no issues. Apply MAXIMUM scrutiny."
        )
        return f"""
You are the Chief QA Director with 20+ years of educational content review.
{context}

{base}

Apply all 12 REVIEW DIMENSIONS as an explicit, exhaustive checklist. Additionally:
- Frame-level accuracy: every single value and symbol visible on screen at any point.
- Font size, contrast, and readability for the target age group.
- Recording artifacts: glitches, stray cursors, unwanted screen elements, transitions.
- Pacing: too fast or too slow at any specific moment (give timestamps).
- Terminology consistency: does the same concept always use the same word/symbol?
- Pedagogical sequencing: does every single visual demonstration follow the stated problem order?
- Working memory: how many unresolved items are on screen at each step?

Confidence threshold: 60%.
"""


def _determine_rigor(pass_number: int, previous_passes: List[Dict]) -> str:
    """Always escalate rigor with each pass, regardless of previous results."""
    return {1: "standard", 2: "enhanced", 3: "maximum"}[pass_number]


def _ts_to_seconds(ts: str) -> int:
    """
    Convert any timestamp variant the model may produce to integer seconds.
    Handles:
      "M:SS"          →  standard (e.g. "1:08")
      "MM:SS"         →  standard with leading zero (e.g. "01:08")
      "H:MM:SS"       →  transcript format (e.g. "00:01:08") — hours:mins:secs
      "MM:SS:mmm"     →  millisecond bleed (e.g. "01:13:226") — ignore ms
      "MM:SS-MM:SS"   →  range — use start time only (e.g. "00:14-00:24")
    """
    ts = ts.strip()
    # Strip range suffix  "0:14-0:24"  →  "0:14"
    ts = re.split(r"\s*-\s*(?=\d)", ts)[0].strip()
    # Split on any non-digit separator
    parts = re.split(r"[^0-9]+", ts)
    parts = [p for p in parts if p]
    try:
        if len(parts) >= 3:
            # Three-part timestamp: H:MM:SS if third part <= 59, else MM:SS:mmm
            if int(parts[2]) <= 59:
                return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
            else:
                # MM:SS:mmm — ignore milliseconds
                return int(parts[0]) * 60 + int(parts[1])
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
    except Exception:
        pass
    return 9999


def _canonicalize_timestamp(ts: str) -> str:
    """
    Normalise any model-produced timestamp to clean M:SS format.
    "00:14-00:24" → "0:14"
    "01:13:226"   → "1:13"
    "02:11"       → "2:11"
    Returns the original string unchanged if it cannot be parsed.
    """
    secs = _ts_to_seconds(ts)
    if secs == 9999:
        return ts  # unparseable — leave as-is rather than lose data
    m, s = divmod(secs, 60)
    return f"{m}:{s:02d}"


def _combine_issues(passes: List[Dict]) -> List[Dict]:
    """
    Merge issues from all passes:
    - Deduplicate by description similarity (first 80 chars, case-insensitive)
    - Normalise every timestamp to M:SS
    - Sort chronologically
    """
    combined = []
    seen = set()

    for p in passes:
        for issue in p.get("issues", []):
            desc = issue.get("description", "").lower().strip()
            key = desc[:80]
            if key and key not in seen:
                # Normalise the timestamp in-place on a copy so the original pass data is untouched
                issue = dict(issue)
                issue["timestamp"] = _canonicalize_timestamp(issue.get("timestamp", "") or "")
                combined.append(issue)
                seen.add(key)

    return sorted(combined, key=lambda item: _ts_to_seconds(item.get("timestamp", "") or ""))


# ── Core review logic ─────────────────────────────────────────────────────────

async def _run_pass(
    client: genai.Client,
    video_file,
    pass_number: int,
    rigor: str,
    transcript: str,
    grade: Optional[str] = None,
    include_suggestions: bool = True,
    previous_passes: Optional[List[Dict]] = None,
    reference_analysis: Optional[Dict] = None,
) -> Dict:
    temperature = {"standard": 0.10, "enhanced": 0.05, "maximum": 0.01}[rigor]
    prompt = _rigor_prompt(
        rigor, transcript,
        grade=grade,
        include_suggestions=include_suggestions,
        previous_passes=previous_passes or [],
        reference_analysis=reference_analysis,
    )
    loop = asyncio.get_running_loop()

    config = types.GenerateContentConfig(
        temperature=temperature,
        top_p=0.95,
        max_output_tokens=8192,
    )

    response = await loop.run_in_executor(
        None,
        lambda: client.models.generate_content(
            model=MODEL_NAME,
            contents=[video_file, prompt],
            config=config,
        ),
    )
    try:
        raw = response.text
    except Exception:
        raw = None
    issues = extract_json(raw)
    return {
        "pass_number": pass_number,
        "rigor_level": rigor,
        "issues_found": len(issues),
        "issues": issues,
    }


async def _analyze_reference_video(
    client: genai.Client,
    drive_link: str,
    job_id: str,
) -> Dict:
    """
    Phase 0 — Download and deeply analyse the reference (benchmark) video.
    Returns a structured dict describing its pedagogy, scope, concepts, and style.
    Stores the result in the job document under 'reference_analysis'.
    """
    db = get_db()
    loop = asyncio.get_running_loop()
    video_path = None
    video_file = None

    await db.jobs.update_one(
        {"_id": ObjectId(job_id)},
        {"$set": {"reference_analysis_status": "analyzing"}},
    )

    try:
        print(f"[Job {job_id}] Reference video: downloading...")
        video_path = await loop.run_in_executor(None, lambda: download_video(drive_link))

        print(f"[Job {job_id}] Reference video: uploading to Gemini...")
        video_file = await loop.run_in_executor(
            None, lambda: client.files.upload(file=video_path)
        )

        while video_file.state.name == "PROCESSING":
            await asyncio.sleep(3)
            file_name = video_file.name
            video_file = await loop.run_in_executor(
                None, lambda: client.files.get(name=file_name)
            )

        if video_file.state.name == "FAILED":
            raise RuntimeError("Gemini file processing failed for reference video")

        print(f"[Job {job_id}] Reference video: running deep analysis...")
        response = await loop.run_in_executor(
            None,
            lambda: client.models.generate_content(
                model=MODEL_NAME,
                contents=[video_file, REFERENCE_ANALYSIS_PROMPT],
                config=types.GenerateContentConfig(
                    temperature=0.05,
                    top_p=0.95,
                    max_output_tokens=8192,
                ),
            ),
        )

        # Parse JSON from response
        analysis = {}
        fence = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", response.text)
        if fence:
            try:
                analysis = json.loads(fence.group(1))
            except Exception:
                pass
        if not analysis:
            obj = re.search(r"\{[\s\S]*\}", response.text)
            if obj:
                try:
                    analysis = json.loads(obj.group())
                except Exception:
                    pass
        if not analysis:
            analysis = {"raw": response.text}

        await db.jobs.update_one(
            {"_id": ObjectId(job_id)},
            {
                "$set": {
                    "reference_analysis": analysis,
                    "reference_analysis_status": "completed",
                }
            },
        )
        print(f"[Job {job_id}] Reference video: analysis complete.")
        return analysis

    except Exception as exc:
        print(f"[Job {job_id}] Reference video analysis failed: {exc}")
        traceback.print_exc()
        await db.jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"reference_analysis_status": "failed", "reference_analysis_error": str(exc)}},
        )
        return {}

    finally:
        if video_file and client:
            try:
                file_name = video_file.name
                loop = asyncio.get_running_loop()
                await loop.run_in_executor(None, lambda: client.files.delete(name=file_name))
            except Exception:
                pass
        if video_path and os.path.exists(video_path):
            try:
                os.remove(video_path)
            except Exception:
                pass


async def _process_single_video(
    job_id: str,
    video_index: int,
    drive_link: str,
    api_key: str,
    grade: Optional[str] = None,
    include_suggestions: bool = True,
    reference_analysis: Optional[Dict] = None,
):
    db = get_db()
    video_path = None
    video_file = None
    client = None

    # Mark as processing
    await db.jobs.update_one(
        {"_id": ObjectId(job_id)},
        {
            "$set": {
                f"videos.{video_index}.status": "processing",
                f"videos.{video_index}.started_at": datetime.utcnow(),
            }
        },
    )

    try:
        client = genai.Client(api_key=api_key)
        loop = asyncio.get_running_loop()

        # ── 1. Download ──────────────────────────────────────────────────────
        print(f"[Job {job_id}] Video {video_index}: downloading...")
        video_path = await loop.run_in_executor(None, lambda: download_from_drive(drive_link))

        # ── 2. Upload to Gemini ──────────────────────────────────────────────
        print(f"[Job {job_id}] Video {video_index}: uploading to Gemini...")
        video_file = await loop.run_in_executor(
            None, lambda: client.files.upload(file=video_path)
        )

        # Wait for Gemini to finish processing
        while video_file.state.name == "PROCESSING":
            await asyncio.sleep(3)
            file_name = video_file.name
            video_file = await loop.run_in_executor(
                None, lambda: client.files.get(name=file_name)
            )

        if video_file.state.name == "FAILED":
            raise RuntimeError("Gemini file processing failed")

        # ── 3. Extract transcript ────────────────────────────────────────────
        print(f"[Job {job_id}] Video {video_index}: extracting transcript...")
        t_response = await loop.run_in_executor(
            None,
            lambda: client.models.generate_content(
                model=MODEL_NAME,
                contents=[video_file, "Provide a verbatim transcript with timestamps for every sentence."],
                config=types.GenerateContentConfig(max_output_tokens=8192),
            ),
        )
        transcript = t_response.text

        # Persist transcript snippet
        await db.jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {f"videos.{video_index}.transcript": transcript[:6000]}},
        )

        # ── 4. Three-pass review ─────────────────────────────────────────────
        passes: List[Dict] = []
        for pass_num in range(1, 4):
            rigor = _determine_rigor(pass_num, passes)
            print(
                f"[Job {job_id}] Video {video_index}: Pass {pass_num} ({rigor})..."
            )
            result = await _run_pass(
                client, video_file, pass_num, rigor, transcript,
                grade=grade,
                include_suggestions=include_suggestions,
                previous_passes=passes,   # passes accumulated so far
                reference_analysis=reference_analysis,
            )
            passes.append(result)

            # Stream pass result into DB so UI can show progress
            await db.jobs.update_one(
                {"_id": ObjectId(job_id)},
                {"$push": {f"videos.{video_index}.passes": result}},
            )
            print(
                f"[Job {job_id}] Video {video_index}: Pass {pass_num} → {result['issues_found']} issue(s)"
            )

        # ── 5. Combine & finalise ────────────────────────────────────────────
        combined = _combine_issues(passes)
        await db.jobs.update_one(
            {"_id": ObjectId(job_id)},
            {
                "$set": {
                    f"videos.{video_index}.status": "completed",
                    f"videos.{video_index}.combined_issues": combined,
                    f"videos.{video_index}.total_issues": len(combined),
                    f"videos.{video_index}.completed_at": datetime.utcnow(),
                },
                "$inc": {
                    "completed_videos": 1,
                    "total_issues": len(combined),
                },
            },
        )
        print(f"[Job {job_id}] Video {video_index}: ✅ done — {len(combined)} combined issue(s)")

    except Exception as exc:
        print(f"[Job {job_id}] Video {video_index}: ❌ {exc}")
        traceback.print_exc()
        await db.jobs.update_one(
            {"_id": ObjectId(job_id)},
            {
                "$set": {
                    f"videos.{video_index}.status": "failed",
                    f"videos.{video_index}.error": str(exc),
                    f"videos.{video_index}.completed_at": datetime.utcnow(),
                },
                "$inc": {"completed_videos": 1},
            },
        )
    finally:
        # Always clean up
        if video_file and client:
            try:
                file_name = video_file.name
                loop = asyncio.get_running_loop()
                await loop.run_in_executor(None, lambda: client.files.delete(name=file_name))
            except Exception:
                pass
        if video_path and os.path.exists(video_path):
            try:
                os.remove(video_path)
            except Exception:
                pass


async def process_review_job(
    job_id: str,
    drive_links: List[str],
    api_key: str,
    grade: Optional[str] = None,
    include_suggestions: bool = True,
    reference_drive_link: Optional[str] = None,
):
    """
    Entry point for background processing.
    If a reference_drive_link is provided, Phase 0 analyses it first and the
    resulting analysis is injected into every video's 3-pass review prompts.
    Videos are processed sequentially (one at a time); each video runs its 3 passes sequentially.
    """
    db = get_db()
    await db.jobs.update_one(
        {"_id": ObjectId(job_id)}, {"$set": {"status": "processing"}}
    )

    print(f"[Job {job_id}] Starting — {len(drive_links)} video(s)")

    # ── Phase 0: Reference video analysis (optional) ──────────────────────────
    reference_analysis: Optional[Dict] = None
    if reference_drive_link:
        print(f"[Job {job_id}] Phase 0: analysing reference video...")
        client = genai.Client(api_key=api_key)
        reference_analysis = await _analyze_reference_video(client, reference_drive_link, job_id)

    for i, link in enumerate(drive_links):
        await _process_single_video(
            job_id, i, link, api_key,
            grade=grade,
            include_suggestions=include_suggestions,
            reference_analysis=reference_analysis,
        )

    # Determine final status
    job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    videos = job.get("videos", [])
    all_failed = all(v.get("status") == "failed" for v in videos)
    final_status = "failed" if all_failed else "completed"

    await db.jobs.update_one(
        {"_id": ObjectId(job_id)},
        {"$set": {"status": final_status, "completed_at": datetime.utcnow()}},
    )
    print(f"[Job {job_id}] Job {final_status}.")
