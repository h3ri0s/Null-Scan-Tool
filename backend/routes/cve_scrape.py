from flask import Blueprint, request, jsonify
import sys
import os
import subprocess
import json
from pathlib import Path
from scripts.scrape_cves import fetch_cve

cve_bp = Blueprint('cve', __name__, url_prefix='/api/cve')

@cve_bp.route('/lookup', methods=['POST'])
def cve_lookup():
    """API endpoint for CVE lookup"""
    try:
        data = request.get_json()
        
        if not data or 'module_name' not in data:
            return jsonify({'error': 'module_name is required'}), 400
        
        module_name = data['module_name'].strip()
        version = data.get('version', '').strip()
        
        if not module_name:
            return jsonify({'error': 'module_name cannot be empty'}), 400
        
        # Use the imported function if available
        if fetch_cve:
            cves = fetch_cve(module_name)
        else:
            # Fallback: call the script directly
            script_path = Path(__file__).parent.parent / 'scripts' / 'scrape_cves.py'
            try:
                # Run the script and capture output
                result = subprocess.run([
                    'python', str(script_path), module_name
                ], capture_output=True, text=True, timeout=30)
                
                if result.returncode == 0:
                    # Parse the output to extract CVE data
                    # This is a simplified approach - you might need to modify
                    # scrape_cves.py to output JSON format
                    cves = []
                else:
                    return jsonify({
                        'error': 'Failed to execute CVE script',
                        'module_name': module_name,
                        'cves': []
                    }), 500
            except subprocess.TimeoutExpired:
                return jsonify({
                    'error': 'CVE lookup timed out',
                    'module_name': module_name,
                    'cves': []
                }), 500
            except Exception as e:
                return jsonify({
                    'error': f'Script execution error: {str(e)}',
                    'module_name': module_name,
                    'cves': []
                }), 500
        
        response_data = {
            'module_name': module_name,
            'version': version,
            'cves': cves,
            'total_cves': len(cves) if cves else 0,
        }
        
        return jsonify(response_data)
    
    except Exception as e:
        print(f"Unexpected error in CVE lookup: {e}")
        return jsonify({
            'error': 'Internal server error',
            'module_name': data.get('module_name', '') if data else '',
            'cves': []
        }), 500