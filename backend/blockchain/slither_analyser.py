import subprocess
import os
import datetime
import json
import sys
import google.generativeai as genai

# -----------------------------
# Configuration
# -----------------------------

contract_file = "contract.sol"
slither_output_file = "analysis_report.json"
GEMINI_API_KEY = os.environ.get("GOOGLE_API_KEY", "")  # Set your Gemini API key as an env var

if not GEMINI_API_KEY:
    print("❌ Please set the GOOGLE_API_KEY environment variable.")
    sys.exit(1)

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-2.0-flash')

# -----------------------------
# Utility Functions
# -----------------------------

def print_banner():
    print("=" * 60)
    print("        🔎 Solidity Static Analysis: SLITHER + Gemini AI")
    print("=" * 60)

def get_file_size(filepath):
    return os.path.getsize(filepath) if os.path.isfile(filepath) else 0

def get_current_timestamp():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def print_analysis_header(filename):
    print(f"\n📄 Analyzing File: {filename}")
    size = get_file_size(filename)
    print(f"📦 File Size: {size} bytes")
    print(f"⏰ Timestamp: {get_current_timestamp()}")
    print("-" * 60)

def read_contract_code(filepath):
    try:
        with open(filepath, 'r') as f:
            return f.read()
    except Exception as e:
        print(f"❌ Error reading contract file: {str(e)}")
        return None

# -----------------------------
# Slither Analysis
# -----------------------------

def check_slither_version():
    try:
        result = subprocess.run(
            ["slither", "--version"],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        print(f"🧪 Slither Version: {result.stdout.strip()}")
    except Exception:
        print("⚠️ Unable to retrieve Slither version.")

def run_slither(contract_file):
    print("\n📘 Starting Slither Analysis...")

    if not os.path.isfile(contract_file):
        print(f"❌ Error: Contract file '{contract_file}' not found.")
        return None

    print_analysis_header(contract_file)

    try:
        result = subprocess.run(
            ["slither", contract_file, "--json", slither_output_file],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        if os.path.isfile(slither_output_file) and os.path.getsize(slither_output_file) > 0:
            print(f"✅ JSON analysis saved to '{slither_output_file}'")
            return slither_output_file
        else:
            print("⚠️ Slither did not produce expected JSON output.")
            if result.stderr:
                print("\n⚠️ Slither stderr:\n" + result.stderr)
            return None

    except subprocess.CalledProcessError as e:
        print("❌ Critical error during Slither execution:")
        print(e.stderr)
        return None

# -----------------------------
# Gemini AI Patch
# -----------------------------

def get_ai_patch(contract_code, vulnerability):
    prompt = f"""
I have a Solidity smart contract with the following vulnerability:
{vulnerability}

Here is the contract code:
{contract_code}

Please provide:
1. A detailed explanation of the vulnerability
2. The patched version of the code
3. Security best practices to prevent this issue

Format your response with clear headings for each section.
"""
    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"❌ Error calling Gemini AI: {str(e)}")
        return None

# -----------------------------
# Main Analysis Workflow
# -----------------------------

def analyze_and_patch():
    report_file = run_slither(contract_file)
    if not report_file:
        return

    try:
        with open(report_file, 'r') as f:
            slither_results = json.load(f)
    except Exception as e:
        print(f"❌ Error reading Slither results: {str(e)}")
        return

    contract_code = read_contract_code(contract_file)
    if not contract_code:
        return

    detectors = slither_results.get('results', {}).get('detectors', [])

    if detectors:
        print("\n🔍 Found Vulnerabilities:")
        for i, detector in enumerate(detectors, 1):
            print(f"\n🛑 Vulnerability {i}:")
            print(f"• Type: {detector.get('check', 'N/A')}")
            print(f"• Severity: {detector.get('impact', 'N/A')}")
            print(f"• Description: {detector.get('description', 'N/A')}")

            print("\n🤖 Consulting Gemini AI for patch...")
            patch = get_ai_patch(contract_code, detector.get('description', ''))
            if patch:
                print("\n💡 Gemini AI Recommendation:")
                print(patch)
            else:
                print("⚠️ Could not get AI patch suggestion")
            print("-" * 60)
    else:
        print("\n✅ No vulnerabilities found!")

# -----------------------------
# Entrypoint
# -----------------------------

def main():
    print_banner()
    check_slither_version()
    analyze_and_patch()
    print("\n🏁 Analysis complete.")
    print("=" * 60)

if __name__ == "__main__":
    main()
