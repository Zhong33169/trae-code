from flask import Blueprint, request, jsonify, session
from models import db, User
from config import Config

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': '请输入用户名和密码'}), 400

    user = User.query.filter_by(username=username).first()
    if not user or user.password != password:
        return jsonify({'error': '用户名或密码错误'}), 401

    session['user_id'] = user.id
    session['username'] = user.username
    session['role'] = user.role

    return jsonify({
        'user': user.to_dict(),
        'role_name': Config.ROLE_NAMES.get(user.role, user.role)
    })


@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': '已退出登录'})


@auth_bp.route('/me', methods=['GET'])
def me():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': '未登录'}), 401

    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': '用户不存在'}), 404

    return jsonify({
        'user': user.to_dict(),
        'role_name': Config.ROLE_NAMES.get(user.role, user.role)
    })


@auth_bp.route('/users', methods=['GET'])
def list_users():
    users = User.query.all()
    return jsonify([{
        **u.to_dict(),
        'role_name': Config.ROLE_NAMES.get(u.role, u.role)
    } for u in users])
