import re
import os
import uuid
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
    Handles the virus-scan confirmation redirect for large files.
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

    # Handle Google's "large file" virus-scan confirmation cookie
    confirm_token = None
    for key, value in response.cookies.items():
        if key.startswith("download_warning"):
            confirm_token = value
            break

    if confirm_token:
        response = session.get(
            "https://drive.google.com/uc",
            params={"export": "download", "id": file_id, "confirm": confirm_token},
            stream=True,
            timeout=60,
        )

    if response.status_code != 200:
        raise ValueError(f"Failed to download: HTTP {response.status_code}")

    with open(dest, "wb") as f:
        for chunk in response.iter_content(chunk_size=32768):
            if chunk:
                f.write(chunk)

    size_mb = os.path.getsize(dest) / (1024 * 1024)
    print(f"Downloaded {size_mb:.1f} MB → {dest}")
    return dest
