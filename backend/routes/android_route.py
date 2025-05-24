from flask import Blueprint, request, jsonify
import os
import tempfile
import asyncio
from pathlib import Path
from android.analyzer import analyze_apk_file  # Import from the provided analyzer.py

apk_analyzer_bp = Blueprint('apk_analyzer', __name__, url_prefix='/api/apk-analyzer')

@apk_analyzer_bp.route('/upload', methods=['POST'])
def upload_apk():
    """
    Endpoint to upload and analyze an APK file.
    Expects a multipart form with a file field named 'apk_file'.
    Returns JSON with analysis results or error details.
    """
    if 'apk_file' not in request.files:
        return jsonify({'error': 'No APK file provided'}), 400
    
    file = request.files['apk_file']
    
    # Validate file extension
    if not file.filename.lower().endswith('.apk'):
        return jsonify({'error': 'File must be an APK file (.apk extension)'}), 400
    
    # Create temporary directory to store the APK
    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            # Save the uploaded file
            apk_path = Path(temp_dir) / file.filename
            file.save(str(apk_path))
            
            # Run the analysis synchronously
            try:
                results = asyncio.run(analyze_apk_file(str(apk_path)))
                return jsonify(results), 200
            except FileNotFoundError:
                return jsonify({'error': f"APK file '{file.filename}' not found after saving"}), 400
            except ValueError as ve:
                return jsonify({'error': str(ve)}), 400
            except Exception as e:
                return jsonify({'error': f"Analysis failed: {str(e)}"}), 500
                
        except Exception as e:
            return jsonify({'error': f"Error processing file: {str(e)}"}), 500

@apk_analyzer_bp.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint to verify the API is running and GROQ_API_KEY is set.
    """
    groq_api_key = os.environ.get('GROQ_API_KEY')
    status = {
        'status': 'healthy',
        'groq_api_configured': groq_api_key is not None
    }
    return jsonify(status), 200