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
from app.services.drive import download_from_drive


MODEL_NAME = "gemini-2.5-flash"


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

5. LANGUAGE & TERMINOLOGY
   Concepts and terms should be introduced and referred to consistently using
   proper, age-appropriate language throughout the video. Prefer full words
   over symbols or abbreviations when introducing a concept for the first time.
   Spoken language must match on-screen text — flag any discrepancy.

6. TEXT & VISUAL FORMATTING
   On-screen text must be grammatically correct, properly punctuated, and
   consistently formatted. Check: capitalisation, punctuation in titles and
   labels, alignment of columns or equations, readability of font sizes, and
   that all visual elements are large enough to be clearly seen.

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
"""


# ── Helpers ───────────────────────────────────────────────────────────────────

def extract_json(text: str) -> List[Dict]:
    """Extract a JSON array from Gemini's response (handles markdown code fences)."""
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


def _rigor_prompt(
    rigor: str,
    transcript: str,
    grade: Optional[str] = None,
    include_suggestions: bool = True,
) -> str:
    grade_block = ""
    if grade:
        grade_block = f"""
GRADE CONTEXT: This video is designed for {grade} students.
Calibrate your assessment accordingly:
- Use age-appropriate expectations for vocabulary, concept complexity, and prior knowledge.
- Flag pacing or cognitive load issues that would be problematic specifically for {grade} learners.
- Sequencing issues (e.g. skipped scaffolding, premature abstraction) should be judged relative to what {grade} students can reasonably be expected to know.
"""

    output_keys = "timestamp, category, description, suggestion" if include_suggestions else "timestamp, category, description"
    suggestion_note = "" if include_suggestions else "\n  Do NOT include a 'suggestion' key — omit it entirely."

    base = f"""
TRANSCRIPT (ground truth for audio):
{transcript}
{grade_block}
{REVIEW_DIMENSIONS}

OUTPUT: Return ONLY a JSON array. Each element must have keys:
  {output_keys}{suggestion_note}
If there are no issues return an empty array [].
"""
    if rigor == "standard":
        return f"""
You are a Senior QA Specialist reviewing an educational video.

{base}

Apply all 12 REVIEW DIMENSIONS above. Confidence threshold: 90%.
"""
    elif rigor == "enhanced":
        return f"""
You are a Senior QA Specialist with eagle-eye attention to detail.
The previous review found ZERO issues, so you must look DEEPER.

{base}

Apply all 12 REVIEW DIMENSIONS above with extra focus on:
- Subtle timing gaps (even 1–2 seconds) between audio and visual.
- Inconsistencies in how terms or values are written vs spoken.
- Elements appearing or disappearing at the wrong moment.
- Steps skipped without acknowledgement.
- Sequencing issues: does the visual order match the stated problem order?
- Cognitive load: are too many elements on screen simultaneously?

Confidence threshold: 80%.
"""
    else:  # maximum
        return f"""
You are the Chief QA Director with 20+ years of educational content review.
Two previous reviews found ZERO issues. Apply MAXIMUM scrutiny.

{base}

Apply all 12 REVIEW DIMENSIONS above as an explicit checklist. Additionally:
- Frame-level accuracy: every value and symbol visible on screen.
- Font, contrast, and readability for all learners.
- Recording artifacts: glitches, stray cursors, screen transitions.
- Pacing: is the narrator too fast or too slow at any point?
- Terminology consistency throughout the entire video.
- Pedagogical sequencing: does every demonstration follow the stated problem order?
- Working memory: count simultaneous on-screen elements at each step.

Confidence threshold: 70%.
"""


def _determine_rigor(pass_number: int, previous_passes: List[Dict]) -> str:
    """Always escalate rigor with each pass, regardless of previous results."""
    return {1: "standard", 2: "enhanced", 3: "maximum"}[pass_number]


def _combine_issues(passes: List[Dict]) -> List[Dict]:
    """Merge issues from all passes, deduplicating by description similarity."""
    combined = []
    seen = set()

    for p in passes:
        for issue in p.get("issues", []):
            desc = issue.get("description", "").lower().strip()
            key = desc[:60]
            if key and key not in seen:
                combined.append(issue)
                seen.add(key)

    def _ts_key(item):
        ts = item.get("timestamp", "") or ""
        parts = re.split(r"[:.]", ts)
        try:
            if len(parts) >= 2:
                return int(parts[0]) * 60 + int(parts[1])
        except Exception:
            pass
        return 9999

    return sorted(combined, key=_ts_key)


# ── Core review logic ─────────────────────────────────────────────────────────

async def _run_pass(
    client: genai.Client,
    video_file,
    pass_number: int,
    rigor: str,
    transcript: str,
    grade: Optional[str] = None,
    include_suggestions: bool = True,
) -> Dict:
    temperature = {"standard": 0.10, "enhanced": 0.05, "maximum": 0.01}[rigor]
    prompt = _rigor_prompt(rigor, transcript, grade=grade, include_suggestions=include_suggestions)
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
    issues = extract_json(response.text)
    return {
        "pass_number": pass_number,
        "rigor_level": rigor,
        "issues_found": len(issues),
        "issues": issues,
    }


async def _process_single_video(
    job_id: str,
    video_index: int,
    drive_link: str,
    api_key: str,
    grade: Optional[str] = None,
    include_suggestions: bool = True,
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
            result = await _run_pass(client, video_file, pass_num, rigor, transcript, grade=grade, include_suggestions=include_suggestions)
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
):
    """
    Entry point for background processing.
    Videos are processed sequentially (one at a time); each video runs its 3 passes sequentially.
    """
    db = get_db()
    await db.jobs.update_one(
        {"_id": ObjectId(job_id)}, {"$set": {"status": "processing"}}
    )

    print(f"[Job {job_id}] Starting — {len(drive_links)} video(s)")

    for i, link in enumerate(drive_links):
        await _process_single_video(job_id, i, link, api_key, grade=grade, include_suggestions=include_suggestions)

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
