from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    name = db.Column(db.String(50), nullable=False)
    role = db.Column(db.String(30), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'name': self.name,
            'role': self.role
        }


class TeamOrder(db.Model):
    __tablename__ = 'team_orders'

    id = db.Column(db.Integer, primary_key=True)
    order_no = db.Column(db.String(32), unique=True, nullable=False)
    team_name = db.Column(db.String(100), nullable=False)
    visitor_count = db.Column(db.Integer, nullable=False)
    visit_date = db.Column(db.Date, nullable=False)
    guide_name = db.Column(db.String(50))
    guide_phone = db.Column(db.String(20))

    status = db.Column(db.String(30), nullable=False, default='pending_verification')
    current_handler_role = db.Column(db.String(30), nullable=False, default='ticket_specialist')
    version = db.Column(db.Integer, nullable=False, default=1)

    evidence = db.Column(db.Text)
    remark = db.Column(db.Text)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    logs = db.relationship('OrderLog', backref='order', lazy='dynamic', order_by='OrderLog.created_at.desc()')
    appeals = db.relationship('Appeal', backref='order', lazy='dynamic', order_by='Appeal.created_at.desc()')

    def to_dict(self, include_logs=False, include_appeals=False):
        data = {
            'id': self.id,
            'order_no': self.order_no,
            'team_name': self.team_name,
            'visitor_count': self.visitor_count,
            'visit_date': self.visit_date.isoformat() if self.visit_date else None,
            'guide_name': self.guide_name,
            'guide_phone': self.guide_phone,
            'status': self.status,
            'current_handler_role': self.current_handler_role,
            'version': self.version,
            'evidence': self.evidence,
            'remark': self.remark,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        if include_logs:
            data['logs'] = [log.to_dict() for log in self.logs]
        if include_appeals:
            data['appeals'] = [appeal.to_dict() for appeal in self.appeals]
        return data


class OrderLog(db.Model):
    __tablename__ = 'order_logs'

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('team_orders.id'), nullable=False)
    action = db.Column(db.String(50), nullable=False)
    operator_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    operator_name = db.Column(db.String(50))
    operator_role = db.Column(db.String(30))
    from_status = db.Column(db.String(30))
    to_status = db.Column(db.String(30))
    remark = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'action': self.action,
            'operator_id': self.operator_id,
            'operator_name': self.operator_name,
            'operator_role': self.operator_role,
            'from_status': self.from_status,
            'to_status': self.to_status,
            'remark': self.remark,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Appeal(db.Model):
    __tablename__ = 'appeals'

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('team_orders.id'), nullable=False)
    status = db.Column(db.String(30), nullable=False, default='submitted')
    submitter_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    submitter_name = db.Column(db.String(50))
    submitter_role = db.Column(db.String(30))

    reason = db.Column(db.Text)
    review_opinion = db.Column(db.Text)
    reject_reason = db.Column(db.Text)
    original_status = db.Column(db.String(30))

    reviewer_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    reviewer_name = db.Column(db.String(50))

    version = db.Column(db.Integer, nullable=False, default=1)
    resubmit_count = db.Column(db.Integer, default=0)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    logs = db.relationship('AppealLog', backref='appeal', lazy='dynamic', order_by='AppealLog.created_at.desc()')

    def to_dict(self, include_logs=False):
        data = {
            'id': self.id,
            'order_id': self.order_id,
            'status': self.status,
            'submitter_id': self.submitter_id,
            'submitter_name': self.submitter_name,
            'submitter_role': self.submitter_role,
            'reason': self.reason,
            'review_opinion': self.review_opinion,
            'reject_reason': self.reject_reason,
            'original_status': self.original_status,
            'reviewer_id': self.reviewer_id,
            'reviewer_name': self.reviewer_name,
            'version': self.version,
            'resubmit_count': self.resubmit_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        if include_logs:
            data['logs'] = [log.to_dict() for log in self.logs]
        return data


class AppealLog(db.Model):
    __tablename__ = 'appeal_logs'

    id = db.Column(db.Integer, primary_key=True)
    appeal_id = db.Column(db.Integer, db.ForeignKey('appeals.id'), nullable=False)
    action = db.Column(db.String(50), nullable=False)
    operator_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    operator_name = db.Column(db.String(50))
    operator_role = db.Column(db.String(30))
    from_status = db.Column(db.String(30))
    to_status = db.Column(db.String(30))
    remark = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'appeal_id': self.appeal_id,
            'action': self.action,
            'operator_id': self.operator_id,
            'operator_name': self.operator_name,
            'operator_role': self.operator_role,
            'from_status': self.from_status,
            'to_status': self.to_status,
            'remark': self.remark,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
