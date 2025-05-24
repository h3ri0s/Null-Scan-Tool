#!/usr/bin/env python3
"""
Comprehensive Android Security Analysis Tool
Combines APK analysis and Android project security analysis into a single script.
Can analyze both APK files (using JADX) and Android project directories.
"""

import os
import sys
import json
import re
import httpx
import asyncio
import time
import subprocess
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Optional, Tuple, List, Dict, Any


class AndroidSecurityAnalyzer:
    def __init__(self, input_path: str, is_apk: bool = False):
        self.input_path = Path(input_path)
        self.is_apk = is_apk
        
        if is_apk:
            # APK analysis setup
            self.apk_path = self.input_path.resolve()
            self.apk_dir = self.apk_path.parent
            self.apk_base = self.apk_path.stem
            self.jadx_output_dir = self.apk_dir / self.apk_base
            self.base_directory = self.apk_dir / f"{self.apk_base}_to_check"
        else:
            # Project directory analysis setup
            self.base_directory = self.input_path
        
        self.groq_api_key = os.environ.get('GROQ_API_KEY')
        if not self.groq_api_key:
            print("Warning: GROQ_API_KEY environment variable not set. AI analysis will be skipped.")

    # ========== APK Analysis Methods ==========
    
    def _parse_jadx_errors(self, stdout: str, stderr: str) -> int:
        """Parse JADX output to extract error count"""
        error_count = 0
        
        # Look for error count in stdout (format: "finished with errors, count: X")
        if stdout:
            error_match = re.search(r'finished with errors, count: (\d+)', stdout)
            if error_match:
                error_count = int(error_match.group(1))
        
        # If no error count found in stdout, count ERROR lines in stderr
        if error_count == 0 and stderr:
            error_lines = [line for line in stderr.split('\n') if 'ERROR' in line.upper()]
            error_count = len(error_lines)
        
        return error_count

    def step1_jadx_decompile(self) -> bool:
        """Step 1: Decompile APK using JADX"""
        print("\n🔧 Step 1: Decompiling APK with JADX...")
        
        if not self.apk_path.exists():
            print(f"❌ Error: File '{self.apk_path}' not found.")
            return False

        try:
            result = subprocess.run(
                ["jadx", "-d", str(self.jadx_output_dir), str(self.apk_path)],
                capture_output=True,
                text=True
            )
            
            # Parse JADX output to check error count
            error_count = self._parse_jadx_errors(result.stdout, result.stderr)
            
            if error_count > 30:
                print(f"❌ JADX failed with {error_count} errors (threshold: 30)")
                print("This indicates significant issues with the APK structure.")
                if result.stdout:
                    print("JADX stdout:", result.stdout)
                if result.stderr:
                    print("JADX stderr:", result.stderr)
                return False
            elif error_count > 0:
                print(f"⚠️  JADX completed with {error_count} errors (acceptable, threshold: 30)")
                print("✅ Proceeding with analysis...")
            else:
                print("✅ JADX decompilation completed successfully with no errors")
            
            # Verify that the output directory was created and has content
            if not self.jadx_output_dir.exists():
                print("❌ JADX did not create output directory")
                return False
                
            # Check if there are any files in the output directory
            if not any(self.jadx_output_dir.iterdir()):
                print("❌ JADX output directory is empty")
                return False
            
            return True
            
        except FileNotFoundError:
            print("❌ Error: JADX not found. Please install JADX and ensure it's in your PATH.")
            return False
        except Exception as e:
            print(f"❌ Unexpected error running JADX: {e}")
            return False

    def step2_setup_analysis_directory(self) -> bool:
        """Step 2: Set up analysis directory structure and copy files"""
        print("\n📁 Step 2: Setting up analysis directory...")
        
        # Create analysis directory structure
        self.base_directory.mkdir(exist_ok=True)
        
        # Copy AndroidManifest.xml
        manifest_path = self.jadx_output_dir / "resources" / "AndroidManifest.xml"
        if manifest_path.exists():
            manifest_dest = self.base_directory / "Manifest"
            manifest_dest.mkdir(exist_ok=True)
            shutil.copy2(manifest_path, manifest_dest / "AndroidManifest.xml")
            print(f"✅ Manifest copied to {manifest_dest}")
        
        # Copy activity layout XML files
        output_subdir_name = f"{self.apk_base}_activitiesxmls"
        layout_dir = self.base_directory / output_subdir_name
        layout_dir.mkdir(exist_ok=True)
        
        pattern = re.compile(r'^activity_.*\.xml$')
        copied_count = 0
        
        for root, _, files in os.walk(self.jadx_output_dir):
            for file in files:
                if pattern.match(file):
                    source_file = Path(root) / file
                    destination = layout_dir / file
                    shutil.copy2(source_file, destination)
                    copied_count += 1
        
        print(f"✅ Copied {copied_count} activity XML files")
        
        # Copy Java source files
        self._copy_java_files()
        
        # Copy XML configuration files
        self._copy_xml_config_files()
        
        return True

    def _copy_java_files(self):
        """Copy only Java source files referenced in the AndroidManifest.xml"""
        java_dest_dir = self.base_directory / "Java_Files"
        java_dest_dir.mkdir(exist_ok=True)

        # Parse manifest for referenced Java classes
        manifest_path = self.jadx_output_dir / "resources" / "AndroidManifest.xml"
        referenced_classes = set()
        if manifest_path.exists():
            try:
                tree = ET.parse(manifest_path)
                root = tree.getroot()
                package = root.attrib.get('package', '')
                # Android XML namespace
                ns = {'android': 'http://schemas.android.com/apk/res/android'}
                for tag in ['activity', 'service', 'receiver', 'provider']:
                    for elem in root.iter(tag):
                        name = elem.attrib.get('{http://schemas.android.com/apk/res/android}name')
                        if name:
                            # Handle fully qualified and relative class names
                            if name.startswith('.'):
                                fqcn = package + name
                            elif '.' in name:
                                fqcn = name
                            else:
                                fqcn = package + '.' + name
                            referenced_classes.add(fqcn.replace('.', '/'))
            except Exception as e:
                print(f"Warning: Could not parse manifest for Java class extraction: {e}")

        copied_count = 0
        # Find all Java files in sources directories, but only copy those referenced in manifest
        for sources_dir in self.jadx_output_dir.rglob("sources"):
            if sources_dir.is_dir():
                for java_file in sources_dir.rglob("*.java"):
                    rel_path = java_file.relative_to(sources_dir)
                    # Remove .java extension and check if path matches any referenced class
                    rel_path_no_ext = str(rel_path.with_suffix(''))
                    if any(rel_path_no_ext.endswith(cls) for cls in referenced_classes):
                        safe_name = str(rel_path).replace(os.sep, "_")
                        dest_file = java_dest_dir / safe_name
                        shutil.copy2(java_file, dest_file)
                        copied_count += 1

        print(f"✅ Copied {copied_count} Java files referenced in AndroidManifest.xml")

    def _copy_xml_config_files(self):
        """Copy XML configuration files (strings.xml, backup_rules.xml, etc.)"""
        xml_dest_dir = self.base_directory / "XML_Files"
        xml_dest_dir.mkdir(exist_ok=True)
        
        total_copied = 0
        
        # Copy default strings.xml
        strings_path = self.jadx_output_dir / "resources" / "res" / "values" / "strings.xml"
        if strings_path.exists():
            shutil.copy2(strings_path, xml_dest_dir / "strings.xml")
            total_copied += 1
            print("✅ Copied strings.xml")
        
        # Copy other XML configuration files
        xml_patterns = {
            'backup_rules.xml': r'backup_rules\.xml',
            'data_extraction_rules.xml': r'data_extraction_rules\.xml'
        }
        
        for xml_type, pattern in xml_patterns.items():
            regex_pattern = re.compile(pattern)
            copied_count = 0
            
            for root, _, files in os.walk(self.jadx_output_dir):
                for file in files:
                    if regex_pattern.search(file):
                        source_file = Path(root) / file
                        rel_path = source_file.relative_to(self.jadx_output_dir)
                        safe_path = str(rel_path.parent).replace(os.sep, "_")
                        dest_filename = f"{safe_path}_{file}" if safe_path != "." else file
                        destination = xml_dest_dir / dest_filename
                        
                        shutil.copy2(source_file, destination)
                        copied_count += 1
            
            total_copied += copied_count
            if copied_count > 0:
                print(f"✅ Copied {copied_count} {xml_type} files")
        
        print(f"✅ Total XML configuration files copied: {total_copied}")

    def cleanup_temp_dirs(self):
        """Clean up temporary directories created during APK analysis"""
        if self.is_apk:
            try:
                if self.jadx_output_dir.exists():
                    shutil.rmtree(self.jadx_output_dir)
                    print(f"🧹 Cleaned up: {self.jadx_output_dir}")
                if self.base_directory.exists():
                    shutil.rmtree(self.base_directory)
                    print(f"🧹 Cleaned up: {self.base_directory}")
            except Exception as e:
                print(f"⚠️  Warning: Could not clean up temporary directories: {e}")

    # ========== Security Analysis Methods ==========
    
    def extract_json_from_response(self, response: str) -> dict:
        """Extract and parse JSON from AI response, handling various formats"""
        if not response or response.strip() == "":
            return {"error": "Empty response"}
            
        # Remove common prefixes/suffixes
        response = response.strip()
        
        # Try to find JSON in markdown code blocks
        json_match = re.search(r'```(?:json)?\s*(\[.*?\]|\{.*?\})\s*```', response, re.DOTALL | re.IGNORECASE)
        if json_match:
            json_str = json_match.group(1)
        else:
            # Look for JSON arrays or objects in the response
            json_match = re.search(r'(\[.*?\]|\{.*?\})', response, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                # If no JSON found, return the raw response
                return {"raw_response": response}
        
        try:
            # Clean up common JSON issues
            json_str = json_str.replace('\\"', '"').replace('\\n', '\n').replace('\\/', '/')
            return json.loads(json_str)
        except json.JSONDecodeError as e:
            # If parsing fails, return structured error
            return {
                "parsing_error": f"JSON parsing failed: {str(e)}",
                "raw_response": response
            }

    async def analyze_with_groq(self, prompt: str, system_message: str = "You are a security expert specialized in Android app vulnerabilities.", max_retries: int = 3) -> dict:
        """Generic method to analyze content using Groq API with rate limiting and retry logic"""
        if not self.groq_api_key:
            return {"error": "AI analysis skipped - no API key provided"}
            
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.groq_api_key}"
        }

        payload = {
            "model": "llama3-8b-8192",
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": prompt}
            ]
        }

        for attempt in range(max_retries):
            try:
                # Add delay to avoid rate limiting
                if attempt > 0:
                    wait_time = 2 ** attempt  # Exponential backoff
                    print(f"   ⏳ Rate limit hit, waiting {wait_time} seconds before retry {attempt + 1}/{max_retries}")
                    await asyncio.sleep(wait_time)
                
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers=headers,
                        json=payload
                    )
                
                if response.status_code == 429:
                    # Rate limited, try again
                    continue
                    
                response.raise_for_status()
                data = response.json()
                ai_response = data["choices"][0]["message"]["content"]
                
                # Parse and clean the JSON response
                return self.extract_json_from_response(ai_response)
                
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429 and attempt < max_retries - 1:
                    continue
                return {"error": f"HTTP Error {e.response.status_code}: Rate limit exceeded. Please try again later."}
            except Exception as e:
                if attempt < max_retries - 1:
                    continue
                return {"error": f"Error in AI analysis: {str(e)}"}
        
        return {"error": "Failed to analyze after multiple retries due to rate limiting"}

    def find_files_by_pattern(self, pattern: str) -> List[Path]:
        """Find files matching a pattern in the base directory"""
        files = []
        for file_path in self.base_directory.rglob(pattern):
            if file_path.is_file():
                files.append(file_path)
        return files

    def read_file_content(self, file_path: Path) -> str:
        """Read file content with error handling"""
        try:
            with open(file_path, "r", encoding="utf-8", errors='ignore') as f:
                return f.read()
        except Exception as e:
            return f"Error reading file: {str(e)}"

    async def analyze_android_manifest(self) -> dict:
        """Analyze AndroidManifest.xml files"""
        print("🔍 Analyzing Android Manifest files...")
        manifest_files = self.find_files_by_pattern("**/AndroidManifest.xml")
        
        results = {"manifests_found": len(manifest_files), "analyses": []}
        
        for manifest_file in manifest_files:
            content = self.read_file_content(manifest_file)
            
            prompt = f"""
Analyze the following AndroidManifest.xml content and identify security vulnerabilities.

Return ONLY a JSON array of issue objects with this exact structure:
[
  {{
    "issue": "Issue name",
    "description": "Detailed description",
    "severity": "High/Medium/Low"
  }}
]

AndroidManifest.xml content:
{content}

Return only the JSON array, no additional text or formatting.
"""
            
            analysis = await self.analyze_with_groq(prompt)
            results["analyses"].append({
                "file": str(manifest_file.relative_to(self.base_directory)),
                "issues": analysis if isinstance(analysis, list) else [analysis]
            })
            
            # Add delay between API calls
            await asyncio.sleep(1)
            
        return results

    async def analyze_backup_and_extraction_rules(self) -> dict:
        """Analyze backup_rules.xml and data_extraction_rules.xml files"""
        print("🔍 Analyzing backup and data extraction rules...")
        
        backup_files = self.find_files_by_pattern("**/*backup_rules*.xml")
        extraction_files = self.find_files_by_pattern("**/*data_extraction_rules*.xml")
        
        results = {
            "backup_files_found": len(backup_files),
            "extraction_files_found": len(extraction_files),
            "analyses": []
        }
        
        # Combine all backup and extraction rules for analysis
        all_rules_content = ""
        
        for backup_file in backup_files:
            content = self.read_file_content(backup_file)
            all_rules_content += f"\n\n[{backup_file.name}]\n{content}"
            
        for extraction_file in extraction_files:
            content = self.read_file_content(extraction_file)
            all_rules_content += f"\n\n[{extraction_file.name}]\n{content}"
        
        if all_rules_content.strip():
            prompt = f"""
Analyze the backup_rules and data_extraction_rules XML files for security vulnerabilities.

Return ONLY a JSON array of issue objects with this exact structure:
[
  {{
    "type": "Issue type",
    "path": "File path or rule",
    "description": "Detailed description of the security concern"
  }}
]

Files content:
{all_rules_content}

Return only the JSON array, no additional text or formatting.
"""
            
            analysis = await self.analyze_with_groq(prompt)
            results["analyses"].append({
                "issues": analysis if isinstance(analysis, list) else [analysis]
            })
            
            # Add delay between API calls
            await asyncio.sleep(1)
            
        return results

    async def analyze_strings_xml(self) -> dict:
        """Analyze strings.xml files for legitimate user strings and potential hardcoded secrets"""
        print("🔍 Analyzing strings.xml files...")
        
        strings_files = self.find_files_by_pattern("**/strings.xml")
        results = {"strings_files_found": len(strings_files), "analyses": []}
        
        for strings_file in strings_files:
            content = self.read_file_content(strings_file)
            
            prompt = f"""
Analyze the strings.xml content and extract user-facing strings and potential secrets.

Return ONLY a JSON object with this exact structure:
{{
  "user_strings": [
    {{"key": "string_key", "value": "string_value"}}
  ],
  "potential_secrets": [
    {{"key": "string_key", "value": "string_value", "concern": "Why this might be sensitive"}}
  ]
}}

strings.xml content:
{content}

Return only the JSON object, no additional text or formatting.
"""
            
            analysis = await self.analyze_with_groq(prompt)
            results["analyses"].append({
                "file": str(strings_file.relative_to(self.base_directory)),
                "analysis": analysis
            })
            
            # Add delay between API calls
            await asyncio.sleep(1)
            
        return results

    def find_hardcoded_strings_in_layouts(self) -> dict:
        """Find hardcoded strings in layout XML files"""
        print("🔍 Finding hardcoded strings in layout files...")
        
        text_attrs = [
            "text", "hint", "contentDescription", "title", "summary", 
            "label", "subtitle", "message", "dialogTitle"
        ]
        
        pattern = re.compile(
            r'(android:(' + '|'.join(text_attrs) + r'))="((?!@string/)[^"]+)"'
        )
        
        xml_files = self.find_files_by_pattern("**/*.xml")
        results = {"xml_files_scanned": len(xml_files), "hardcoded_strings": {}}
        
        for xml_file in xml_files:
            content = self.read_file_content(xml_file)
            file_results = []
            
            for i, line in enumerate(content.split('\n'), 1):
                match = pattern.search(line)
                if match:
                    attr = match.group(1)
                    val = match.group(3)
                    file_results.append({
                        "attribute": attr,
                        "value": val,
                        "line": i
                    })
            
            if file_results:
                results["hardcoded_strings"][str(xml_file.relative_to(self.base_directory))] = file_results
        
        if not results["hardcoded_strings"]:
            results["hardcoded_strings"] = {"status": "No hardcoded strings found"}
            
        return results

    async def analyze_java_files(self) -> dict:
        """Analyze Java source files for security vulnerabilities with rate limit protection"""
        print("🔍 Analyzing Java source files...")
        
        java_files = self.find_files_by_pattern("**/*.java")
        results = {"java_files_found": len(java_files), "analyses": []}
        
        if not java_files:
            return results
        
        # Process files one at a time with delays
        for java_file in java_files:
            content = self.read_file_content(java_file)
            
            # Truncate very long files to avoid token limits
            if len(content) > 4000:  # Reduced limit for single file analysis
                content = content[:4000] + "\n... [FILE TRUNCATED] ..."
            
            prompt = f"""
    Analyze the Java source file for security vulnerabilities.

    Return ONLY a JSON array of vulnerability objects with this exact structure:
    [
    {{
        "file": "filename.java",
        "vulnerability_type": "Vulnerability category",
        "code_snippet": "Relevant code",
        "description": "Detailed explanation",
        "severity": "High/Medium/Low"
    }}
    ]

    Java file content:
    {content}

    Return only the JSON array, no additional text or formatting.
    """
            
            # Use the existing analyze_with_groq method which already has retry logic
            analysis = await self.analyze_with_groq(prompt)
            
            results["analyses"].append({
                "file": str(java_file.relative_to(self.base_directory)),
                "vulnerabilities": analysis if isinstance(analysis, list) else [analysis]
            })
            
            # Add delay between files (2 seconds minimum)
            await asyncio.sleep(2)
            
            # If we hit a rate limit in the last analysis, extend the delay
            if isinstance(analysis, dict) and "error" in analysis and "Rate limit" in analysis["error"]:
                print("⚠️  Rate limit detected, increasing delay to 10 seconds")
                await asyncio.sleep(10)
        
        return results

    def generate_summary_report(self, all_results: dict) -> dict:
        """Generate a comprehensive summary report"""
        
        # Count total issues found
        total_manifest_issues = 0
        total_backup_issues = 0
        total_java_vulnerabilities = 0
        total_hardcoded_strings = 0
        
        # Count manifest issues
        for analysis in all_results.get("manifest_analysis", {}).get("analyses", []):
            if isinstance(analysis.get("issues"), list):
                total_manifest_issues += len(analysis["issues"])
        
        # Count backup issues
        for analysis in all_results.get("backup_extraction_analysis", {}).get("analyses", []):
            if isinstance(analysis.get("issues"), list):
                total_backup_issues += len(analysis["issues"])
        
        # Count Java vulnerabilities
        for analysis in all_results.get("java_analysis", {}).get("analyses", []):
            if isinstance(analysis.get("vulnerabilities"), list):
                total_java_vulnerabilities += len(analysis["vulnerabilities"])
        
        # Count hardcoded strings
        hardcoded_data = all_results.get("hardcoded_strings_analysis", {}).get("hardcoded_strings", {})
        if isinstance(hardcoded_data, dict):
            for file_issues in hardcoded_data.values():
                if isinstance(file_issues, list):
                    total_hardcoded_strings += len(file_issues)
        
        summary = {
            "scan_summary": {
                "input_type": "APK" if self.is_apk else "Project Directory",
                "input_path": str(self.input_path),
                "analysis_directory": str(self.base_directory),
                "scan_timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                "files_analyzed": {
                    "manifests": all_results.get("manifest_analysis", {}).get("manifests_found", 0),
                    "backup_extraction_files": (
                        all_results.get("backup_extraction_analysis", {}).get("backup_files_found", 0) +
                        all_results.get("backup_extraction_analysis", {}).get("extraction_files_found", 0)
                    ),
                    "strings_files": all_results.get("strings_analysis", {}).get("strings_files_found", 0),
                    "xml_files_scanned": all_results.get("hardcoded_strings_analysis", {}).get("xml_files_scanned", 0),
                    "java_files": all_results.get("java_analysis", {}).get("java_files_found", 0)
                },
                "issues_found": {
                    "manifest_issues": total_manifest_issues,
                    "backup_extraction_issues": total_backup_issues,
                    "java_vulnerabilities": total_java_vulnerabilities,
                    "hardcoded_strings": total_hardcoded_strings
                }
            },
            "detailed_results": all_results
        }
        return summary

    async def run_security_analysis(self) -> dict:
        """Run all security analyses"""
        print(f"🚀 Starting security analysis of: {self.base_directory}")
        print("⏳ Note: Adding delays between API calls to avoid rate limiting")
        print("=" * 80)
        
        if not self.base_directory.exists():
            return {"error": f"Directory not found: {self.base_directory}"}
        
        all_results = {}
        
        # Run all analyses with delays
        try:
            all_results["manifest_analysis"] = await self.analyze_android_manifest()
            await asyncio.sleep(2)
            
            all_results["backup_extraction_analysis"] = await self.analyze_backup_and_extraction_rules()
            await asyncio.sleep(2)
            
            all_results["strings_analysis"] = await self.analyze_strings_xml()
            await asyncio.sleep(2)
            
            all_results["hardcoded_strings_analysis"] = self.find_hardcoded_strings_in_layouts()
            
            all_results["java_analysis"] = await self.analyze_java_files()
            
        except Exception as e:
            print(f"❌ Error during analysis: {str(e)}")
            all_results["analysis_error"] = str(e)
        
        # Generate summary
        summary_report = self.generate_summary_report(all_results)
        
        print("=" * 80)
        print("✅ Analysis complete!")
        
        return summary_report

    async def run_full_analysis(self) -> dict:
        """Run the complete analysis pipeline"""
        try:
            if self.is_apk:
                print("=" * 60)
                print("        📱 APK Analysis Tool")
                print("=" * 60)
                print(f"APK File: {self.input_path}")
                print("=" * 60)
                
                # Step 1: JADX Decompilation
                if not self.step1_jadx_decompile():
                    return {"error": "JADX decompilation failed"}

                # Step 2: Setup Analysis Directory
                if not self.step2_setup_analysis_directory():
                    return {"error": "Failed to setup analysis directory"}

                print("\n🎉 APK extraction complete! Starting security analysis...")
            
            # Run security analysis
            results = await self.run_security_analysis()
            
            if self.is_apk:
                print("\n" + "=" * 60)
                print("🎉 Complete APK Security Analysis Finished!")
                print("=" * 60)
                print(f"📁 Check the '{self.base_directory}' directory for all extracted files")
                print("=" * 60)
            
            return results

        except Exception as e:
            print(f"\n❌ Error during analysis: {e}")
            return {"error": str(e)}

