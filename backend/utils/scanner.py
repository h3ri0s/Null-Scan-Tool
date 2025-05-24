from config_loader import (
  get_guided_input,
  load_config,
  get_default_source_path,
)

def review_source(config):
  print(f"[•] Reviewing source at: {config['source_file']}")
  try:
    from pathlib import Path
    files = list(Path(config['source_file']).rglob("*.php"))
    print(f"[✓] Found {len(files)} source files")
    for file in files:
      print(f"  - {file}")
  except Exception as e:
    print(f"[!] Error reading source: {e}")

def main():
  config = load_config()
  if not config:
    print("[!] No config found. Launching guided mode.")
    config = get_guided_input()
  review_source(config)

if __name__ == "__main__":
  main()
