import argparse
from dotenv import load_dotenv
from utils.config_loader import (
  get_default_source_path,
  validate_args,
  load_config,
  get_guided_input
)
from agent.source_review import run_review

load_dotenv()

def main():
  parser = argparse.ArgumentParser(
    description="Network Scanner CLI",
    epilog="Examples:\n"
           "  python -m agent.agent --target 192.168.1.1 --ports 1-1000 --source-file /var/www/html/modules.txt\n"
           "  python -m agent.agent --conf\n"
           "  python -m agent.agent --guided",
    formatter_class=argparse.RawDescriptionHelpFormatter
  )
  parser.add_argument("--target", default="localhost")
  parser.add_argument("--ports", default="1-65535")
  parser.add_argument("--source-file", default=get_default_source_path())
  parser.add_argument("--conf", action="store_true")
  parser.add_argument("--guided", action="store_true")

  args = parser.parse_args()

  if args.conf and args.guided:
    parser.error("Cannot use both --conf and --guided")

  if any([
    args.target != parser.get_default("target"),
    args.ports != parser.get_default("ports"),
    args.source_file != parser.get_default("source_file")
  ]):
    try:
      validate_args(args)
      config = {
        "target": args.target.lower(),
        "ports": args.ports,
        "source_file": args.source_file
      }
    except ValueError as e:
      print(f"Error: {e}")
      return
  elif args.conf:
    config = load_config()
    if not config:
      print("Falling back to guided input due to invalid config")
      config = get_guided_input()
  else:
    config = get_guided_input()

  print("\nConfiguration collected:")
  print(f"Target: {config['target']}")
  print(f"Ports: {config['ports']}")
  print(f"Source File: {config['source_file'] or 'None'}")
  
  try:
      run_review(config['source_file'])
  except Exception as e:
      print(f"⚠️ Source review failed: {e}")

if __name__ == "__main__":
  main()
