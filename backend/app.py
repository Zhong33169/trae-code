from flask import Flask
from flask_cors import CORS
from models import db
from routes import api


def create_app():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///immunization.db"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    CORS(app, origins=["http://localhost:3002"])
    db.init_app(app)
    app.register_blueprint(api)
    return app


if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        db.create_all()
    app.run(host="0.0.0.0", port=8002, debug=True)
