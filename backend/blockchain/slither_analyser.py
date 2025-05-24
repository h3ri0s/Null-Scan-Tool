import subprocess
import os

def run_slither(contract_file):
    if not os.path.isfile(contract_file):
        print(f"❌ Error: Contract file '{contract_file}' not found.")
        return

    try:
        result = subprocess.run(
            ["slither", contract_file],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        print("📤 Slither Output:")
        print(result.stdout)

        if result.stderr:
            print("⚠️ Slither Warnings/Errors:")
            print(result.stderr)

        return result.stdout
    except Exception as e:
        print("❌ Error:", e)
        return ""