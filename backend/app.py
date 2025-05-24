from flask import Flask
from flask_cors import CORS
from routes.review_routes import review_bp
from routes.network_scan import network_scan_bp
from routes.cve_scrape import cve_bp
from routes.solidity_route import solidity_bp
from routes.android_route import apk_analyzer_bp

app = Flask(__name__)

CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

app.register_blueprint(review_bp)
app.register_blueprint(network_scan_bp)
app.register_blueprint(cve_bp)
app.register_blueprint(solidity_bp)
app.register_blueprint(apk_analyzer_bp)

if __name__ == "__main__":
    app.run(debug=True, port=5000)