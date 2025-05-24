from pathlib import Path
import json
import platform
from prompt_toolkit import PromptSession
from prompt_toolkit.validation import Validator, ValidationError
from prompt_toolkit.document import Document
import re

CONFIG_FILE = Path("../data/config.json")

def get_default_source_path():
    if platform.system() == "Linux" and Path("/etc/os-release").exists():
        with open("/etc/os-release", "r") as f:
            if "arch" in f.read().lower():
                return "/srv/http"
    return "/var/www/html"

def save_config(config):
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)

def load_config():
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r") as f:
                config = json.load(f)
            required_keys = {"target", "ports", "source_file"}
            if not all(key in config for key in required_keys):
                print("Invalid config file: missing keys")
                return {}
            target_validator = TargetValidator()
            port_validator = PortRangeValidator()
            file_validator = FilePathValidator()
            try:
                target_validator.validate(Document(config["target"]))
                port_validator.validate(Document(config["ports"]))
                file_validator.validate(Document(config["source_file"]))
            except ValidationError as e:
                print(f"Invalid config file: {e}")
                return {}
            return config
        except json.JSONDecodeError:
            print("Invalid config file: corrupted JSON")
            return {}
    return {}

def get_guided_input(config=None):
    session = PromptSession()
    config = config or load_config()
    use_saved = config and session.prompt(
        "Use saved configuration? (y/n): ",
        validator=YesNoValidator(),
        default="y"
    ).lower().startswith("y")
    if use_saved:
        return config

    config = {}
    config["target"] = session.prompt(
        "Enter target IP, hostname, or 'current': ",
        validator=TargetValidator(),
        default="localhost"
    ).lower()
    config["ports"] = session.prompt(
        "Enter port range: ",
        validator=PortRangeValidator(),
        default="1-65535"
    )
    config["source_file"] = session.prompt(
        "Enter source file path: ",
        validator=FilePathValidator(),
        default=get_default_source_path()
    )
    save = session.prompt(
        "Save this configuration? (y/n): ",
        validator=YesNoValidator(),
        default="y"
    ).lower().startswith("y")
    if save:
        save_config(config)
    return config

class TargetValidator(Validator):
    def validate(self, document):
        text = document.text.lower()
        if not text:
            raise ValidationError(message="Target cannot be empty")
        if text in ("current", "localhost"):
            return
        ip_pattern = r"^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"
        hostname_pattern = r"^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
        if re.match(ip_pattern, text) or re.match(hostname_pattern, text):
            return
        raise ValidationError(message="Invalid IP, hostname, or 'current'")

class PortRangeValidator(Validator):
    def validate(self, document):
        text = document.text
        if not text:
            return
        try:
            start, end = map(int, text.split("-"))
            if not (1 <= start <= end <= 65535):
                raise ValidationError(message="Ports must be between 1 and 65535")
        except ValueError:
            raise ValidationError(message="Invalid port range format (e.g., 1-65535)")

class FilePathValidator(Validator):
    def validate(self, document):
        text = document.text
        if not text:
            return
        if not Path(text).is_dir():
            raise ValidationError(message="Directory does not exist")

class YesNoValidator(Validator):
    def validate(self, document):
        text = document.text.lower()
        if text not in ("y", "n", "yes", "no"):
            raise ValidationError(message="Enter 'y' or 'n'")

def validate_args(args):
    if args.target:
        target = args.target.lower()
        ip_pattern = r"^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"
        hostname_pattern = r"^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
        if not (target in ("current", "localhost") or re.match(ip_pattern, target) or re.match(hostname_pattern, target)):
            raise ValueError(f"Invalid target: {args.target}")

    if args.ports:
        try:
            start, end = map(int, args.ports.split("-"))
            if not (1 <= start <= end <= 65535):
                raise ValueError("Ports must be between 1 and 65535")
        except ValueError:
            raise ValueError(f"Invalid port range: {args.ports}")

    if args.source_file and not Path(args.source_file).is_file():
        raise ValueError(f"Source file does not exist: {args.source_file}")