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


# ── Human-curated issue patterns ──────────────────────────────────────────────
# Extracted from manual reviews of 20 videos. These teach the model to catch
# issue types it consistently missed.

HUMAN_FEEDBACK_PATTERNS = """
KNOWN ISSUE PATTERNS (from past human reviews — actively look for these):

TITLE & TEXT FORMATTING:
- Colon missing in topic title before subtitle text (e.g. "Comparing Expressions" → "Comparing Expressions: Two Expressions")
- Ordinal numbers written as abbreviations in on-screen text instead of words (e.g. "5th" should be "fifth")

PRONUNCIATION & LANGUAGE:
- Decimals spoken as "zero point one" / "zero point zero one" instead of "one tenth" / "one hundredth"
- Mathematical operation symbols introduced as symbols rather than words (e.g. "+" shown/said instead of "addition")
- Videos should include at least one example where numbers are written in words (not digits)

PRE-POPULATION ISSUES:
- Numbers, decimals, or answers appearing on screen before the narrator introduces them
- All elements should appear progressively as the narrator speaks them — nothing pre-filled
- Values highlighted or coloured before the narrator discusses them (e.g. answer highlighted from question start)

HIGHLIGHTING & ANIMATION TIMING:
- Elements highlighted at wrong timestamps (too early or too late relative to narration)
- Too many colours used simultaneously — cognitive overload for students
- Over-highlighting of symbols
- When the focus is on an expression inside parentheses: parentheses must be highlighted, NOT removed
- Bounding boxes or visual frames appearing before they are introduced in narration
- Numbers or values highlighted at the wrong moment (e.g. 5 and 12 highlighted before they are referenced)

MATHEMATICAL ACCURACY:
- Incorrect rounding (verify which digit is used and the rounding direction)
- Showing intermediate or incorrect values that should not appear (e.g. 3.155 when only 3.15 should be shown)
- Decimal points not aligned in vertical arithmetic (addition/subtraction columns)
- Showing a rounded/partial result alongside a full result when only one should be visible

PEDAGOGICAL STRUCTURE:
- Multiple consecutive examples using the same teaching approach with no variety
- Examples that appear identical or nearly identical to external sources (e.g. IXL)
- MCQ / multiple-choice options shown when the student should be guided to construct the answer
- Examples ordered in wrong difficulty progression (harder before easier)
- Missing explanation of a core concept that was introduced (e.g. how parentheses change order of operations)
- Key terms in word problems not highlighted or explained before being used in expressions
- Numbers taken from a word problem used without describing what each number represents

CONTENT COMPLETENESS & EXAMPLE DIVERSITY:
- Intro section is unnecessarily long and should be trimmed (flag with start/end timestamps)
- Placeholder zeros not highlighted or animated when added during decimal operations
- Number lines missing step-by-step count markers (e.g. counting 1–10 for tenths representation)
- Diagrams or models too small to be clearly visible to students
- All examples use only small numbers — at least one example should use large numbers (e.g. 3+ digits before decimal, 4+ after)
- Examples lack diversity in number types (missing word-form numbers, missing large-scale numbers)
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


def _rigor_prompt(rigor: str, transcript: str) -> str:
    base = f"""
TRANSCRIPT (ground truth for audio):
{transcript}

{HUMAN_FEEDBACK_PATTERNS}

OUTPUT: Return ONLY a JSON array. Each element must have keys:
  timestamp, category, description, suggestion
If there are no issues return an empty array [].
"""
    if rigor == "standard":
        return f"""
You are a Senior QA Specialist reviewing an educational video.

{base}

CHECKLIST:
1. MATH ACCURACY — verify every calculation and formula on screen.
2. AUDIO-VISUAL MISMATCH — compare what the speaker says (transcript) with what is shown.
3. GRAMMAR & SPELLING — catch typos in on-screen text or grammatical errors in narration.
4. LOGICAL FLOW — flag any explanation that is out of order or confusing.
5. KNOWN PATTERNS — flag any issue matching the KNOWN ISSUE PATTERNS listed above.

Confidence threshold: 90%.
"""
    elif rigor == "enhanced":
        return f"""
You are a Senior QA Specialist with eagle-eye attention to detail.
The previous review found ZERO issues, so you must look DEEPER.

{base}

ENHANCED CHECKLIST:
1. SUBTLE TIMING — even 1–2 second delays between audio and visual highlights.
2. NOTATION — inconsistent ways of writing numbers, fractions, or symbols vs speech.
3. SOFT PRONUNCIATION — words slightly mispronounced that change meaning.
4. COLOR CODING — wrong colors in diagrams or highlighted text.
5. MISSING LABELS/UNITS — equations or graphs missing proper labels.
6. VISUAL CONTINUITY — elements appearing/disappearing at the wrong moment.
7. DEFINITION ACCURACY — are technical terms defined correctly?
8. STEP SKIPPING — any solution steps missing that could confuse students?
9. KNOWN PATTERNS — re-check every item in the KNOWN ISSUE PATTERNS listed above.

Confidence threshold: 80%.
"""
    else:  # maximum
        return f"""
You are the Chief QA Director with 20+ years of educational content review.
Two previous reviews found ZERO issues. Apply MAXIMUM scrutiny.

{base}

MAXIMUM CHECKLIST:
1. FRAME-LEVEL ACCURACY — every number, symbol, and operator visible on screen.
2. MICRO-INCONSISTENCIES — smallest formatting differences that could confuse students.
3. FONT & CONTRAST — text that is hard to read, too small, or poorly contrasted.
4. BACKGROUND DISTRACTIONS — audio or visual elements that distract from content.
5. ACCESSIBILITY — contrast ratios, text size, readability for all learners.
6. PEDAGOGICAL SEQUENCING — is the teaching order optimal? Any missed teaching moments?
7. PACING — narrator too fast or too slow at any specific point?
8. TERMINOLOGY CONSISTENCY — same terms used consistently throughout?
9. RECORDING ARTIFACTS — visual glitches, cursor distractions, screen artifacts.
10. CONTENT COMPLETENESS — any concept introduced but not resolved?
11. KNOWN PATTERNS — apply every item in the KNOWN ISSUE PATTERNS above as an explicit checklist.

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
) -> Dict:
    temperature = {"standard": 0.10, "enhanced": 0.05, "maximum": 0.01}[rigor]
    prompt = _rigor_prompt(rigor, transcript)
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
            result = await _run_pass(client, video_file, pass_num, rigor, transcript)
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


async def process_review_job(job_id: str, drive_links: List[str], api_key: str):
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
        await _process_single_video(job_id, i, link, api_key)

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
