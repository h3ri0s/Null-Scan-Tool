from flask import Blueprint, request, jsonify
from ai.prompts.prompts import (
    general_review_prompt, security_audit_prompt, performance_optimization_prompt,
    style_readability_prompt, bug_finding_prompt, documentation_prompt,
    config_file_prompt, code_security_and_performance_prompt, upgrade_recommendations_prompt,
    test_coverage_suggestions_prompt, refactor_prompt, concurrency_issues_prompt
)
from ai.inference import prompt_ai

review_bp = Blueprint("review", __name__, url_prefix="/api/review")

def run_review(prompt_func):
    data = request.get_json()
    source_code = data.get("source_code", "")
    filename = data.get("filename", "")
    prompt = prompt_func(filename, source_code)
    result = prompt_ai(prompt=prompt)
    return jsonify({"result": result})

@review_bp.route("/general", methods=["POST"])
def review_general():
    return run_review(general_review_prompt)

@review_bp.route("/security", methods=["POST"])
def review_security():
    return run_review(security_audit_prompt)

@review_bp.route("/performance", methods=["POST"])
def review_performance():
    return run_review(performance_optimization_prompt)

@review_bp.route("/style", methods=["POST"])
def review_style():
    return run_review(style_readability_prompt)

@review_bp.route("/bugs", methods=["POST"])
def review_bugs():
    return run_review(bug_finding_prompt)

@review_bp.route("/docs", methods=["POST"])
def review_docs():
    return run_review(documentation_prompt)

@review_bp.route("/config", methods=["POST"])
def review_config():
    data = request.get_json()
    source_code = data.get("source_code", "")
    filename = data.get("filename", "")
    prompt = config_file_prompt(filename, source_code)
    result = prompt_ai(prompt=prompt)
    return jsonify({"result": result})

@review_bp.route("/security-performance", methods=["POST"])
def review_sec_perf():
    return run_review(code_security_and_performance_prompt)

@review_bp.route("/upgrade", methods=["POST"])
def review_upgrade():
    return run_review(upgrade_recommendations_prompt)

@review_bp.route("/tests", methods=["POST"])
def review_tests():
    return run_review(test_coverage_suggestions_prompt)

@review_bp.route("/refactor", methods=["POST"])
def review_refactor():
    return run_review(refactor_prompt)

@review_bp.route("/concurrency", methods=["POST"])
def review_concurrency():
    return run_review(concurrency_issues_prompt)
