import re
import os
import uuid
import subprocess
import requests
from typing import Optional


def extract_file_id(url: str) -> Optional[str]:
    """Extract Google Drive file ID from various URL formats."""
    patterns = [
        r"[?&]id=([a-zA-Z0-9_-]+)",
        r"/file/d/([a-zA-Z0-9_-]+)",
        r"/d/([a-zA-Z0-9_-]+)",
        r"open\?id=([a-zA-Z0-9_-]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def get_drive_filename(url: str) -> Optional[str]:
    """
    Fetch just the filename for a Drive link by reading the Content-Disposition
    header — no body download needed.  Returns None on any failure.
    """
    file_id = extract_file_id(url)
    if not file_id:
        return None
    try:
        r = requests.get(
            f"https://drive.google.com/uc?export=download&id={file_id}",
            stream=True, timeout=5, allow_redirects=True,
        )
        r.close()
        cd = r.headers.get("Content-Disposition", "")
        m = re.search(r'filename\*?=(?:UTF-8\'\')?["\']?([^"\';\r\n]+)', cd, re.IGNORECASE)
        if m:
            name = m.group(1).strip().strip('"\'')
            # Strip file extension for display
            return re.sub(r'\.[^.]{2,5}$', '', name).strip() or None
    except Exception:
        pass
    return None


def download_from_drive(url: str) -> str:
    """
    Download a Google Drive shared file to a unique temp path.
    Handles both the legacy cookie-based confirmation (old Drive behaviour)
    and the current HTML-page confirmation (new Drive behaviour for large files).
    Returns the local file path.
    """
    file_id = extract_file_id(url)
    if not file_id:
        raise ValueError(f"Could not extract file ID from URL: {url}")

    os.makedirs("/tmp/video_reviews", exist_ok=True)
    dest = f"/tmp/video_reviews/{uuid.uuid4()}.mp4"

    session = requests.Session()
    download_url = f"https://drive.google.com/uc?export=download&id={file_id}"

    response = session.get(download_url, stream=True, timeout=60)

    if response.status_code != 200:
        raise ValueError(f"Failed to download: HTTP {response.status_code}")

    content_type = response.headers.get("Content-Type", "")

    if "text/html" in content_type:
        # Google returned a confirmation page — read it and extract the real URL.
        html = response.content.decode("utf-8", errors="replace")

        # 1. Legacy: confirm token in a download_warning cookie
        confirm_token = next(
            (v for k, v in response.cookies.items() if k.startswith("download_warning")),
            None,
        )
        if confirm_token:
            response = session.get(
                "https://drive.google.com/uc",
                params={"export": "download", "id": file_id, "confirm": confirm_token},
                stream=True,
                timeout=120,
            )
        else:
            # 2. Modern: confirmation URL is embedded in the HTML body.
            # Matches drive.usercontent.google.com/download?... or /uc?...confirm=...
            confirm_match = re.search(
                r'href="(https://drive\.usercontent\.google\.com/download\?[^"]+)"', html
            ) or re.search(
                r'href="(/uc\?[^"]*confirm=[^"&]+[^"]*)"', html
            )
            if not confirm_match:
                raise ValueError(
                    "Google Drive returned a confirmation page but no download link could be "
                    "extracted. Make sure the file is publicly shared ('Anyone with the link')."
                )
            confirm_url = confirm_match.group(1).replace("&amp;", "&")
            if not confirm_url.startswith("http"):
                confirm_url = "https://drive.google.com" + confirm_url
            response = session.get(confirm_url, stream=True, timeout=120)

    if response.status_code != 200:
        raise ValueError(f"Failed to download: HTTP {response.status_code}")

    with open(dest, "wb") as f:
        for chunk in response.iter_content(chunk_size=32768):
            if chunk:
                f.write(chunk)

    size_bytes = os.path.getsize(dest)
    if size_bytes < 1024:
        raise ValueError(
            f"Downloaded file is only {size_bytes} bytes — likely an HTML error page. "
            "Check that the Drive link is publicly shared and points to a valid video file."
        )

    size_mb = size_bytes / (1024 * 1024)
    print(f"Downloaded {size_mb:.1f} MB → {dest}")
    return dest


def _resolve_hls_url(url: str) -> str:
    """
    If the URL is a Kaltura (or similar) HLS segment (.ts), convert it to the
    manifest (.m3u8) so ffmpeg can download the full video instead of one chunk.

    Example input:  .../name/a.mp4/seg-42-v1-a1.ts?Policy=...
    Example output: .../name/a.mp4/index.m3u8?Policy=...
    """
    ts_pattern = re.compile(r"/seg-\d+[^?]*\.ts", re.IGNORECASE)
    if ts_pattern.search(url):
        url = ts_pattern.sub("/index.m3u8", url)
        print(f"Resolved .ts segment URL → .m3u8 manifest: {url[:100]}…")
    return url


def download_video(url: str) -> str:
    """
    Universal video downloader.
    - Google Drive URLs       → download_from_drive()
    - HLS streams (.m3u8)     → ffmpeg (remux segments into MP4)
    - Kaltura .ts segments    → converted to .m3u8 first, then ffmpeg
    - Direct video URLs       → streaming HTTP download
    Returns the local file path.
    """
    # Google Drive
    if extract_file_id(url):
        return download_from_drive(url)

    # Resolve a bare .ts segment URL to its .m3u8 manifest
    url = _resolve_hls_url(url)

    os.makedirs("/tmp/video_reviews", exist_ok=True)
    dest = f"/tmp/video_reviews/{uuid.uuid4()}.mp4"

    # HLS stream
    if ".m3u8" in url.lower():
        print(f"Downloading HLS stream via ffmpeg: {url[:80]}…")
        result = subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", url,
                "-c", "copy",          # remux without re-encoding (fast)
                "-movflags", "+faststart",
                dest,
            ],
            capture_output=True,
            timeout=300,               # 5-minute limit
        )
        if result.returncode != 0:
            err = result.stderr.decode("utf-8", errors="replace")[-500:]
            raise RuntimeError(f"ffmpeg failed downloading HLS stream: {err}")
        size_mb = os.path.getsize(dest) / (1024 * 1024)
        print(f"HLS download complete: {size_mb:.1f} MB → {dest}")
        return dest

    # Direct HTTP download (mp4, webm, etc.)
    print(f"Direct HTTP download: {url[:80]}…")
    response = requests.get(url, stream=True, timeout=120)
    if response.status_code != 200:
        raise ValueError(f"Failed to download reference video: HTTP {response.status_code}")
    with open(dest, "wb") as f:
        for chunk in response.iter_content(chunk_size=32768):
            if chunk:
                f.write(chunk)
    size_mb = os.path.getsize(dest) / (1024 * 1024)
    print(f"Downloaded {size_mb:.1f} MB → {dest}")
    return dest
