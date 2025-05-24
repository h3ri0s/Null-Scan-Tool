import socket
import json

def validate_target(target: str) -> bool:
    try:
        socket.gethostbyname(target)
        return True
    except socket.error:
        return False

def save_json(data: dict, filename: str):
    with open(filename, "w") as f:
        json.dump(data, f, indent=4)
