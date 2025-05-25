import subprocess
import os
import datetime
import json
import sys
import google.generativeai as genai

GEMINI_API_KEY = os.environ.get("GOOGLE_API_KEY", "")
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-2.0-flash')

def get_current_timestamp():
  return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def read_contract_code(filepath):
  try:
    with open(filepath, 'r') as f:
      return f.read()
  except Exception as e:
    print(f"❌ Error reading contract file: {str(e)}")
    return None

def run_slither(contract_file, output_file="analysis_report.json"):
  try:
    result = subprocess.run(
      ["slither", contract_file, "--json", output_file],
      stdout=subprocess.PIPE,
      stderr=subprocess.PIPE,
      text=True
    )
    if os.path.isfile(output_file) and os.path.getsize(output_file) > 0:
      return output_file
    else:
      print("⚠️ Slither did not produce JSON output.")
      print(result.stderr)
      return None
  except subprocess.CalledProcessError as e:
    print(f"❌ Slither error: {e.stderr}")
    return None

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
    print(f"❌ Gemini AI error: {str(e)}")
    return None

def analyze_and_patch(contract_file):
  output_file = run_slither(contract_file)
  if not output_file:
    return {"error": "Slither analysis failed."}

  try:
    with open(output_file, 'r') as f:
      slither_results = json.load(f)
  except Exception as e:
    return {"error": f"Error reading Slither results: {str(e)}"}

  contract_code = read_contract_code(contract_file)
  if not contract_code:
    return {"error": "Failed to read contract code."}

  detectors = slither_results.get('results', {}).get('detectors', [])
  result_summary = {
    "file": contract_file,
    "timestamp": get_current_timestamp(),
    "vulnerabilities": []
  }

  for i, detector in enumerate(detectors, 1):
    description = detector.get("description", "")
    patch = get_ai_patch(contract_code, description)
    result_summary["vulnerabilities"].append({
      "id": i,
      "type": detector.get("check", "N/A"),
      "impact": detector.get("impact", "N/A"),
      "description": description,
      "patch": patch or "Could not generate patch"
    })

  return result_summary
