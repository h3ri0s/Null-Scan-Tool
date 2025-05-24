import nmap
import os
import re
import threading
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
from utils.network_util import validate_target, save_json

def scan_chunk(target: str, ports_chunk: str, return_dict: dict, lock: threading.Lock):
    """Scan a chunk of ports and store results in return_dict."""
    try:
        scanner = nmap.PortScanner()
        # Use aggressive timing (-T4) and combine service detection with OS detection
        scanner.scan(target, arguments=f"-p {ports_chunk} -sV -O -Pn -T4")
        with lock:
            if target in scanner.all_hosts():
                tcp_results = scanner[target].get('tcp', {})
                return_dict.update(tcp_results)
    except Exception as e:
        with lock:
            return_dict['error'] = str(e)

def scan_target(target: str, ports: str = "1-65535", chunk_size: int = 1000) -> dict:
    """Scan target for open ports using threading for faster execution."""
    if not validate_target(target):
        return {"error": "Invalid target hostname or IP"}

    print(f"[*] Scanning target {target} for ports {ports}...\n")

    start_port, end_port = map(int, ports.split('-'))
    return_dict = {}
    lock = threading.Lock()
    port_ranges = []

    # Split ports into smaller chunks
    for chunk_start in range(start_port, end_port + 1, chunk_size):
        chunk_end = min(chunk_start + chunk_size - 1, end_port)
        port_ranges.append(f"{chunk_start}-{chunk_end}")

    # Use ThreadPoolExecutor for parallel scanning
    with ThreadPoolExecutor(max_workers=os.cpu_count() * 4) as executor:
        futures = [
            executor.submit(scan_chunk, target, pr, return_dict, lock)
            for pr in port_ranges
        ]
        # Wait for all threads to complete
        for future in futures:
            future.result()

    if 'error' in return_dict:
        return {"error": return_dict['error']}

    return {'tcp': return_dict}

def get_open_ports(host: str, port_scan_results: dict) -> dict:
    """Parse open ports and services from port scan results."""
    open_ports = {}
    for port, info in port_scan_results.get('tcp', {}).items():
        if info.get('state') == 'open':
            open_ports[f"tcp/{port}"] = {
                "service": info.get('name', 'unknown'),
                "product": info.get('product', ''),
                "version": info.get('version', '')
            }
    return open_ports

def check_ssl_security(target: str, open_ports: dict) -> dict:
    """Check SSL/TLS security for services on open ports."""
    try:
        print("running check ssl secutirty ")
        scanner = nmap.PortScanner()
        ssl_results = {}

        for port, info in open_ports.items():
            service = info.get("service", "").lower()
            if 'ssl' in service or int(port.split('/')[1]) in [443, 8443]:
                ssl_results[port] = {
                    "service": service,
                    "product": info.get("product", ""),
                    "version": info.get("version", ""),
                    "security_issues": [],
                    "remediations": []
                }

                # Run comprehensive SSL/TLS scripts
                args = "-sV --script ssl-enum-ciphers,ssl-cert,ssl-known-key,ssl-date,ssl-dh-params,ssl-heartbleed"
                scanner.scan(target, arguments=f"-p {port.split('/')[1]} {args} -Pn -T4")

                if target in scanner.all_hosts() and 'tcp' in scanner[target]:
                    port_data = scanner[target]['tcp'].get(int(port.split('/')[1]), {})
                    scripts = port_data.get('script', {})

                    # SSL/TLS Checks
                    weak_ciphers = ["RC4", "MD5", "DES", "3DES"]
                    outdated_tls = ["TLSv1.0", "TLSv1.1", "SSLv2", "SSLv3"]
                    issues = []

                    # Check ciphers
                    ssl_ciphers = scripts.get('ssl-enum-ciphers', '')
                    if ssl_ciphers:
                        for cipher in weak_ciphers:
                            if cipher in ssl_ciphers:
                                issues.append(f"Weak cipher detected: {cipher}")
                                ssl_results[port]["remediations"].append(
                                    f"Disable weak cipher {cipher} in server configuration."
                                )
                        for tls_version in outdated_tls:
                            if tls_version in ssl_ciphers:
                                issues.append(f"Outdated TLS version: {tls_version}")
                                ssl_results[port]["remediations"].append(
                                    f"Disable {tls_version} and enable TLSv1.2 or TLSv1.3."
                                )

                    # Check certificate
                    ssl_cert = scripts.get('ssl-cert', '')
                    if ssl_cert:
                        if "expired" in ssl_cert.lower():
                            issues.append("SSL certificate is expired")
                            ssl_results[port]["remediations"].append(
                                "Renew the SSL certificate"
                            )
                        if "self-signed" in ssl_cert.lower():
                            issues.append("Self-signed SSL certificate detected")
                            ssl_results[port]["remediations"].append(
                                "Replace with a certificate from a trusted CA"
                            )

                    # Check known vulnerabilities
                    if scripts.get('ssl-known-key', '').lower().find("known vulnerable") >= 0:
                        issues.append("Known vulnerable SSL key detected")
                        ssl_results[port]["remediations"].append(
                            "Regenerate SSL key and update certificates"
                        )

                    # Check Heartbleed
                    if scripts.get('ssl-heartbleed', '').lower().find("vulnerable") >= 0:
                        issues.append("Heartbleed vulnerability detected")
                        ssl_results[port]["remediations"].append(
                            "Update OpenSSL to a non-vulnerable version"
                        )

                    ssl_results[port]["security_issues"].extend(issues)

        return ssl_results

    except Exception as e:
        return {"error": f"SSL security scan failed: {str(e)}"}

