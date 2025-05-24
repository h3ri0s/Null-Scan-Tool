from flask import Blueprint, request, jsonify
import json
from utils.network_scanner import (
    scan_target,
    get_open_ports,
    check_ssl_security,
    check_http_security,
)
from utils.network_util import validate_target

network_scan_bp = Blueprint("network_scan", __name__, url_prefix="/api/network-scan")

stored_results = []

def add_result(route_name, data):
    stored_results.append({
        "route": route_name,
        "result": data
    })

@network_scan_bp.route("/scan_target", methods=["POST"])
def route_scan_target():
    data = request.get_json()
    target = data.get("target")
    ports = data.get("ports", "1-65535")
    chunk_size = data.get("chunk_size", 2000)

    if not target:
        return jsonify({"error": "Missing target IP or hostname"}), 400

    results = scan_target(target, ports, chunk_size)
    add_result("scan_target", results)  # store result

    status_code = 200 if "error" not in results else 500
    return jsonify(results), status_code


@network_scan_bp.route("/get_open_ports", methods=["POST"])
def route_get_open_ports():
    data = request.get_json()
    target = data.get("target")  # Add target parameter
    scan_result = data.get("scan_result")
    
    if not target or not scan_result or not isinstance(scan_result, dict):
        return jsonify({"error": "Missing target or invalid scan_result JSON"}), 400

    # Fix: Pass both target and scan_result parameters
    open_ports = get_open_ports(target, scan_result)
    add_result("get_open_ports", open_ports)  # store result

    return jsonify(open_ports), 200


@network_scan_bp.route("/check_ssl_security", methods=["POST"])
def route_check_ssl_security():
    data = request.get_json()
    target = data.get("target")
    open_ports = data.get("open_ports")

    if not target or not open_ports:
        return jsonify({"error": "Missing target or open_ports"}), 400

    results = check_ssl_security(target, open_ports)
    add_result("check_ssl_security", results)  # store result

    status_code = 200 if "error" not in results else 500
    return jsonify(results), status_code


@network_scan_bp.route("/check_http_security", methods=["POST"])
def route_check_http_security():
    data = request.get_json()
    target = data.get("target")
    open_ports = data.get("open_ports")

    if not target or not open_ports:
        return jsonify({"error": "Missing target or open_ports"}), 400

    results = check_http_security(target, open_ports)
    add_result("check_http_security", results)  # store result

    status_code = 200 if "error" not in results else 500
    return jsonify(results), status_code


@network_scan_bp.route("/final_results", methods=["GET"])
def get_final_results():
    """Return all stored results from previous calls."""
    return jsonify(stored_results), 200


@network_scan_bp.route("/clear_results", methods=["POST"])
def clear_results():
    """Clear all stored results."""
    stored_results.clear()
    return jsonify({"message": "Stored results cleared"}), 200


@network_scan_bp.route("/full_scan", methods=["POST"])
def full_scan():
    if request.method == 'OPTIONS':
        return '', 200 
    data = request.get_json()
    print(json.dumps(data, indent=4))  # Debugging line
    target = data.get("target")
    ports = data.get("ports", "1-65535")
    chunk_size = data.get("chunk_size", 2000)

    if not target:
        return jsonify({"error": "Missing target IP or hostname"}), 400

    final_result = {
        "target": target,
        "port_scan": {},
        "open_ports": {},
        "ssl_security_findings": {},
        "http_security_findings": {},
        "errors": []
    }

    # Step 1: Port Scan
    port_scan_results = scan_target(target, ports, chunk_size)
    print(port_scan_results)
    final_result["port_scan"] = port_scan_results
    if "error" in port_scan_results:
        final_result["errors"].append(f"Port Scan Error: {port_scan_results['error']}")
        return jsonify(final_result), 500

    print(target)
    # Step 2: Get Open Ports - Fixed: consistent parameter passing
    open_ports = get_open_ports(target, port_scan_results)
    final_result["open_ports"] = open_ports

    # # Step 3: SSL Security Scan
    # ssl_results = check_ssl_security(target, open_ports)
    # final_result["ssl_security_findings"] = ssl_results
    # if "error" in ssl_results:
    #     final_result["errors"].append(f"SSL Scan Error: {ssl_results['error']}")

    # # Step 4: HTTP Security Scan
    # http_results = check_http_security(target, open_ports)
    # final_result["http_security_findings"] = http_results
    # if "error" in http_results:
    #     final_result["errors"].append(f"HTTP Scan Error: {http_results['error']}")

    status_code = 200 if not final_result["errors"] else 207  # 207 = Multi-Status

    return jsonify(final_result), status_code