async def analyze_apk_file(apk_path: str) -> dict:
    """
    Analyze an APK file and return the security analysis results as a dictionary.
    
    Args:
        apk_path (str): Path to the APK file to analyze
        
    Returns:
        dict: Security analysis results in JSON format
        
    Raises:
        FileNotFoundError: If the APK file doesn't exist
        ValueError: If the file is not an APK file
    """
    # Validate input
    if not os.path.isfile(apk_path):
        raise FileNotFoundError(f"APK file '{apk_path}' not found.")
    
    if not apk_path.lower().endswith('.apk'):
        raise ValueError(f"File '{apk_path}' is not an APK file (must have .apk extension).")
    
    # Create analyzer and run analysis
    analyzer = AndroidSecurityAnalyzer(apk_path, is_apk=True)
    
    try:
        results = await analyzer.run_full_analysis()
        return results
        
    except Exception as e:
        return {"error": f"Analysis failed: {str(e)}"}
    
    finally:
        # Clean up temporary directories
        analyzer.cleanup_temp_dirs()

async def main():
    """Main function for command-line usage"""
    if len(sys.argv) < 2:
        print(f"Usage: python {sys.argv[0]} <path_to_apk_or_android_project>")
        print("\nThis tool can analyze:")
        print("1. APK files (automatically detected by .apk extension)")
        print("2. Android project directories")
        print("\nFor APK analysis, the tool will:")
        print("- Decompile the APK using JADX")
        print("- Extract and organize files for analysis")
        print("- Run comprehensive security analysis")
        print("\nFor project analysis, the tool will:")
        print("- Analyze AndroidManifest.xml files")
        print("- Analyze backup_rules.xml and data_extraction_rules.xml files")
        print("- Analyze strings.xml files")
        print("- Find hardcoded strings in layout XML files")
        print("- Analyze Java source files for security vulnerabilities")
        print("\nMake sure to set GROQ_API_KEY environment variable for AI-powered analysis.")
        sys.exit(1)

    input_path = sys.argv[1]
    
    # Determine if input is APK or directory
    is_apk = input_path.lower().endswith('.apk')
    
    if is_apk:
        # Use the new analyze_apk_file function for APK files
        try:
            results = await analyze_apk_file(input_path)
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            sys.exit(1)
    else:
        # Handle directory analysis (existing logic)
        if not os.path.isdir(input_path):
            print(f"Error: Directory '{input_path}' not found.")
            sys.exit(1)
        
        analyzer = AndroidSecurityAnalyzer(input_path, is_apk=False)
        try:
            results = await analyzer.run_full_analysis()
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            sys.exit(1)
    
    # Write results to output file
    input_name = Path(input_path).stem
    output_file = f"{input_name}_security_analysis.json"
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print(f"\n📄 Results saved to: {output_file}")
    except Exception as e:
        print(f"❌ Error saving results: {str(e)}")
    
    # Print summary to console
    print("\n" + "=" * 80)
    print("SCAN SUMMARY")
    print("=" * 80)
    
    if "scan_summary" in results:
        summary = results["scan_summary"]
        print(f"📱 Input Type: {summary.get('input_type', 'Unknown')}")
        print(f"📁 Input Path: {summary.get('input_path', 'N/A')}")
        print(f"⏰ Timestamp: {summary.get('scan_timestamp', 'N/A')}")
        print(f"\n📊 Files Analyzed:")
        files_analyzed = summary.get('files_analyzed', {})
        for file_type, count in files_analyzed.items():
            print(f"   • {file_type.replace('_', ' ').title()}: {count}")
        
        print(f"\n🚨 Issues Found:")
        issues_found = summary.get('issues_found', {})
        total_issues = sum(issues_found.values())
        print(f"   • Total Issues: {total_issues}")
        for issue_type, count in issues_found.items():
            if count > 0:
                print(f"   • {issue_type.replace('_', ' ').title()}: {count}")
    
    print(f"\n📋 Full detailed results available in: {output_file}")