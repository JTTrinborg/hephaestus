import re

################ TOOL THAT AGENTS CAN USE TO SPLIT SEEK JOB ALERTS INTO ONE CHUNK PER JOB ######################

SOURCES = {
    "seek": r"https://au\.seek\.com/job/\d+",
}


def split_alert(text: str, source: str = "seek") -> list[dict]:
    """Split a job alert into one chunk per job. Each chunk ends where its link starts."""
    chunks, start, seen = [], 0, set()
    for match in re.finditer(SOURCES[source], text):
        url = match.group(0)
        if url not in seen:
            seen.add(url)
            chunks.append({"url": url, "text": text[start:match.start()]})
        start = match.end()
    return chunks