import json
from pathlib import Path
import os
import google.generativeai as genai
from typing import Optional
from ..ai.inference import prompt_ai

genai.configure(api_key=os.getenv("GOOGLE_API_KEY", ""))

REPORT_PATH = Path("../reports/source_review_report.json")
CONFIG_EXTENSIONS = {".json", ".yaml", ".yml", ".toml", ".ini", ".cfg"}

def read_source_code(path: Path) -> str:
    if not path.is_file():
        raise FileNotFoundError(f"File not found: {path}")
    return path.read_text(errors="ignore")

def review_source_code(source_code: Optional[str]=None, filename: str= "", prompt: str="") -> str:
    return prompt_ai(
        source_code=source_code,
        filename=filename,
        prompt=prompt,
        model_name="gemini-2.0-flash"
    )

def gather_all_files(directory: Path):
    return [f for f in directory.rglob("*") if f.is_file()]

def run_review(dir_path: str):
    base_path = Path(dir_path)
    if not base_path.is_dir():
        raise NotADirectoryError(f"Provided path is not a directory: {dir_path}")

    all_files = gather_all_files(base_path)

    config_files = [f for f in all_files if f.suffix.lower() in CONFIG_EXTENSIONS]
    other_files = [f for f in all_files if f.suffix.lower() not in CONFIG_EXTENSIONS]

    reports = {}

    for file_path in config_files + other_files:
        try:
            code = read_source_code(file_path)
            print(f"🔍 Reviewing: {file_path}")
            review = review_source_code(code, str(file_path))
            reports[str(file_path)] = review
        except Exception as e:
            print(f"❌ Error reviewing {file_path}: {e}")
            reports[str(file_path)] = f"Error: {e}"

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    print(reports)
    with open(REPORT_PATH, "w") as f:
        json.dump(reports, f, indent=2)

    print(f"\n✅ Review report saved to: {REPORT_PATH}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python review_script.py <directory_path>")
        sys.exit(1)

    directory_to_review = sys.argv[1]
    try:
        run_review(directory_to_review)
    except Exception as e:
        print(f"❌ Error: {e}")
