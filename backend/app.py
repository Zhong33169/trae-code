import os
from flask import Flask
from flask_cors import CORS
from config import Config
from models import db
from routes import auth_bp, orders_bp, appeals_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app, supports_credentials=True, origins=['http://localhost:3004', 'http://127.0.0.1:3004'])

    db.init_app(app)

    app.register_blueprint(auth_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(appeals_bp)

    @app.route('/api/health')
    def health():
        return {'status': 'ok', 'message': '景区运营团队预约单系统 API 运行正常'}

    return app


if __name__ == '__main__':
    app = create_app()
    port = int(os.environ.get('BACKEND_PORT', 8004))
    app.run(host='0.0.0.0', port=port, debug=True)