def check_http_security(target: str, open_ports: dict) -> dict:
    """Check HTTP security for services on open ports."""
    try:
        print("doing check_http_secutr")
        scanner = nmap.PortScanner()
        http_results = {}

        for port, info in open_ports.items():
            service = info.get("service", "").lower()
            if service in ["http", "https", "ssl"] or int(port.split('/')[1]) in [80, 443, 8080, 8443]:
                http_results[port] = {
                    "service": service,
                    "product": info.get("product", ""),
                    "version": info.get("version", ""),
                    "security_issues": [],
                    "remediations": []
                }

                # Run comprehensive HTTP scripts
                args = "-sV --script http-headers,http-methods,http-security-headers,http-vuln-cve2017-5638,http-slowloris-check"
                scanner.scan(target, arguments=f"-p {port.split('/')[1]} {args} -Pn -T4")

                if target in scanner.all_hosts() and 'tcp' in scanner[target]:
                    port_data = scanner[target]['tcp'].get(int(port.split('/')[1]), {})
                    scripts = port_data.get('script', {})

                    # HTTP Security Checks
                    required_headers = [
                        "Content-Security-Policy",
                        "Strict-Transport-Security",
                        "X-Frame-Options",
                        "X-Content-Type-Options"
                    ]
                    issues = []

                    # Check headers
                    http_headers = scripts.get('http-headers', '') + scripts.get('http-security-headers', '')
                    for header in required_headers:
                        if header not in http_headers:
                            issues.append(f"Missing HTTP header: {header}")
                            http_results[port]["remediations"].append(
                                f"Add {header} to HTTP responses"
                            )

                    # Check unsafe methods
                    http_methods = scripts.get('http-methods', '')
                    unsafe_methods = ["TRACE", "DELETE", "PUT"]
                    for method in unsafe_methods:
                        if method in http_methods:
                            issues.append(f"Unsafe HTTP method enabled: {method}")
                            http_results[port]["remediations"].append(
                                f"Disable unsafe HTTP method {method}"
                            )

                    # Check vulnerabilities
                    if scripts.get('http-vuln-cve2017-5638', '').lower().find("vulnerable") >= 0:
                        issues.append("CVE-2017-5638 (Struts vulnerability) detected")
                        http_results[port]["remediations"].append(
                            "Update Apache Struts to a patched version"
                        )

                    if scripts.get('http-slowloris-check', '').lower().find("vulnerable") >= 0:
                        issues.append("Slowloris vulnerability detected")
                        http_results[port]["remediations"].append(
                            "Configure server to mitigate Slowloris attacks"
                        )

                    http_results[port]["security_issues"].extend(issues)

        return http_results

    except Exception as e:
        return {"error": f"HTTP security scan failed: {str(e)}"}

if __name__ == "__main__":
    scanner_target = "127.0.0.1"
    final_result = {
        "target": scanner_target,
        "port_scan": {},
        "open_ports": {},
        "ssl_security_findings": {},
        "http_security_findings": {},
        "errors": []
    }

    print(f"Starting full scan on {scanner_target}...\n")

    # Step 1: Scan for open ports
    print("[*] Scanning ports...")
    port_scan_results = scan_target(scanner_target, chunk_size=1000)
    final_result["port_scan"] = port_scan_results

    if "error" in port_scan_results:
        print("[!] Port scan failed:", port_scan_results["error"])
        final_result["errors"].append(f"Port Scan Error: {port_scan_results['error']}")
    else:
        print(scanner_target)
        open_ports = get_open_ports(scanner_target, port_scan_results)
        final_result["open_ports"] = open_ports
        print(f"[+] Open ports identified: {open_ports}\n")

        # Step 2: Check SSL/TLS security
        print("[*] Checking SSL/TLS security...")
        ssl_results = check_ssl_security(scanner_target, open_ports)
        final_result["ssl_security_findings"] = ssl_results

        if "error" in ssl_results:
            print("[!] SSL security check failed:", ssl_results["error"])
            final_result["errors"].append(f"SSL Scan Error: {ssl_results['error']}")
        else:
            print(f"[+] SSL/TLS findings: {ssl_results}\n")

        # Step 3: Check HTTP security
        print("[*] Checking HTTP security...")
        http_results = check_http_security(scanner_target, open_ports)
        final_result["http_security_findings"] = http_results

        if "error" in http_results:
            print("[!] HTTP security check failed:", http_results["error"])
            final_result["errors"].append(f"HTTP Scan Error: {http_results['error']}")
        else:
            print(f"[+] HTTP security findings: {http_results}\n")

    # Step 4: Save all results
    save_json(final_result, "data/scanned_results.json")
    print("[✓] All scan results saved to 'data/scanned_results.json'")