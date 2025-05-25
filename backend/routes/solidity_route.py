import traceback
from flask import Blueprint, request, jsonify
import subprocess
import os
import json
import datetime
from werkzeug.utils import secure_filename
from blockchain.slither_analyser import analyze_and_patch

solidity_bp = Blueprint('solidity', __name__, url_prefix='/api/solidity')

ALLOWED_EXTENSIONS = {'sol'}
UPLOAD_FOLDER = 'uploads/solidity'
MAX_FILE_SIZE = 16 * 1024 * 1024

def allowed_file(filename):
  return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def ensure_upload_folder():
  if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def get_current_timestamp():
  return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

@solidity_bp.route('/analyze', methods=['POST'])
def analyze_contract():
  try:
    ensure_upload_folder()

    if 'file' in request.files:
      file = request.files['file']
      if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
      if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{timestamp}_{filename}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)

        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)

        if file_size > MAX_FILE_SIZE:
          return jsonify({"error": "File too large. Max 16MB"}), 400

        file.save(filepath)
        results = analyze_and_patch(filepath)

        try: os.remove(filepath)
        except: pass

        return jsonify(results)
      else:
        return jsonify({"error": "Invalid file type. Only .sol allowed"}), 400

    elif request.is_json and 'contract_code' in request.json:
      contract_code = request.json['contract_code']
      contract_name = request.json.get('contract_name', 'contract.sol')

      if not contract_code.strip():
        return jsonify({"error": "Contract code cannot be empty"}), 400

      if not contract_name.endswith('.sol'):
        contract_name += '.sol'

      timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
      filename = f"{timestamp}_{secure_filename(contract_name)}"
      filepath = os.path.join(UPLOAD_FOLDER, filename)

      with open(filepath, 'w') as f:
        f.write(contract_code)

      results = analyze_and_patch(filepath)

      try: os.remove(filepath)
      except: pass

      return jsonify(results)
    else:
      return jsonify({"error": "No contract file or code provided"}), 400

  except Exception as e:
    traceback.print_exc()
    return jsonify({"error": f"Server error: {str(e)}"}), 500

@solidity_bp.route('/check-slither', methods=['GET'])
def check_slither():
  try:
    result = subprocess.run(
      ["slither", "--version"],
      stdout=subprocess.PIPE,
      stderr=subprocess.PIPE,
      text=True,
      timeout=10
    )
    return jsonify({
      "installed": True,
      "version": result.stdout.strip() if result.returncode == 0 else "Unknown",
      "status": "available"
    })
  except subprocess.TimeoutExpired:
    return jsonify({
      "installed": False,
      "error": "Slither check timed out",
      "status": "timeout"
    })
  except FileNotFoundError:
    return jsonify({
      "installed": False,
      "error": "Slither not found.",
      "status": "not_found"
    })
  except Exception as e:
    return jsonify({
      "installed": False,
      "error": f"Error checking Slither: {str(e)}",
      "status": "error"
    })

@solidity_bp.route('/health', methods=['GET'])
def health_check():
  return jsonify({
    "status": "healthy",
    "service": "Solidity Analysis API",
    "timestamp": get_current_timestamp()
  })

@solidity_bp.errorhandler(413)
def too_large(e):
  return jsonify({"error": "File too large"}), 413

@solidity_bp.errorhandler(500)
def internal_error(e):
  print("Error:", e)
  return jsonify({"error": "Internal server error"}), 500
