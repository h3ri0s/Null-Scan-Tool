from agent.source_review import review_source_code

prompt="""
You are a security expert. Please review the following network results and provide a detailed analysis of any potential vulnerabilities, misconfigurations, or security issues. Include recommendations for remediation and best practices to enhance security.
"""

dest_source_code = "data/scaned_results.json"

reiview_source_code = review_source_code(dest_source_code, dest_source_code, prompt)
print(reiview_source_code)

