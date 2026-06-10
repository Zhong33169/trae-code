import os
from flask import Flask
from flask_cors import CORS
from config import Config
from models import db
from routes import auth_bp, orders_bp, appeals_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app, supports_credentials=True, origins=Config.get_cors_origins())

    db.init_app(app)

    app.register_blueprint(auth_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(appeals_bp)

    @app.route('/api/health')
    def health():
        return {
            'status': 'ok',
            'message': '景区运营团队预约单系统 API 运行正常',
            'backend_port': Config.PORT,
            'frontend_port': Config.FRONTEND_PORT,
            'cors_origins': Config.get_cors_origins()
        }

    return app


if __name__ == '__main__':
    app = create_app()
    port = Config.PORT
    print(f'后端端口: {port}')
    print(f'前端端口: {Config.FRONTEND_PORT}')
    print(f'CORS origins: {Config.get_cors_origins()}')
    app.run(host='0.0.0.0', port=port, debug=True)
