import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'scenic-area-dev-secret-key')
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        'sqlite:///' + os.path.join(os.path.dirname(__file__), 'data', 'scenic.db')
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    PORT = int(os.environ.get('BACKEND_PORT', 8004))

    FRONTEND_PORT = os.environ.get('FRONTEND_PORT', '3004')

    @staticmethod
    def get_cors_origins():
        port = Config.FRONTEND_PORT
        return [
            f'http://localhost:{port}',
            f'http://127.0.0.1:{port}'
        ]

    ROLES = ['ticket_specialist', 'site_dispatcher', 'scenic_manager']
    ROLE_NAMES = {
        'ticket_specialist': '票务专员',
        'site_dispatcher': '现场调度',
        'scenic_manager': '景区经理'
    }

    ORDER_STATUS = [
        'pending_verification',
        'verified',
        'entered',
        'archived',
        'appeal_pending'
    ]
    ORDER_STATUS_NAMES = {
        'pending_verification': '待票务核销',
        'verified': '已核销待入园',
        'entered': '已入园待归档',
        'archived': '已归档',
        'appeal_pending': '申诉中'
    }

    APPEAL_STATUS = [
        'submitted',
        'accepted',
        'rejected_correction',
        'resubmitted',
        'approved',
        'denied'
    ]
    APPEAL_STATUS_NAMES = {
        'submitted': '已提交',
        'accepted': '已受理',
        'rejected_correction': '驳回补正',
        'resubmitted': '再次提交',
        'approved': '申诉通过',
        'denied': '申诉驳回'
    }

    STATUS_TRANSITIONS = {
        'ticket_specialist': {
            'pending_verification': ['verified', 'appeal_pending']
        },
        'site_dispatcher': {
            'verified': ['entered', 'appeal_pending']
        },
        'scenic_manager': {
            'entered': ['archived'],
            'appeal_pending': ['pending_verification', 'verified', 'entered', 'archived']
        }
    }

    REQUIRED_EVIDENCE = {
        'pending_verification': ['booking_sheet'],
        'verified': ['booking_sheet', 'ticket_voucher'],
        'entered': ['booking_sheet', 'ticket_voucher', 'entry_record'],
        'archived': ['booking_sheet', 'ticket_voucher', 'entry_record', 'settlement_note']
    }

    EVIDENCE_NAMES = {
        'booking_sheet': '预约单',
        'ticket_voucher': '票务凭证',
        'entry_record': '入园记录',
        'settlement_note': '结算单'
    }

    APPEAL_ALLOWED_SUBMITTERS = {
        'pending_verification': 'ticket_specialist',
        'verified': 'site_dispatcher',
        'entered': 'site_dispatcher'
    }

    APPEAL_ALLOWED_REVIEWERS = ['scenic_manager']

    APPEAL_RESUBMIT_ALLOWED_STATUSES = ['rejected_correction']
