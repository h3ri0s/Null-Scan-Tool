import json
import os
import time
import requests
from datetime import datetime, timedelta
from pathlib import Path

NVD_API_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"
CACHE_FILE = Path("../data/cve.json")
print(CACHE_FILE)
CACHE_EXPIRY_DAYS = 7

def load_cache():
    if CACHE_FILE.exists():
        with open(CACHE_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_cache(cache):
    CACHE_FILE.parent.mkdir(exist_ok=True)
    with open(CACHE_FILE, 'w') as f:
        json.dump(cache, f, indent=2)

def is_cache_valid(cache_entry):
    if not cache_entry or 'timestamp' not in cache_entry:
        return False
    cache_time = datetime.fromisoformat(cache_entry['timestamp'])
    return (datetime.now() - cache_time).days < CACHE_EXPIRY_DAYS

def fetch_cve(module_name):
    try:
        params = {"keywordSearch": module_name}
        response = requests.get(NVD_API_URL, params=params, timeout=10)
        
        if response.status_code == 403:
            print("Rate limit exceeded. Waiting 30 seconds...")
            time.sleep(30)
            response = requests.get(NVD_API_URL, params=params, timeout=10)
        
        response.raise_for_status()
        data = response.json()
        
        cves = []
        if 'vulnerabilities' in data:
            for vuln in data['vulnerabilities']:
                cve = vuln.get('cve', {})
                cve_id = cve.get('id', 'N/A')
                description = cve.get('descriptions', [{}])[0].get('value', 'No description')
                cves.append({
                    'id': cve_id,
                    'description': description,
                    'last_modified': cve.get('lastModified', '')
                })
        
        return cves
    
    except requests.RequestException as e:
        print(f"Error fetching CVE for {module_name}: {e}")
        return []

def get_cve_data(module_name):
    cache = load_cache()
    
    if module_name in cache and is_cache_valid(cache[module_name]):
        print(f"Using cached CVE data for {module_name}")
        return cache[module_name]['cves']
    
    print(f"Fetching CVE data for {module_name} from NVD API")
    cves = fetch_cve(module_name)
    
    cache[module_name] = {
        'cves': cves,
        'timestamp': datetime.now().isoformat()
    }
    save_cache(cache)
    
    return cves

def main():
    module_name = input("Enter module or program name to fetch CVEs for: ").strip()
    if not module_name:
        print("Module name cannot be empty.")
        return
    
    cves = get_cve_data(module_name)
    
    if cves:
        print(f"\nFound {len(cves)} CVEs for {module_name}:")
        for cve in cves:
            print(f"\nCVE ID: {cve['id']}")
    else:
        print(f"No CVEs found for {module_name}.")

if __name__ == "__main__":
    main()