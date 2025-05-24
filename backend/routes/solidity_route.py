import traceback
from flask import Blueprint, request, jsonify
import subprocess
import os
import json
import tempfile
import datetime
from werkzeug.utils import secure_filename
from blockchain.slither_analyser import run_slither

# Create the blueprint
solidity_bp = Blueprint('solidity', __name__, url_prefix='/api/solidity')

# Configuration
ALLOWED_EXTENSIONS = {'sol'}
UPLOAD_FOLDER = 'uploads/solidity'
MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB max file size

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def ensure_upload_folder():
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)

def get_current_timestamp():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    """
    Runs Slither static analysis on the given Solidity contract file.
    Returns analysis results as JSON.
    """
    if not os.path.isfile(contract_file):
        return {"error": f"Contract file '{contract_file}' not found."}

    try:
        # Create temporary file for JSON output
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
            json_output_file = temp_file.name

        # Run Slither with JSON output
        result = subprocess.run(
            ["slither", contract_file, "--json", json_output_file],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=60  # 60 second timeout
        )

        # Check if JSON output was created
        analysis_results = {
            "timestamp": get_current_timestamp(),
            "contract_file": os.path.basename(contract_file),
            "file_size": os.path.getsize(contract_file),
            "slither_output": {},
            "stderr": result.stderr if result.stderr else None,
            "return_code": result.returncode
        }

        if os.path.isfile(json_output_file) and os.path.getsize(json_output_file) > 0:
            try:
                with open(json_output_file, 'r') as f:
                    analysis_results["slither_output"] = json.load(f)
                analysis_results["status"] = "success"
            except json.JSONDecodeError as e:
                analysis_results["status"] = "error"
                analysis_results["error"] = f"Failed to parse JSON output: {str(e)}"
        else:
            analysis_results["status"] = "warning"
            analysis_results["warning"] = "Slither did not produce expected JSON output"

        # Cleanup temporary file
        try:
            os.unlink(json_output_file)
        except:
            pass

        return analysis_results

    except subprocess.TimeoutExpired:
        return {
            "error": "Slither analysis timed out after 60 seconds",
            "status": "timeout"
        }
    except subprocess.CalledProcessError as e:
        return {
            "error": f"Slither execution failed: {str(e)}",
            "stderr": e.stderr if hasattr(e, 'stderr') else None,
            "status": "error"
        }
    except Exception as e:
        print(traceback.format_exc())
        return {
            "error": f"Unexpected error during analysis: {str(e)}",
            "status": "error"
        }

@solidity_bp.route('/analyze', methods=['POST'])
def analyze_contract():
    """
    API endpoint to analyze Solidity contract using Slither
    Accepts either file upload or contract code as text
    """
    try:
        ensure_upload_folder()
        
        # Check if file was uploaded
        if 'file' in request.files:
            file = request.files['file']
            if file.filename == '':
                return jsonify({"error": "No file selected"}), 400
            
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"{timestamp}_{filename}"
                filepath = os.path.join(UPLOAD_FOLDER, filename)
                
                # Check file size
                file.seek(0, os.SEEK_END)
                file_size = file.tell()
                file.seek(0)
                
                if file_size > MAX_FILE_SIZE:
                    return jsonify({"error": "File too large. Maximum size is 16MB"}), 400
                
                file.save(filepath)
                
                # Run Slither analysis
                results = run_slither(filepath)
                
                # Cleanup uploaded file
                try:
                    os.remove(filepath)
                except:
                    pass
                
                return jsonify(results)
            else:
                return jsonify({"error": "Invalid file type. Only .sol files are allowed"}), 400
        
        # Check if contract code was provided as text
        elif request.is_json and 'contract_code' in request.json:
            contract_code = request.json['contract_code']
            contract_name = request.json.get('contract_name', 'contract.sol')
            
            if not contract_code.strip():
                return jsonify({"error": "Contract code cannot be empty"}), 400
            
            # Ensure filename has .sol extension
            if not contract_name.endswith('.sol'):
                contract_name += '.sol'
            
            # Create temporary file with contract code
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{timestamp}_{secure_filename(contract_name)}"
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            
            try:
                with open(filepath, 'w') as f:
                    f.write(contract_code)
                
                # Run Slither analysis
                results = run_slither(filepath)
                
                # Cleanup temporary file
                try:
                    os.remove(filepath)
                except:
                    pass
                
                return jsonify(results)
            
            except Exception as e:
                return jsonify({"error": f"Failed to process contract code: {str(e)}"}), 500
        
        else:
            return jsonify({"error": "No contract file or code provided"}), 400
            
    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@solidity_bp.route('/check-slither', methods=['GET'])
def check_slither():
    """
    Check if Slither is installed and accessible
    """
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
            "error": "Slither not found. Please install Slither first.",
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
    """
    Health check endpoint
    """
    return jsonify({
        "status": "healthy",
        "service": "Solidity Analysis API",
        "timestamp": get_current_timestamp()
    })

# Register error handlers
@solidity_bp.errorhandler(413)
def too_large(e):
    return jsonify({"error": "File too large"}), 413

@solidity_bp.errorhandler(500)
def internal_error(e):
    return jsonify({"error": "Internal server error"}), 500