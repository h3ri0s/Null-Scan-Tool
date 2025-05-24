def general_review_prompt(filename: str, source_code: str) -> str:
    return (
        f"Review the source code file '{filename}' for bugs, style issues, and performance improvements.\n\n"
        f"{source_code}"
    )

def security_audit_prompt(filename: str, source_code: str) -> str:
    return (
        f"Perform a security audit on the following file '{filename}'. "
        f"Identify any potential security vulnerabilities or risky coding patterns.\n\n"
        f"{source_code}"
    )

def performance_optimization_prompt(filename: str, source_code: str) -> str:
    return (
        f"Analyze the source code in '{filename}' and suggest improvements to optimize its performance.\n\n"
        f"{source_code}"
    )

def style_readability_prompt(filename: str, source_code: str) -> str:
    return (
        f"Review the file '{filename}' and provide suggestions for improving code style, readability, and maintainability.\n\n"
        f"{source_code}"
    )

def bug_finding_prompt(filename: str, source_code: str) -> str:
    return (
        f"Find any bugs or logical errors in the source code of '{filename}'. Explain what might go wrong.\n\n"
        f"{source_code}"
    )

def documentation_prompt(filename: str, source_code: str) -> str:
    return (
        f"Suggest improvements and additions to documentation and comments in the source code of '{filename}'.\n\n"
        f"{source_code}"
    )

def config_file_prompt(filename: str, config_text: str) -> str:
    return (
        f"Review the configuration file '{filename}'. Check for any errors or potential misconfigurations.\n\n"
        f"{config_text}"
    )

def code_security_and_performance_prompt(filename: str, source_code: str) -> str:
    return (
        f"Review the file '{filename}' focusing on security vulnerabilities and performance bottlenecks. "
        f"Suggest fixes and optimizations.\n\n"
        f"{source_code}"
    )

def upgrade_recommendations_prompt(filename: str, source_code: str) -> str:
    return (
        f"Review the source code '{filename}' and suggest ways to upgrade it to use more modern language features or libraries.\n\n"
        f"{source_code}"
    )

def test_coverage_suggestions_prompt(filename: str, source_code: str) -> str:
    return (
        f"Suggest tests and test cases that should be added for the code in '{filename}' to improve test coverage.\n\n"
        f"{source_code}"
    )

def refactor_prompt(filename: str, source_code: str) -> str:
    return (
        f"Suggest how the code in '{filename}' can be refactored to improve modularity and reduce complexity.\n\n"
        f"{source_code}"
    )

def concurrency_issues_prompt(filename: str, source_code: str) -> str:
    return (
        f"Analyze the code in '{filename}' for potential concurrency issues such as race conditions or deadlocks.\n\n"
        f"{source_code}"
    )
