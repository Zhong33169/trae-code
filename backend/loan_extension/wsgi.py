"""
WSGI config for loan_extension project.
"""
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'loan_extension.settings')

application = get_wsgi_application()
